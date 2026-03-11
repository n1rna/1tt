package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/n1rna/1two/api/internal/middleware"
)

// allowedToolStateKeys maps each syncable localStorage key to its maximum
// permitted size in bytes. Keys not present in this map are rejected.
// Keep in sync with src/lib/sync/schema.ts on the frontend.
var allowedToolStateKeys = map[string]int64{
	"1two:calendar-markers": 65536,
	"pomodoro-state":        32768,
	"worldclock-state":      32768,
	"dns-lookup-history":    131072,
	"1two-saved-logos":      262144,
	"og-custom-layouts":     262144,
	"1two-saved-colors":     65536,
	"1two-saved-themes":     65536,
	"1two:bookmarks":        8192,
	"1two:tool-order":       8192,
}

// validator checks that a JSON payload conforms to the expected schema.
type validator func(data json.RawMessage) error

// toolStateValidators maps each key to a structural validator.
var toolStateValidators = map[string]validator{
	"1two:bookmarks":        validateStringArray(200),
	"1two:tool-order":       validateStringArray(200),
	"1two:calendar-markers": validateCalendarMarkers,
	"pomodoro-state":        validatePomodoroState,
	"worldclock-state":      validateWorldclockState,
	"dns-lookup-history":    validateDnsHistory,
	"1two-saved-logos":      validateSavedLogos,
	"og-custom-layouts":     validateOgLayouts,
	"1two-saved-colors":     validateSavedColors,
	"1two-saved-themes":     validateSavedThemes,
}

// ── Validators ──────────────────────────────────────────

func validateStringArray(maxItems int) validator {
	return func(data json.RawMessage) error {
		var arr []string
		if err := json.Unmarshal(data, &arr); err != nil {
			return fmt.Errorf("must be an array of strings")
		}
		if len(arr) > maxItems {
			return fmt.Errorf("too many items (max %d)", maxItems)
		}
		return nil
	}
}

func validateCalendarMarkers(data json.RawMessage) error {
	var arr []struct {
		ID    *string `json:"id"`
		Label *string `json:"label"`
		Start *string `json:"start"`
		End   *string `json:"end"`
		Color *string `json:"color"`
	}
	if err := json.Unmarshal(data, &arr); err != nil {
		return fmt.Errorf("must be an array of marker objects")
	}
	if len(arr) > 500 {
		return fmt.Errorf("too many items (max 500)")
	}
	for i, m := range arr {
		if m.ID == nil || m.Label == nil || m.Start == nil || m.End == nil || m.Color == nil {
			return fmt.Errorf("item %d missing required fields (id, label, start, end, color)", i)
		}
	}
	return nil
}

func validatePomodoroState(data json.RawMessage) error {
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(data, &obj); err != nil {
		return fmt.Errorf("must be an object")
	}
	for _, key := range []string{"goals", "completedToday", "settings", "date"} {
		if _, ok := obj[key]; !ok {
			return fmt.Errorf("missing required field: %s", key)
		}
	}
	return nil
}

