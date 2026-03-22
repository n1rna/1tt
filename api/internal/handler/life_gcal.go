package handler

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/middleware"
)

// loadCalendarEventsForChat fetches upcoming calendar events for the chat
// system prompt. Errors are logged but not returned — calendar is optional.
func loadCalendarEventsForChat(ctx context.Context, db *sql.DB, gcalClient *life.GCalClient, userID string) []life.GCalEvent {
	if gcalClient == nil {
		return nil
	}
	accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		// Not connected or refresh failed — silently skip.
		return nil
	}
	events, err := gcalClient.ListEvents(ctx, accessToken, 7)
	if err != nil {
		log.Printf("life: load calendar events for %s: %v", userID, err)
		return nil
	}
	return events
}

// generateState produces a random 16-byte hex state string for OAuth CSRF protection.
func generateState() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// GetGCalAuthURL handles GET /life/gcal/auth-url.
// Returns the Google OAuth2 authorization URL.
func GetGCalAuthURL(gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if gcalClient == nil {
			http.Error(w, `{"error":"Google Calendar is not configured on this server"}`, http.StatusServiceUnavailable)
			return
		}

		state := generateState()
		authURL := gcalClient.GetAuthURL(state)
		json.NewEncoder(w).Encode(map[string]any{
			"url":   authURL,
			"state": state,
		})
	}
}

// GCalCallback handles POST /life/gcal/callback.
// Body: {"code": "<authorization_code>"}
// Exchanges the code for tokens and stores them in life_gcal_connections.
func GCalCallback(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if gcalClient == nil {
			http.Error(w, `{"error":"Google Calendar is not configured on this server"}`, http.StatusServiceUnavailable)
			return
		}

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if req.Code == "" {
			http.Error(w, `{"error":"code is required"}`, http.StatusBadRequest)
			return
		}

		tokens, err := gcalClient.ExchangeCode(r.Context(), req.Code)
		if err != nil {
			log.Printf("gcal callback: exchange code for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to exchange authorization code"}`, http.StatusBadRequest)
			return
		}

		const q = `
			INSERT INTO life_gcal_connections
				(user_id, google_email, access_token, refresh_token, token_expiry)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id) DO UPDATE SET
				google_email  = EXCLUDED.google_email,
				access_token  = EXCLUDED.access_token,
				refresh_token = EXCLUDED.refresh_token,
				token_expiry  = EXCLUDED.token_expiry,
				updated_at    = NOW()`

		if _, err := db.ExecContext(r.Context(), q,
			userID, tokens.Email, tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresAt,
		); err != nil {
			log.Printf("gcal callback: store tokens for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to save calendar connection"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{
			"connected": true,
			"email":     tokens.Email,
		})
	}
}

// gcalStatusRecord is the JSON representation of the GCal connection status.
type gcalStatusRecord struct {
	Connected   bool    `json:"connected"`
	Email       *string `json:"email,omitempty"`
	TokenExpiry *string `json:"tokenExpiry,omitempty"`
}

// GetGCalStatus handles GET /life/gcal/status.
// Returns the connection status for the authenticated user.
func GetGCalStatus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var email string
		var tokenExpiry time.Time
		err := db.QueryRowContext(r.Context(),
			`SELECT google_email, token_expiry FROM life_gcal_connections WHERE user_id = $1`,
			userID,
		).Scan(&email, &tokenExpiry)

		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(gcalStatusRecord{Connected: false})
			return
		}
		if err != nil {
			log.Printf("gcal status: query for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to query calendar status"}`, http.StatusInternalServerError)
			return
		}

		expStr := tokenExpiry.UTC().Format(time.RFC3339)
		json.NewEncoder(w).Encode(gcalStatusRecord{
			Connected:   true,
			Email:       &email,
			TokenExpiry: &expStr,
		})
	}
}

// DisconnectGCal handles DELETE /life/gcal.
// Removes the Google Calendar connection for the authenticated user.
func DisconnectGCal(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		res, err := db.ExecContext(r.Context(),
			`DELETE FROM life_gcal_connections WHERE user_id = $1`, userID,
		)
		if err != nil {
			log.Printf("gcal disconnect: delete for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to disconnect calendar"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"no calendar connection found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"disconnected": true})
	}
}

// ListGCalEvents handles GET /life/gcal/events?days=7.
// Fetches upcoming events from the user's connected Google Calendar.
func ListGCalEvents(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if gcalClient == nil {
			json.NewEncoder(w).Encode(map[string]any{"events": []any{}})
			return
		}

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		daysAhead := 7
		if d := r.URL.Query().Get("days"); d != "" {
			if n, err := strconv.Atoi(d); err == nil && n > 0 {
				daysAhead = n
			}
		}

		accessToken, err := life.EnsureValidToken(r.Context(), db, gcalClient, userID)
		if err != nil {
			http.Error(w, `{"error":"calendar not connected"}`, http.StatusBadRequest)
			return
		}

		events, err := gcalClient.ListEvents(r.Context(), accessToken, daysAhead)
		if err != nil {
			log.Printf("gcal list events: fetch for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to fetch calendar events"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"events": events})
	}
}
