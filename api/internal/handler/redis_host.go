package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1tt/api/internal/billing"
	"github.com/n1rna/1tt/api/internal/middleware"
	"github.com/n1rna/1tt/api/internal/upstash"
)

// RedisRecord is the JSON representation of a user_redis row.
type RedisRecord struct {
	ID             string `json:"id"`
	UserID         string `json:"userId"`
	UpstashDBID    string `json:"upstashDbId,omitempty"`
	Name           string `json:"name"`
	Region         string `json:"region"`
	Endpoint       string `json:"endpoint,omitempty"`
	RestToken      string `json:"restToken,omitempty"`
	ReadOnlyToken  string `json:"readOnlyToken,omitempty"`
	Password       string `json:"password,omitempty"`
	Status         string `json:"status"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

// CreateRedis handles POST /redis — provision an Upstash Redis database and
// register it for the authenticated user.
func CreateRedis(db *sql.DB, upstashClient *upstash.Client, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if upstashClient == nil {
			http.Error(w, `{"error":"Redis hosting not configured"}`, http.StatusServiceUnavailable)
			return
		}

		var req struct {
			Name   string `json:"name"`
			Region string `json:"region"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
			return
		}
		if req.Region == "" {
			req.Region = "us-east-1"
		}

		// Check plan limits.
		tier := billing.GetUserPlanTier(r.Context(), db, userID)
		limits := billing.Plans[tier]

		if limits.RedisMax <= 0 {
			http.Error(w, `{"error":"hosted Redis databases require a paid plan"}`, http.StatusForbidden)
			return
		}

		var activeCount int
		if err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM user_redis WHERE user_id = $1 AND status = 'active'`,
			userID).Scan(&activeCount); err != nil {
			http.Error(w, `{"error":"failed to check Redis database count"}`, http.StatusInternalServerError)
			return
		}
		if activeCount >= limits.RedisMax {
			http.Error(w, `{"error":"Redis database limit reached for your plan"}`, http.StatusForbidden)
			return
		}

		// Provision via Upstash.
		rdb, err := upstashClient.CreateDatabase(r.Context(), req.Name, req.Region)
		if err != nil {
			log.Printf("redis create: upstash error: %v", err)
			http.Error(w, `{"error":"failed to provision Redis database"}`, http.StatusInternalServerError)
			return
		}

		id := generateID()
		const insertQ = `
			INSERT INTO user_redis
			    (id, user_id, upstash_db_id, name, region, endpoint, rest_token, read_only_token, password)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING created_at, updated_at`

		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), insertQ,
			id, userID, rdb.DatabaseID, req.Name, req.Region,
			rdb.Endpoint, rdb.RestToken, rdb.ReadOnlyRestToken, rdb.Password,
		).Scan(&createdAt, &updatedAt); err != nil {
			log.Printf("redis create: db insert error: %v", err)
			// Best-effort Upstash cleanup.
			upstashClient.DeleteDatabase(r.Context(), rdb.DatabaseID) //nolint:errcheck
			http.Error(w, `{"error":"failed to register Redis database"}`, http.StatusInternalServerError)
			return
		}

		rec := RedisRecord{
			ID:          id,
			UserID:      userID,
			UpstashDBID: rdb.DatabaseID,
			Name:        req.Name,
			Region:      req.Region,
			Endpoint:    fmt.Sprintf("https://%s", rdb.Endpoint),
			Status:      "active",
			CreatedAt:   createdAt.UTC().Format(time.RFC3339),
			UpdatedAt:   updatedAt.UTC().Format(time.RFC3339),
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(rec) //nolint:errcheck
	}
}

// ListRedis handles GET /redis — list all active Redis databases for the user
// (without sensitive tokens).
func ListRedis(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, user_id, upstash_db_id, name, region, endpoint, status, created_at, updated_at
			FROM user_redis
			WHERE user_id = $1 AND status = 'active'
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list Redis databases"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		records := make([]RedisRecord, 0)
		for rows.Next() {
			var rec RedisRecord
			var createdAt, updatedAt time.Time
			if err := rows.Scan(
				&rec.ID, &rec.UserID, &rec.UpstashDBID, &rec.Name, &rec.Region,
				&rec.Endpoint, &rec.Status, &createdAt, &updatedAt,
			); err != nil {
				http.Error(w, `{"error":"failed to read records"}`, http.StatusInternalServerError)
				return
			}
			rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			if rec.Endpoint != "" && !strings.HasPrefix(rec.Endpoint, "https://") {
				rec.Endpoint = "https://" + rec.Endpoint
			}
			records = append(records, rec)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate records"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"databases": records}) //nolint:errcheck
	}
}

// GetRedis handles GET /redis/{id} — return a single record with its rest_token
// and endpoint so the frontend can connect.
func GetRedis(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		const q = `
			SELECT id, user_id, upstash_db_id, name, region, endpoint,
			       rest_token, read_only_token, password, status, created_at, updated_at
			FROM user_redis
			WHERE id = $1 AND user_id = $2`

		var rec RedisRecord
		var createdAt, updatedAt time.Time
		err := db.QueryRowContext(r.Context(), q, id, userID).Scan(
			&rec.ID, &rec.UserID, &rec.UpstashDBID, &rec.Name, &rec.Region, &rec.Endpoint,
			&rec.RestToken, &rec.ReadOnlyToken, &rec.Password, &rec.Status, &createdAt, &updatedAt,
		)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Redis database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up Redis database"}`, http.StatusInternalServerError)
			return
		}
		rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if rec.Endpoint != "" && !strings.HasPrefix(rec.Endpoint, "https://") {
			rec.Endpoint = "https://" + rec.Endpoint
		}

		json.NewEncoder(w).Encode(rec) //nolint:errcheck
	}
}