func validateWorldclockState(data json.RawMessage) error {
	var obj struct {
		Favorites    json.RawMessage `json:"favorites"`
		Overlap      json.RawMessage `json:"overlap"`
		Calendars    json.RawMessage `json:"calendars"`
		ShowRelative *bool           `json:"showRelative"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return fmt.Errorf("must be an object with favorites, overlap, calendars, showRelative")
	}

	// Validate favorites and overlap are arrays of {tz, label}
	for _, field := range []struct {
		name string
		raw  json.RawMessage
	}{
		{"favorites", obj.Favorites},
		{"overlap", obj.Overlap},
	} {
		if field.raw == nil {
			return fmt.Errorf("missing required field: %s", field.name)
		}
		var entries []struct {
			Tz    *string `json:"tz"`
			Label *string `json:"label"`
		}
		if err := json.Unmarshal(field.raw, &entries); err != nil {
			return fmt.Errorf("%s must be an array of {tz, label} objects", field.name)
		}
		if len(entries) > 50 {
			return fmt.Errorf("%s has too many items (max 50)", field.name)
		}
	}

	if obj.Calendars == nil {
		return fmt.Errorf("missing required field: calendars")
	}
	var cals []string
	if err := json.Unmarshal(obj.Calendars, &cals); err != nil {
		return fmt.Errorf("calendars must be an array of strings")
	}
	if len(cals) > 10 {
		return fmt.Errorf("calendars has too many items (max 10)")
	}

	if obj.ShowRelative == nil {
		return fmt.Errorf("missing required field: showRelative")
	}
	return nil
}

func validateDnsHistory(data json.RawMessage) error {
	var arr []struct {
		Domain     *string `json:"domain"`
		LastLookup *any    `json:"lastLookup"`
	}
	if err := json.Unmarshal(data, &arr); err != nil {
		return fmt.Errorf("must be an array of history entry objects")
	}
	if len(arr) > 200 {
		return fmt.Errorf("too many items (max 200)")
	}
	for i, e := range arr {
		if e.Domain == nil || e.LastLookup == nil {
			return fmt.Errorf("item %d missing required fields (domain, lastLookup)", i)
		}
	}
	return nil
}

func validateSavedLogos(data json.RawMessage) error {
	var arr []struct {
		ID        *string `json:"id"`
		Name      *string `json:"name"`
		Config    *any    `json:"config"`
		CreatedAt *any    `json:"createdAt"`
	}
	if err := json.Unmarshal(data, &arr); err != nil {
		return fmt.Errorf("must be an array of saved logo objects")
	}
	if len(arr) > 50 {
		return fmt.Errorf("too many items (max 50)")
	}
	for i, e := range arr {
		if e.ID == nil || e.Name == nil || e.Config == nil || e.CreatedAt == nil {
			return fmt.Errorf("item %d missing required fields (id, name, config, createdAt)", i)
		}
	}
	return nil
}

func validateOgLayouts(data json.RawMessage) error {
	var arr []struct {
		ID       *string `json:"id"`
		Name     *string `json:"name"`
		Elements *any    `json:"elements"`
	}
	if err := json.Unmarshal(data, &arr); err != nil {
		return fmt.Errorf("must be an array of layout objects")
	}
	if len(arr) > 50 {
		return fmt.Errorf("too many items (max 50)")
	}
	for i, e := range arr {
		if e.ID == nil || e.Name == nil || e.Elements == nil {
			return fmt.Errorf("item %d missing required fields (id, name, elements)", i)
		}
	}
	return nil
}

func validateSavedColors(data json.RawMessage) error {
	var arr []struct {
		ID   *string `json:"id"`
		Hsva *any    `json:"hsva"`
		Name *string `json:"name"`
	}
	if err := json.Unmarshal(data, &arr); err != nil {
		return fmt.Errorf("must be an array of saved color objects")
	}
	if len(arr) > 100 {
		return fmt.Errorf("too many items (max 100)")
	}
	for i, e := range arr {
		if e.ID == nil || e.Hsva == nil || e.Name == nil {
			return fmt.Errorf("item %d missing required fields (id, hsva, name)", i)
		}
	}
	return nil
}

func validateSavedThemes(data json.RawMessage) error {
	var arr []struct {
		ID     *string `json:"id"`
		Name   *string `json:"name"`
		Tokens *any    `json:"tokens"`
		Mode   *string `json:"mode"`
	}
	if err := json.Unmarshal(data, &arr); err != nil {
		return fmt.Errorf("must be an array of saved theme objects")
	}
	if len(arr) > 100 {
		return fmt.Errorf("too many items (max 100)")
	}
	for i, e := range arr {
		if e.ID == nil || e.Name == nil || e.Tokens == nil || e.Mode == nil {
			return fmt.Errorf("item %d missing required fields (id, name, tokens, mode)", i)
		}
	}
	return nil
}

// ── Response types ──────────────────────────────────────

// toolStateEntry is a single entry returned in list and get responses.
type toolStateEntry struct {
	Key       string          `json:"key"`
	Data      json.RawMessage `json:"data"`
	UpdatedAt string          `json:"updatedAt"`
}

// putToolStateRequest is the body accepted by PutToolState.
type putToolStateRequest struct {
	Key  string          `json:"key"`
	Data json.RawMessage `json:"data"`
}

// SummaryToolState handles GET /tool-state/summary.
// Auth required. Returns key, size, updatedAt for all entries (no data payload).
func SummaryToolState(db *sql.DB) http.HandlerFunc {
	type summaryEntry struct {
		Key       string `json:"key"`
		Size      int64  `json:"size"`
		UpdatedAt string `json:"updatedAt"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT key, size, updated_at
			FROM tool_state
			WHERE user_id = $1
			ORDER BY key`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list tool states"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		entries := make([]summaryEntry, 0)
		for rows.Next() {
			var e summaryEntry
			var updatedAt time.Time
			if err := rows.Scan(&e.Key, &e.Size, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read tool states"}`, http.StatusInternalServerError)
				return
			}
			e.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			entries = append(entries, e)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate tool states"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"states": entries})
	}
}

