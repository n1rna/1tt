package handler

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/n1rna/1tt/api/internal/config"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/storage"
)

// InternalMessage is the envelope for all internal worker messages.
type InternalMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// HandleInternalMessage is the single entry point for all internal worker messages.
// It validates the secret, parses the message type, and dispatches accordingly.
func HandleInternalMessage(cfg *config.Config, db *sql.DB, r2 *storage.R2Client, agent *life.Agent) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.InternalSecret == "" || r.Header.Get("X-Internal-Secret") != cfg.InternalSecret {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}

		var msg InternalMessage
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			http.Error(w, `{"error":"invalid message"}`, http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		switch msg.Type {
		case "cleanup":
			handleCleanup(r, w, db, r2)

		case "life_scheduler_check":
			handleSchedulerCheck(r, w, db)

		case "life_scheduler_run":
			handleSchedulerRun(r, w, db, agent, msg.Data)

		default:
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "unknown message type: " + msg.Type})
		}
	}
}

// handleCleanup deletes expired files from R2 and the database.
func handleCleanup(r *http.Request, w http.ResponseWriter, db *sql.DB, r2 *storage.R2Client) {
	if db == nil || r2 == nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "cleanup not configured"})
		return
	}

	const q = `
		SELECT id, r2_key FROM files
		WHERE NOT permanent
		  AND last_accessed_at < NOW() - INTERVAL '90 days'
		LIMIT 500`

	rows, err := db.QueryContext(r.Context(), q)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	var deleted int
	for rows.Next() {
		var id, r2Key string
		if err := rows.Scan(&id, &r2Key); err != nil {
			continue
		}
		if err := r2.Delete(r.Context(), r2Key); err != nil {
			log.Printf("cleanup: r2 delete %s failed: %v", r2Key, err)
			continue
		}
		if _, err := db.ExecContext(r.Context(), `DELETE FROM files WHERE id = $1`, id); err != nil {
			log.Printf("cleanup: db delete %s failed: %v", id, err)
			continue
		}
		deleted++
	}

	json.NewEncoder(w).Encode(map[string]int{"deleted": deleted})
}

// handleSchedulerCheck returns which user/cycle pairs are due right now.
func handleSchedulerCheck(r *http.Request, w http.ResponseWriter, db *sql.DB) {
	due, err := life.CheckDueCycles(r.Context(), db)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]any{"cycles": due})
}

// handleSchedulerRun executes a single planning cycle for one user.
func handleSchedulerRun(r *http.Request, w http.ResponseWriter, db *sql.DB, agent *life.Agent, data json.RawMessage) {
	var payload struct {
		UserID string         `json:"user_id"`
		Cycle  life.PlanCycle `json:"cycle"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid data: " + err.Error()})
		return
	}

	if payload.UserID == "" || payload.Cycle == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "user_id and cycle are required"})
		return
	}

	if err := life.RunUserCycle(r.Context(), db, agent, payload.UserID, payload.Cycle); err != nil {
		log.Printf("scheduler run: %s/%s failed: %v", payload.UserID, payload.Cycle, err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   err.Error(),
			"user_id": payload.UserID,
			"cycle":   string(payload.Cycle),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"user_id": payload.UserID,
		"cycle":   string(payload.Cycle),
	})
}