// DeleteRedis handles DELETE /redis/{id} — delete from Upstash (best-effort)
// and soft-delete the local record.
func DeleteRedis(db *sql.DB, upstashClient *upstash.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var upstashDBID string
		err := db.QueryRowContext(r.Context(),
			`SELECT upstash_db_id FROM user_redis WHERE id = $1 AND user_id = $2`,
			id, userID).Scan(&upstashDBID)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Redis database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up Redis database"}`, http.StatusInternalServerError)
			return
		}

		// Delete from Upstash (best-effort — proceed even if it fails).
		if upstashClient != nil && upstashDBID != "" {
			if err := upstashClient.DeleteDatabase(r.Context(), upstashDBID); err != nil {
				log.Printf("redis delete: upstash delete error for %s: %v", upstashDBID, err)
			}
		}

		if _, err := db.ExecContext(r.Context(),
			`UPDATE user_redis SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
			id); err != nil {
			http.Error(w, `{"error":"failed to delete Redis database"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// ProxyCommand handles POST /redis/{id}/command — forwards a single Redis
// command to the Upstash REST API server-side, keeping the rest_token hidden
// from the frontend.
//
// Request body: { "command": ["GET", "key"] }
func ProxyCommand(db *sql.DB, upstashClient *upstash.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var endpoint, restToken string
		err := db.QueryRowContext(r.Context(),
			`SELECT endpoint, rest_token FROM user_redis
			 WHERE id = $1 AND user_id = $2 AND status = 'active'`,
			id, userID).Scan(&endpoint, &restToken)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Redis database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up Redis database"}`, http.StatusInternalServerError)
			return
		}

		var req struct {
			Command []string `json:"command"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if len(req.Command) == 0 {
			http.Error(w, `{"error":"command is required"}`, http.StatusBadRequest)
			return
		}

		result, status, err := upstashRestRequest(r.Context(), endpoint, restToken, req.Command)
		if err != nil {
			log.Printf("redis proxy command: error for %s: %v", id, err)
			http.Error(w, `{"error":"failed to execute Redis command"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(status)
		w.Write(result) //nolint:errcheck
	}
}

// ProxyPipeline handles POST /redis/{id}/pipeline — forwards a pipeline of
// Redis commands to the Upstash REST API server-side.
//
// Request body: { "commands": [["GET","k1"],["SET","k2","v2"]] }
func ProxyPipeline(db *sql.DB, upstashClient *upstash.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var endpoint, restToken string
		err := db.QueryRowContext(r.Context(),
			`SELECT endpoint, rest_token FROM user_redis
			 WHERE id = $1 AND user_id = $2 AND status = 'active'`,
			id, userID).Scan(&endpoint, &restToken)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Redis database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up Redis database"}`, http.StatusInternalServerError)
			return
		}

		var req struct {
			Commands [][]string `json:"commands"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if len(req.Commands) == 0 {
			http.Error(w, `{"error":"commands are required"}`, http.StatusBadRequest)
			return
		}

		pipelineEndpoint := endpoint + "/pipeline"
		result, status, err := upstashRestRequest(r.Context(), pipelineEndpoint, restToken, req.Commands)
		if err != nil {
			log.Printf("redis proxy pipeline: error for %s: %v", id, err)
			http.Error(w, `{"error":"failed to execute Redis pipeline"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(status)
		w.Write(result) //nolint:errcheck
	}
}

// GetRedisInfo handles GET /redis/{id}/info — executes the INFO command via the
// Upstash REST API and returns the result.
func GetRedisInfo(db *sql.DB, upstashClient *upstash.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var endpoint, restToken string
		err := db.QueryRowContext(r.Context(),
			`SELECT endpoint, rest_token FROM user_redis
			 WHERE id = $1 AND user_id = $2 AND status = 'active'`,
			id, userID).Scan(&endpoint, &restToken)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Redis database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up Redis database"}`, http.StatusInternalServerError)
			return
		}

		result, status, err := upstashRestRequest(r.Context(), endpoint, restToken, []string{"INFO"})
		if err != nil {
			log.Printf("redis info: error for %s: %v", id, err)
			http.Error(w, `{"error":"failed to retrieve Redis info"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(status)
		w.Write(result) //nolint:errcheck
	}
}

// upstashRestRequest sends a request to the Upstash REST API and returns the
// raw response body, the upstream HTTP status code, and any transport error.
// For pipeline calls, pass the endpoint with "/pipeline" appended.
func upstashRestRequest(ctx context.Context, endpoint, restToken string, body any) ([]byte, int, error) {
	baseURL := endpoint
	if !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}

	b, err := json.Marshal(body)
	if err != nil {
		return nil, 0, fmt.Errorf("upstash rest: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL, bytes.NewReader(b))
	if err != nil {
		return nil, 0, fmt.Errorf("upstash rest: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+restToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("upstash rest: execute: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("upstash rest: read body: %w", err)
	}
	return raw, resp.StatusCode, nil
}