// ListToolState handles GET /tool-state.
// Auth required. Optional query param `key` narrows the response to a single entry.
func ListToolState(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		key := r.URL.Query().Get("key")

		var states []toolStateEntry

		if key != "" {
			const q = `
				SELECT key, data, updated_at
				FROM tool_state
				WHERE user_id = $1 AND key = $2`

			var entry toolStateEntry
			var updatedAt time.Time
			err := db.QueryRowContext(r.Context(), q, userID, key).
				Scan(&entry.Key, &entry.Data, &updatedAt)
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"state not found"}`, http.StatusNotFound)
				return
			}
			if err != nil {
				http.Error(w, `{"error":"failed to retrieve tool state"}`, http.StatusInternalServerError)
				return
			}
			entry.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			states = []toolStateEntry{entry}
		} else {
			const q = `
				SELECT key, data, updated_at
				FROM tool_state
				WHERE user_id = $1
				ORDER BY key`

			rows, err := db.QueryContext(r.Context(), q, userID)
			if err != nil {
				http.Error(w, `{"error":"failed to list tool states"}`, http.StatusInternalServerError)
				return
			}
			defer rows.Close()

			states = make([]toolStateEntry, 0)
			for rows.Next() {
				var entry toolStateEntry
				var updatedAt time.Time
				if err := rows.Scan(&entry.Key, &entry.Data, &updatedAt); err != nil {
					http.Error(w, `{"error":"failed to read tool states"}`, http.StatusInternalServerError)
					return
				}
				entry.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				states = append(states, entry)
			}
			if err := rows.Err(); err != nil {
				http.Error(w, `{"error":"failed to iterate tool states"}`, http.StatusInternalServerError)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"states": states})
	}
}

// PutToolState handles PUT /tool-state.
// Auth required. Upserts a single tool state entry for the authenticated user.
func PutToolState(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req putToolStateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		limit, ok := allowedToolStateKeys[req.Key]
		if !ok {
			http.Error(w, `{"error":"key not allowed for sync"}`, http.StatusBadRequest)
			return
		}

		if int64(len(req.Data)) > limit {
			http.Error(w, `{"error":"data exceeds size limit for this key"}`, http.StatusRequestEntityTooLarge)
			return
		}

		// Validate payload structure
		if v, ok := toolStateValidators[req.Key]; ok {
			if err := v(req.Data); err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"validation failed: %s"}`, err.Error()), http.StatusBadRequest)
				return
			}
		}

		const q = `
			INSERT INTO tool_state (user_id, key, data, size, updated_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (user_id, key) DO UPDATE
			SET data = $3, size = $4, updated_at = NOW()
			RETURNING updated_at`

		size := int64(len(req.Data))
		var updatedAt time.Time
		err := db.QueryRowContext(r.Context(), q, userID, req.Key, req.Data, size).
			Scan(&updatedAt)
		if err != nil {
			http.Error(w, `{"error":"failed to save tool state"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"key":       req.Key,
			"updatedAt": updatedAt.UTC().Format(time.RFC3339),
		})
	}
}

// DeleteToolState handles DELETE /tool-state.
// Auth required. Required query param `key` identifies the entry to remove.
func DeleteToolState(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		key := r.URL.Query().Get("key")
		if key == "" {
			http.Error(w, `{"error":"key query parameter is required"}`, http.StatusBadRequest)
			return
		}

		const q = `DELETE FROM tool_state WHERE user_id = $1 AND key = $2`

		result, err := db.ExecContext(r.Context(), q, userID, key)
		if err != nil {
			http.Error(w, `{"error":"failed to delete tool state"}`, http.StatusInternalServerError)
			return
		}

		rows, err := result.RowsAffected()
		if err != nil || rows == 0 {
			http.Error(w, `{"error":"state not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}
