package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/middleware"
)

// ----- record types -----

// lifeProfileRecord is the JSON representation of a life_profiles row.
type lifeProfileRecord struct {
	UserID       string  `json:"userId"`
	Timezone     string  `json:"timezone"`
	WakeTime     *string `json:"wakeTime"`
	SleepTime    *string `json:"sleepTime"`
	AgentEnabled bool    `json:"agentEnabled"`
	Onboarded    bool    `json:"onboarded"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

// lifeMemoryRecord is the JSON representation of a life_memories row.
type lifeMemoryRecord struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Category  string `json:"category"`
	Content   string `json:"content"`
	Source    string `json:"source"`
	Active    bool   `json:"active"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// lifeConversationRecord is the JSON representation of a life_conversations row.
type lifeConversationRecord struct {
	ID          string  `json:"id"`
	UserID      string  `json:"userId"`
	Channel     string  `json:"channel"`
	Title       string  `json:"title"`
	LastMessage *string `json:"lastMessage"`
	UpdatedAt   string  `json:"updatedAt"`
	CreatedAt   string  `json:"createdAt"`
}

// lifeMessageRecord is the JSON representation of a life_messages row.
type lifeMessageRecord struct {
	ID             string          `json:"id"`
	ConversationID string          `json:"conversationId"`
	UserID         string          `json:"userId"`
	Role           string          `json:"role"`
	Content        string          `json:"content"`
	ToolCalls      json.RawMessage `json:"toolCalls,omitempty"`
	CreatedAt      string          `json:"createdAt"`
}

// ----- profile -----

// GetLifeProfile handles GET /life/profile.
// Returns the user's life profile, creating one with defaults if it does not exist.
func GetLifeProfile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Upsert default profile so the row always exists after first call.
		const upsertQ = `
			INSERT INTO life_profiles (user_id)
			VALUES ($1)
			ON CONFLICT (user_id) DO NOTHING`
		if _, err := db.ExecContext(r.Context(), upsertQ, userID); err != nil {
			log.Printf("life: upsert profile for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to initialise profile"}`, http.StatusInternalServerError)
			return
		}

		const q = `
			SELECT user_id, timezone, wake_time, sleep_time, agent_enabled, onboarded, created_at, updated_at
			FROM life_profiles WHERE user_id = $1`

		var rec lifeProfileRecord
		var wakeTime, sleepTime sql.NullString
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q, userID).Scan(
			&rec.UserID, &rec.Timezone, &wakeTime, &sleepTime,
			&rec.AgentEnabled, &rec.Onboarded, &createdAt, &updatedAt,
		); err != nil {
			log.Printf("life: get profile for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to get profile"}`, http.StatusInternalServerError)
			return
		}

		if wakeTime.Valid {
			rec.WakeTime = &wakeTime.String
		}
		if sleepTime.Valid {
			rec.SleepTime = &sleepTime.String
		}
		rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"profile": rec})
	}
}

// UpdateLifeProfile handles PUT /life/profile.
// Updates the user's timezone, wakeTime and sleepTime.
func UpdateLifeProfile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Timezone  string  `json:"timezone"`
			WakeTime  *string `json:"wakeTime"`
			SleepTime *string `json:"sleepTime"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		const q = `
			INSERT INTO life_profiles (user_id, timezone, wake_time, sleep_time, updated_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (user_id) DO UPDATE
			SET timezone   = EXCLUDED.timezone,
			    wake_time  = EXCLUDED.wake_time,
			    sleep_time = EXCLUDED.sleep_time,
			    updated_at = NOW()
			RETURNING user_id, timezone, wake_time, sleep_time, agent_enabled, created_at, updated_at`

		tz := req.Timezone
		if tz == "" {
			tz = "UTC"
		}

		var rec lifeProfileRecord
		var wakeTime, sleepTime sql.NullString
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			userID, tz, req.WakeTime, req.SleepTime,
		).Scan(
			&rec.UserID, &rec.Timezone, &wakeTime, &sleepTime,
			&rec.AgentEnabled, &createdAt, &updatedAt,
		); err != nil {
			log.Printf("life: update profile for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to update profile"}`, http.StatusInternalServerError)
			return
		}

		if wakeTime.Valid {
			rec.WakeTime = &wakeTime.String
		}
		if sleepTime.Valid {
			rec.SleepTime = &sleepTime.String
		}
		rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"profile": rec})
	}
}

// MarkOnboarded handles POST /life/profile/onboarded.
func MarkOnboarded(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if _, err := db.ExecContext(r.Context(),
			`UPDATE life_profiles SET onboarded = TRUE, updated_at = NOW() WHERE user_id = $1`, userID,
		); err != nil {
			http.Error(w, `{"error":"failed to update profile"}`, http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"onboarded": true})
	}
}

// ----- memories -----

// ListLifeMemories handles GET /life/memories.
// Returns all active memories for the authenticated user.
func ListLifeMemories(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, user_id, category, content, source, active, created_at, updated_at
			FROM life_memories
			WHERE user_id = $1 AND active = TRUE
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list memories"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		memories := make([]lifeMemoryRecord, 0)
		for rows.Next() {
			var m lifeMemoryRecord
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content,
				&m.Source, &m.Active, &createdAt, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read memories"}`, http.StatusInternalServerError)
				return
			}
			m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			memories = append(memories, m)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate memories"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"memories": memories})
	}
}

// CreateLifeMemory handles POST /life/memories.
// Body: {content, category}.
func CreateLifeMemory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Content  string `json:"content"`
			Category string `json:"category"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Content = strings.TrimSpace(req.Content)
		if req.Content == "" {
			http.Error(w, `{"error":"content is required"}`, http.StatusBadRequest)
			return
		}
		if req.Category == "" {
			req.Category = "preference"
		}

		id := uuid.NewString()
		const q = `
			INSERT INTO life_memories (id, user_id, category, content)
			VALUES ($1, $2, $3, $4)
			RETURNING id, user_id, category, content, source, active, created_at, updated_at`

		var m lifeMemoryRecord
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			id, userID, req.Category, req.Content,
		).Scan(&m.ID, &m.UserID, &m.Category, &m.Content,
			&m.Source, &m.Active, &createdAt, &updatedAt); err != nil {
			log.Printf("life: create memory for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to create memory"}`, http.StatusInternalServerError)
			return
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"memory": m})
	}
}

// UpdateLifeMemory handles PUT /life/memories/{id}.
// Body: {content, category}.
func UpdateLifeMemory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		memoryID := chi.URLParam(r, "id")

		var req struct {
			Content  string `json:"content"`
			Category string `json:"category"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Content = strings.TrimSpace(req.Content)
		if req.Content == "" {
			http.Error(w, `{"error":"content is required"}`, http.StatusBadRequest)
			return
		}

		const q = `
			UPDATE life_memories
			SET content    = $1,
			    category   = COALESCE(NULLIF($2, ''), category),
			    updated_at = NOW()
			WHERE id = $3 AND user_id = $4
			RETURNING id, user_id, category, content, source, active, created_at, updated_at`

		var m lifeMemoryRecord
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			req.Content, req.Category, memoryID, userID,
		).Scan(&m.ID, &m.UserID, &m.Category, &m.Content,
			&m.Source, &m.Active, &createdAt, &updatedAt); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"memory not found"}`, http.StatusNotFound)
				return
			}
			log.Printf("life: update memory %s: %v", memoryID, err)
			http.Error(w, `{"error":"failed to update memory"}`, http.StatusInternalServerError)
			return
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"memory": m})
	}
}

// DeleteLifeMemory handles DELETE /life/memories/{id}.
// Soft-deletes by setting active = FALSE.
func DeleteLifeMemory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		memoryID := chi.URLParam(r, "id")

		res, err := db.ExecContext(r.Context(),
			`UPDATE life_memories SET active = FALSE, updated_at = NOW()
			 WHERE id = $1 AND user_id = $2`,
			memoryID, userID,
		)
		if err != nil {
			log.Printf("life: delete memory %s: %v", memoryID, err)
			http.Error(w, `{"error":"failed to delete memory"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"memory not found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ----- conversations -----

// ListLifeConversations handles GET /life/conversations.
// Returns conversations with id, title, channel, updatedAt, and a preview of
// the last message.
func ListLifeConversations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT c.id, c.user_id, c.channel, c.title, c.created_at, c.updated_at,
			       (SELECT content FROM life_messages
			        WHERE conversation_id = c.id
			        ORDER BY created_at DESC LIMIT 1) AS last_message
			FROM life_conversations c
			WHERE c.user_id = $1
			ORDER BY c.updated_at DESC
			LIMIT 100`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list conversations"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		conversations := make([]lifeConversationRecord, 0)
		for rows.Next() {
			var c lifeConversationRecord
			var createdAt, updatedAt time.Time
			var lastMsg sql.NullString
			if err := rows.Scan(&c.ID, &c.UserID, &c.Channel, &c.Title,
				&createdAt, &updatedAt, &lastMsg); err != nil {
				http.Error(w, `{"error":"failed to read conversations"}`, http.StatusInternalServerError)
				return
			}
			c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			c.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			if lastMsg.Valid {
				preview := lastMsg.String
				if len(preview) > 120 {
					preview = preview[:120] + "..."
				}
				c.LastMessage = &preview
			}
			conversations = append(conversations, c)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate conversations"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"conversations": conversations})
	}
}

// GetConversationByRoutine handles GET /life/conversations/by-routine/{routineId}.
func GetConversationByRoutine(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		routineID := chi.URLParam(r, "routineId")
		var convID sql.NullString
		_ = db.QueryRowContext(r.Context(),
			`SELECT id FROM life_conversations WHERE user_id = $1 AND routine_id = $2 ORDER BY created_at DESC LIMIT 1`,
			userID, routineID,
		).Scan(&convID)

		if convID.Valid {
			json.NewEncoder(w).Encode(map[string]any{"conversationId": convID.String})
		} else {
			json.NewEncoder(w).Encode(map[string]any{"conversationId": nil})
		}
	}
}

// GetLifeConversation handles GET /life/conversations/{id}.
// Returns the conversation with all its messages.
func GetLifeConversation(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		convID := chi.URLParam(r, "id")

		// Verify ownership.
		var ownerID string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM life_conversations WHERE id = $1`, convID,
		).Scan(&ownerID); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"conversation not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to look up conversation"}`, http.StatusInternalServerError)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"conversation not found"}`, http.StatusNotFound)
			return
		}

		// Load messages.
		rows, err := db.QueryContext(r.Context(), `
			SELECT id, conversation_id, user_id, role, content, tool_calls, created_at
			FROM life_messages
			WHERE conversation_id = $1
			ORDER BY created_at ASC`, convID)
		if err != nil {
			http.Error(w, `{"error":"failed to load messages"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		messages := make([]lifeMessageRecord, 0)
		for rows.Next() {
			var m lifeMessageRecord
			var createdAt time.Time
			var toolCalls sql.NullString
			if err := rows.Scan(&m.ID, &m.ConversationID, &m.UserID, &m.Role, &m.Content, &toolCalls, &createdAt); err != nil {
				http.Error(w, `{"error":"failed to read messages"}`, http.StatusInternalServerError)
				return
			}
			m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			if toolCalls.Valid && toolCalls.String != "" && toolCalls.String != "null" {
				m.ToolCalls = json.RawMessage(toolCalls.String)
			}
			messages = append(messages, m)
		}

		// Refresh actionable statuses in tool_calls so they reflect current state.
		for i, m := range messages {
			if m.ToolCalls == nil {
				continue
			}
			var effects []map[string]any
			if err := json.Unmarshal(m.ToolCalls, &effects); err != nil {
				continue
			}
			changed := false
			for j, eff := range effects {
				tool, _ := eff["tool"].(string)
				if tool != "create_actionable" {
					continue
				}
				actionable, ok := eff["actionable"].(map[string]any)
				if !ok {
					continue
				}
				aid, _ := actionable["id"].(string)
				if aid == "" {
					continue
				}
				var status string
				if err := db.QueryRowContext(r.Context(),
					`SELECT status FROM life_actionables WHERE id = $1`, aid,
				).Scan(&status); err == nil {
					if actionable["status"] != status {
						actionable["status"] = status
						effects[j]["actionable"] = actionable
						changed = true
					}
				}
			}
			if changed {
				if updated, err := json.Marshal(effects); err == nil {
					messages[i].ToolCalls = json.RawMessage(updated)
				}
			}
		}

		json.NewEncoder(w).Encode(map[string]any{"messages": messages})
	}
}

// DeleteLifeConversation handles DELETE /life/conversations/{id}.
// Deletes the conversation and all its messages (cascade).
func DeleteLifeConversation(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		convID := chi.URLParam(r, "id")

		res, err := db.ExecContext(r.Context(),
			`DELETE FROM life_conversations WHERE id = $1 AND user_id = $2`,
			convID, userID,
		)
		if err != nil {
			log.Printf("life: delete conversation %s: %v", convID, err)
			http.Error(w, `{"error":"failed to delete conversation"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"conversation not found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ----- chat -----

// LifeChat handles POST /life/chat.
// Body: {message, conversationId?}.
// Creates a new conversation if conversationId is absent, saves both the user
// message and the assistant response, and returns the assistant message.
func LifeChat(db *sql.DB, agent *life.Agent, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		setup, _ := prepareChatRequest(w, r, db)
		if setup == nil {
			return
		}

		// Attach upcoming calendar events to the chat request (best-effort).
		setup.chatReq.CalendarEvents = loadCalendarEventsForChat(r.Context(), db, gcalClient, setup.chatReq.UserID)

		chatResult, err := agent.Chat(r.Context(), setup.chatReq)
		if err != nil {
			log.Printf("life: agent chat error for %s: %v", setup.chatReq.UserID, err)
			http.Error(w, `{"error":"failed to get response from assistant"}`, http.StatusInternalServerError)
			return
		}

		effects := buildEffects(r.Context(), db, chatResult)

		var toolCallsJSON []byte
		if len(effects) > 0 {
			toolCallsJSON, _ = json.Marshal(effects)
		}

		respMsg, err := saveAssistantMessage(r.Context(), db, setup.convID, setup.chatReq.UserID, chatResult.Text, toolCallsJSON)
		if err != nil {
			log.Printf("life: save assistant message: %v", err)
			http.Error(w, `{"error":"failed to save assistant response"}`, http.StatusInternalServerError)
			return
		}

		resp := map[string]any{
			"conversationId": setup.convID,
			"message":        respMsg,
		}
		if len(effects) > 0 {
			resp["effects"] = effects
		}
		json.NewEncoder(w).Encode(resp)
	}
}

// chatSetup holds all data assembled before calling the agent, shared between
// LifeChat and LifeChatStream.
type chatSetup struct {
	convID    string
	chatReq   life.ChatRequest
	userMsgID string
}

// prepareChatRequest performs auth, request parsing, conversation
// create/verify, history loading, memory loading, profile loading, routine
// loading, pending actionable counting, and user message insertion. On any
// error it writes the appropriate HTTP error and returns nil.
func prepareChatRequest(w http.ResponseWriter, r *http.Request, db *sql.DB) (*chatSetup, *struct {
	Message        string `json:"message"`
	ConversationID string `json:"conversationId"`
	SystemContext  string `json:"systemContext"`
	RoutineID      string `json:"routineId"`
	AutoApprove    bool   `json:"autoApprove"`
}) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return nil, nil
	}

	var req struct {
		Message        string `json:"message"`
		ConversationID string `json:"conversationId"`
		SystemContext  string `json:"systemContext"`
		RoutineID      string `json:"routineId"`
		AutoApprove    bool   `json:"autoApprove"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return nil, nil
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		http.Error(w, `{"error":"message is required"}`, http.StatusBadRequest)
		return nil, nil
	}

	convID := req.ConversationID

	// For routine-scoped chats, find or create the linked conversation.
	if convID == "" && req.RoutineID != "" {
		err := db.QueryRowContext(r.Context(),
			`SELECT id FROM life_conversations WHERE user_id = $1 AND routine_id = $2 ORDER BY created_at DESC LIMIT 1`,
			userID, req.RoutineID,
		).Scan(&convID)
		if err == sql.ErrNoRows {
			convID = ""
		} else if err != nil {
			log.Printf("life: lookup routine conversation: %v", err)
		}
	}

	// Create conversation if needed.
	if convID == "" {
		convID = uuid.NewString()
		title := deriveConversationTitle(req.Message)
		var routineID *string
		if req.RoutineID != "" {
			routineID = &req.RoutineID
		}
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO life_conversations (id, user_id, title, routine_id) VALUES ($1, $2, $3, $4)`,
			convID, userID, title, routineID,
		); err != nil {
			log.Printf("life: create conversation for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to create conversation"}`, http.StatusInternalServerError)
			return nil, nil
		}
	} else {
		// Verify ownership.
		var owner string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM life_conversations WHERE id = $1`, convID,
		).Scan(&owner); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"conversation not found"}`, http.StatusNotFound)
				return nil, nil
			}
			http.Error(w, `{"error":"failed to look up conversation"}`, http.StatusInternalServerError)
			return nil, nil
		}
		if owner != userID {
			http.Error(w, `{"error":"conversation not found"}`, http.StatusNotFound)
			return nil, nil
		}
	}

	// Load last 50 messages as history. Include tool_calls summary for assistant
	// messages so the LLM knows what tools were previously used (prevents hallucination).
	const histQ = `
		SELECT role, content, tool_calls FROM life_messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
		LIMIT 50`
	histRows, err := db.QueryContext(r.Context(), histQ, convID)
	if err != nil {
		http.Error(w, `{"error":"failed to load conversation history"}`, http.StatusInternalServerError)
		return nil, nil
	}
	var history []life.Message
	for histRows.Next() {
		var m life.Message
		var toolCallsRaw sql.NullString
		if err := histRows.Scan(&m.Role, &m.Content, &toolCallsRaw); err != nil {
			histRows.Close()
			http.Error(w, `{"error":"failed to read history"}`, http.StatusInternalServerError)
			return nil, nil
		}
		// For assistant messages with tool calls, append a summary so the LLM
		// knows what actions were taken (and doesn't hallucinate repeating them).
		if m.Role == "assistant" && toolCallsRaw.Valid && toolCallsRaw.String != "" {
			var effects []struct {
				Tool string         `json:"tool"`
				Data map[string]any `json:"data,omitempty"`
			}
			if json.Unmarshal([]byte(toolCallsRaw.String), &effects) == nil && len(effects) > 0 {
				var summary strings.Builder
				summary.WriteString("\n[Tools used in this response: ")
				for i, eff := range effects {
					if i > 0 {
						summary.WriteString(", ")
					}
					summary.WriteString(eff.Tool)
				}
				summary.WriteString("]")
				m.Content += summary.String()
			}
		}
		history = append(history, m)
	}
	histRows.Close()
	if err := histRows.Err(); err != nil {
		http.Error(w, `{"error":"failed to iterate history"}`, http.StatusInternalServerError)
		return nil, nil
	}

	// Load active memories.
	const memQ = `
		SELECT id, category, content FROM life_memories
		WHERE user_id = $1 AND active = TRUE
		ORDER BY created_at DESC`
	memRows, err := db.QueryContext(r.Context(), memQ, userID)
	if err != nil {
		http.Error(w, `{"error":"failed to load memories"}`, http.StatusInternalServerError)
		return nil, nil
	}
	var memories []life.Memory
	for memRows.Next() {
		var m life.Memory
		if err := memRows.Scan(&m.ID, &m.Category, &m.Content); err != nil {
			memRows.Close()
			http.Error(w, `{"error":"failed to read memories"}`, http.StatusInternalServerError)
			return nil, nil
		}
		memories = append(memories, m)
	}
	memRows.Close()
	if err := memRows.Err(); err != nil {
		http.Error(w, `{"error":"failed to iterate memories"}`, http.StatusInternalServerError)
		return nil, nil
	}

	// Load (or initialise) the user profile.
	if _, err := db.ExecContext(r.Context(),
		`INSERT INTO life_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
		userID,
	); err != nil {
		log.Printf("life: ensure profile for %s: %v", userID, err)
	}

	var profile life.Profile
	var wakeTime, sleepTime sql.NullString
	if err := db.QueryRowContext(r.Context(),
		`SELECT timezone, wake_time, sleep_time FROM life_profiles WHERE user_id = $1`, userID,
	).Scan(&profile.Timezone, &wakeTime, &sleepTime); err != nil && err != sql.ErrNoRows {
		log.Printf("life: load profile for %s: %v", userID, err)
	}
	if wakeTime.Valid {
		profile.WakeTime = wakeTime.String
	}
	if sleepTime.Valid {
		profile.SleepTime = sleepTime.String
	}

	// Save the user message.
	userMsgID := uuid.NewString()
	if _, err := db.ExecContext(r.Context(),
		`INSERT INTO life_messages (id, conversation_id, user_id, role, content)
		 VALUES ($1, $2, $3, 'user', $4)`,
		userMsgID, convID, userID, req.Message,
	); err != nil {
		log.Printf("life: save user message: %v", err)
		http.Error(w, `{"error":"failed to save message"}`, http.StatusInternalServerError)
		return nil, nil
	}

	// Load active routines (summary only for system prompt).
	const routineQ = `
		SELECT id, name, type, description
		FROM life_routines
		WHERE user_id = $1 AND active = TRUE
		ORDER BY created_at DESC`
	routineRows, err := db.QueryContext(r.Context(), routineQ, userID)
	if err != nil {
		http.Error(w, `{"error":"failed to load routines"}`, http.StatusInternalServerError)
		return nil, nil
	}
	var routines []life.Routine
	for routineRows.Next() {
		var rt life.Routine
		if err := routineRows.Scan(&rt.ID, &rt.Name, &rt.Type, &rt.Description); err != nil {
			routineRows.Close()
			http.Error(w, `{"error":"failed to read routines"}`, http.StatusInternalServerError)
			return nil, nil
		}
		routines = append(routines, rt)
	}
	routineRows.Close()
	if err := routineRows.Err(); err != nil {
		http.Error(w, `{"error":"failed to iterate routines"}`, http.StatusInternalServerError)
		return nil, nil
	}

	// Count pending actionables.
	var pendingActionablesCount int
	if err := db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM life_actionables WHERE user_id = $1 AND status = 'pending'`,
		userID,
	).Scan(&pendingActionablesCount); err != nil {
		log.Printf("life: count pending actionables for %s: %v", userID, err)
	}

	return &chatSetup{
		convID:    convID,
		userMsgID: userMsgID,
		chatReq: life.ChatRequest{
			UserID:                  userID,
			Message:                 req.Message,
			History:                 history,
			Memories:                memories,
			Profile:                 &profile,
			Routines:                routines,
			PendingActionablesCount: pendingActionablesCount,
			AutoApprove:            req.AutoApprove,
			SystemContext:           req.SystemContext,
		},
	}, &req
}

// buildEffects converts raw ToolEffects into the map slice the frontend expects,
// including loading full actionable records when applicable.
func buildEffects(ctx context.Context, db *sql.DB, chatResult *life.ChatResult) []map[string]any {
	var effects []map[string]any
	for _, eff := range chatResult.Effects {
		item := map[string]any{
			"tool": eff.Tool,
			"id":   eff.ID,
		}
		var parsed map[string]any
		if json.Unmarshal([]byte(eff.Result), &parsed) == nil {
			// Check if this effect produced an actionable (either directly via
			// create_actionable, or intercepted from a write tool when auto-approve is off).
			isActionable := parsed["actionable_id"] != nil && eff.ID != ""
			if isActionable {
				item["tool"] = "create_actionable" // normalize tool name for frontend
				var a struct {
					ID, Type, Status, Title, Description, ActionType string
					Options                                         sql.NullString
					CreatedAt                                       time.Time
				}
				if err := db.QueryRowContext(ctx,
					`SELECT id, type, status, title, description, action_type, options, created_at
					 FROM life_actionables WHERE id = $1`, eff.ID,
				).Scan(&a.ID, &a.Type, &a.Status, &a.Title, &a.Description, &a.ActionType, &a.Options, &a.CreatedAt); err == nil {
					actionableItem := map[string]any{
						"id": a.ID, "type": a.Type, "status": a.Status,
						"title": a.Title, "description": a.Description,
						"actionType": a.ActionType, "createdAt": a.CreatedAt.UTC().Format(time.RFC3339),
					}
					if a.Options.Valid {
						var opts any
						if json.Unmarshal([]byte(a.Options.String), &opts) == nil {
							actionableItem["options"] = opts
						}
					}
					item["actionable"] = actionableItem
				}
			}
			item["data"] = parsed
		}
		effects = append(effects, item)
	}
	return effects
}

// saveAssistantMessage persists the assistant's response and bumps the
// conversation's updated_at timestamp. Returns the saved message record.
func saveAssistantMessage(ctx context.Context, db *sql.DB, convID, userID, text string, toolCallsJSON []byte) (lifeMessageRecord, error) {
	assistantMsgID := uuid.NewString()
	var assistantCreatedAt time.Time

	var toolCallsArg any
	if len(toolCallsJSON) > 0 {
		toolCallsArg = string(toolCallsJSON)
	}

	if err := db.QueryRowContext(ctx,
		`INSERT INTO life_messages (id, conversation_id, user_id, role, content, tool_calls)
		 VALUES ($1, $2, $3, 'assistant', $4, $5)
		 RETURNING created_at`,
		assistantMsgID, convID, userID, text, toolCallsArg,
	).Scan(&assistantCreatedAt); err != nil {
		return lifeMessageRecord{}, err
	}

	if _, err := db.ExecContext(ctx,
		`UPDATE life_conversations SET updated_at = NOW() WHERE id = $1`, convID,
	); err != nil {
		log.Printf("life: update conversation timestamp %s: %v", convID, err)
	}

	rec := lifeMessageRecord{
		ID:             assistantMsgID,
		ConversationID: convID,
		UserID:         userID,
		Role:           "assistant",
		Content:        text,
		CreatedAt:      assistantCreatedAt.UTC().Format(time.RFC3339),
	}
	if len(toolCallsJSON) > 0 {
		rec.ToolCalls = json.RawMessage(toolCallsJSON)
	}
	return rec, nil
}

// LifeChatStream handles POST /life/chat/stream using Server-Sent Events.
// Tokens are streamed to the client as they arrive; the final SSE event
// contains the persisted assistant message record.
func LifeChatStream(db *sql.DB, agent *life.Agent, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Prepare — this writes its own errors on failure.
		setup, _ := prepareChatRequest(w, r, db)
		if setup == nil {
			return
		}

		// Attach upcoming calendar events to the chat request (best-effort).
		setup.chatReq.CalendarEvents = loadCalendarEventsForChat(r.Context(), db, gcalClient, setup.chatReq.UserID)

		// Switch to SSE.
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, `{"error":"streaming not supported"}`, http.StatusInternalServerError)
			return
		}

		sendEvent := func(event life.StreamEvent) {
			data, _ := json.Marshal(event)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}

		chatResult, err := agent.ChatStream(r.Context(), setup.chatReq, sendEvent)
		if err != nil {
			log.Printf("life: agent chat stream error for %s: %v", setup.chatReq.UserID, err)
			errData, _ := json.Marshal(life.StreamEvent{Type: "error", Data: "failed to get response from assistant"})
			fmt.Fprintf(w, "data: %s\n\n", errData)
			flusher.Flush()
			return
		}

		effects := buildEffects(r.Context(), db, chatResult)

		var toolCallsJSON []byte
		if len(effects) > 0 {
			toolCallsJSON, _ = json.Marshal(effects)
		}

		respMsg, err := saveAssistantMessage(r.Context(), db, setup.convID, setup.chatReq.UserID, chatResult.Text, toolCallsJSON)
		if err != nil {
			log.Printf("life: save assistant message (stream): %v", err)
			errData, _ := json.Marshal(life.StreamEvent{Type: "error", Data: "failed to save assistant response"})
			fmt.Fprintf(w, "data: %s\n\n", errData)
			flusher.Flush()
			return
		}

		// Send the final save event — includes conversationId, message record,
		// and effects so the frontend can update its state identically to the
		// non-streaming path.
		finalPayload := map[string]any{
			"conversationId": setup.convID,
			"message":        respMsg,
		}
		if len(effects) > 0 {
			finalPayload["effects"] = effects
		}
		finalData, _ := json.Marshal(finalPayload)
		fmt.Fprintf(w, "data: %s\n\n", finalData)
		flusher.Flush()
	}
}

// deriveConversationTitle produces a short title from the opening message.
// It takes up to the first 50 characters, stopping at a word boundary.
func deriveConversationTitle(msg string) string {
	msg = strings.TrimSpace(msg)
	if len(msg) <= 50 {
		return msg
	}
	// Trim to 50 chars at a word boundary.
	truncated := msg[:50]
	if idx := strings.LastIndex(truncated, " "); idx > 10 {
		truncated = truncated[:idx]
	}
	return truncated + "..."
}

// ----- actionables -----

// lifeActionableRecord is the JSON representation of a life_actionables row.
type lifeActionableRecord struct {
	ID            string          `json:"id"`
	UserID        string          `json:"userId"`
	Type          string          `json:"type"`
	Status        string          `json:"status"`
	Title         string          `json:"title"`
	Description   string          `json:"description"`
	Options       json.RawMessage `json:"options,omitempty"`
	Response      json.RawMessage `json:"response,omitempty"`
	DueAt         *string         `json:"dueAt,omitempty"`
	SnoozedUntil  *string         `json:"snoozedUntil,omitempty"`
	RoutineID     *string         `json:"routineId,omitempty"`
	ActionType    string          `json:"actionType"`
	ActionPayload json.RawMessage `json:"actionPayload,omitempty"`
	CreatedAt     string          `json:"createdAt"`
	ResolvedAt    *string         `json:"resolvedAt,omitempty"`
}

// ListLifeActionables handles GET /life/actionables?status=pending.
// Returns actionables for the authenticated user filtered by status (default: pending).
func ListLifeActionables(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		status := r.URL.Query().Get("status")

		var rows *sql.Rows
		var err error
		if status != "" {
			rows, err = db.QueryContext(r.Context(), `
				SELECT id, user_id, type, status, title, description,
				       options, response, due_at, snoozed_until, routine_id,
				       action_type, action_payload, created_at, resolved_at
				FROM life_actionables
				WHERE user_id = $1 AND status = $2
				ORDER BY created_at DESC
				LIMIT 100`, userID, status)
		} else {
			rows, err = db.QueryContext(r.Context(), `
				SELECT id, user_id, type, status, title, description,
				       options, response, due_at, snoozed_until, routine_id,
				       action_type, action_payload, created_at, resolved_at
				FROM life_actionables
				WHERE user_id = $1
				ORDER BY created_at DESC
				LIMIT 100`, userID)
		}
		if err != nil {
			http.Error(w, `{"error":"failed to list actionables"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		actionables := make([]lifeActionableRecord, 0)
		for rows.Next() {
			var a lifeActionableRecord
			var options, response, actionPayload []byte
			var dueAt, snoozedUntil sql.NullTime
			var routineID, actionType sql.NullString
			var createdAt time.Time
			var resolvedAt sql.NullTime

			if err := rows.Scan(
				&a.ID, &a.UserID, &a.Type, &a.Status, &a.Title, &a.Description,
				&options, &response, &dueAt, &snoozedUntil, &routineID,
				&actionType, &actionPayload, &createdAt, &resolvedAt,
			); err != nil {
				http.Error(w, `{"error":"failed to read actionable"}`, http.StatusInternalServerError)
				return
			}

			if len(options) > 0 {
				a.Options = json.RawMessage(options)
			}
			if len(response) > 0 {
				a.Response = json.RawMessage(response)
			}
			if dueAt.Valid {
				s := dueAt.Time.UTC().Format(time.RFC3339)
				a.DueAt = &s
			}
			if snoozedUntil.Valid {
				s := snoozedUntil.Time.UTC().Format(time.RFC3339)
				a.SnoozedUntil = &s
			}
			if routineID.Valid {
				a.RoutineID = &routineID.String
			}
			if actionType.Valid {
				a.ActionType = actionType.String
			}
			if len(actionPayload) > 0 {
				a.ActionPayload = json.RawMessage(actionPayload)
			}
			a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			if resolvedAt.Valid {
				s := resolvedAt.Time.UTC().Format(time.RFC3339)
				a.ResolvedAt = &s
			}

			actionables = append(actionables, a)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate actionables"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"actionables": actionables})
	}
}

// RespondToActionable handles POST /life/actionables/{id}/respond.
// Body: {"action": "confirm"|"dismiss"|"snooze"|"choose"|"input", "data": any}
func RespondToActionable(db *sql.DB, agent *life.Agent) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		actionableID := chi.URLParam(r, "id")

		var req struct {
			Action string `json:"action"`
			Data   any    `json:"data"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if req.Action == "" {
			http.Error(w, `{"error":"action is required"}`, http.StatusBadRequest)
			return
		}

		// Determine the new status and whether to set resolved_at.
		var newStatus string
		var setResolvedAt bool
		switch req.Action {
		case "confirm", "choose", "input":
			newStatus = "confirmed"
			setResolvedAt = true
		case "dismiss":
			newStatus = "dismissed"
			setResolvedAt = true
		case "snooze":
			newStatus = "snoozed"
		default:
			http.Error(w, `{"error":"unknown action"}`, http.StatusBadRequest)
			return
		}

		// Encode response data as JSONB.
		responseData := map[string]any{"action": req.Action, "data": req.Data}
		responseJSON, err := json.Marshal(responseData)
		if err != nil {
			http.Error(w, `{"error":"failed to encode response"}`, http.StatusInternalServerError)
			return
		}

		// For snooze, extract the until timestamp.
		var snoozedUntil *time.Time
		if req.Action == "snooze" {
			if dataMap, ok := req.Data.(map[string]any); ok {
				if untilStr, ok := dataMap["until"].(string); ok {
					if t, err := time.Parse(time.RFC3339, untilStr); err == nil {
						snoozedUntil = &t
					}
				}
			}
			if snoozedUntil == nil {
				http.Error(w, `{"error":"snooze requires data.until (RFC3339)"}`, http.StatusBadRequest)
				return
			}
		}

		// Build the UPDATE query.
		var updateErr error
		var updatedStatus string
		if setResolvedAt {
			updateErr = db.QueryRowContext(r.Context(),
				`UPDATE life_actionables
				 SET status = $1, response = $2, resolved_at = NOW()
				 WHERE id = $3 AND user_id = $4
				 RETURNING status`,
				newStatus, string(responseJSON), actionableID, userID,
			).Scan(&updatedStatus)
		} else {
			// snooze path
			updateErr = db.QueryRowContext(r.Context(),
				`UPDATE life_actionables
				 SET status = $1, response = $2, snoozed_until = $3
				 WHERE id = $4 AND user_id = $5
				 RETURNING status`,
				newStatus, string(responseJSON), snoozedUntil, actionableID, userID,
			).Scan(&updatedStatus)
		}

		if updateErr != nil {
			if updateErr == sql.ErrNoRows {
				http.Error(w, `{"error":"actionable not found"}`, http.StatusNotFound)
				return
			}
			log.Printf("life: respond to actionable %s: %v", actionableID, updateErr)
			http.Error(w, `{"error":"failed to update actionable"}`, http.StatusInternalServerError)
			return
		}

		// If confirmed and there's a pending action, execute it (legacy deferred actions).
		if req.Action == "confirm" || req.Action == "choose" {
			var actionType sql.NullString
			var actionPayload sql.NullString
			if err := db.QueryRowContext(r.Context(),
				`SELECT action_type, action_payload FROM life_actionables WHERE id = $1`,
				actionableID,
			).Scan(&actionType, &actionPayload); err == nil && actionType.Valid && actionType.String != "" && actionType.String != "none" {
				executeActionableAction(r.Context(), db, agent.GCalClient(), userID, actionType.String, actionPayload.String)
			}
		}

		// Feed the response to the agent so it can take follow-up actions
		// (update calendar, create tasks, etc.). Run in background so we
		// don't block the HTTP response.
		if req.Action != "dismiss" {
			go func() {
				// Load actionable details for the agent
				var title, aType string
				_ = db.QueryRowContext(context.Background(),
					`SELECT title, type FROM life_actionables WHERE id = $1`,
					actionableID,
				).Scan(&title, &aType)

				responseStr, _ := json.Marshal(responseData)
				if err := agent.ProcessActionableResponse(
					context.Background(), db, userID,
					life.ActionableRecord{ID: actionableID, Type: aType, Title: title},
					string(responseStr),
				); err != nil {
					log.Printf("life: process actionable response %s: %v", actionableID, err)
				}
			}()
		}

		json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"status":  updatedStatus,
		})
	}
}

// executeActionableAction handles deferred actions stored in actionables.
// Called when a user confirms or selects an option on an actionable that has a pending action.
func executeActionableAction(ctx context.Context, db *sql.DB, gcalClient *life.GCalClient, userID, actionType, payloadJSON string) {
	switch actionType {
	case "create_routine":
		var payload struct {
			Name        string          `json:"name"`
			Type        string          `json:"type"`
			Description string          `json:"description"`
			Schedule    json.RawMessage `json:"schedule"`
			Config      json.RawMessage `json:"config"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
			log.Printf("life: execute action create_routine: unmarshal: %v", err)
			return
		}
		if payload.Name == "" || payload.Type == "" {
			log.Printf("life: execute action create_routine: missing name or type")
			return
		}
		schedStr := "{}"
		if len(payload.Schedule) > 0 {
			schedStr = string(payload.Schedule)
		}
		cfgStr := "{}"
		if len(payload.Config) > 0 {
			cfgStr = string(payload.Config)
		}
		id := uuid.NewString()
		if _, err := db.ExecContext(ctx,
			`INSERT INTO life_routines (id, user_id, name, type, description, schedule, config)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			id, userID, payload.Name, payload.Type, payload.Description, schedStr, cfgStr,
		); err != nil {
			log.Printf("life: execute action create_routine: insert: %v", err)
			return
		}
		log.Printf("life: executed action create_routine: routine %s for user %s", id, userID)

	case "create_memory":
		var payload struct {
			Content  string `json:"content"`
			Category string `json:"category"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
			log.Printf("life: execute action create_memory: unmarshal: %v", err)
			return
		}
		if payload.Content == "" {
			return
		}
		if payload.Category == "" {
			payload.Category = "fact"
		}
		id := uuid.NewString()
		if _, err := db.ExecContext(ctx,
			`INSERT INTO life_memories (id, user_id, content, category, source)
			 VALUES ($1, $2, $3, $4, 'agent_inferred')`,
			id, userID, payload.Content, payload.Category,
		); err != nil {
			log.Printf("life: execute action create_memory: insert: %v", err)
		}

	case "create_calendar_event":
		if gcalClient == nil {
			log.Printf("life: execute action create_calendar_event: gcal not configured")
			return
		}
		var payload struct {
			Summary     string `json:"summary"`
			Description string `json:"description"`
			Location    string `json:"location"`
			Start       string `json:"start"`
			End         string `json:"end"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
			log.Printf("life: execute action create_calendar_event: unmarshal: %v", err)
			return
		}
		startTime, err := time.Parse(time.RFC3339, payload.Start)
		if err != nil {
			log.Printf("life: execute action create_calendar_event: parse start: %v", err)
			return
		}
		endTime, err := time.Parse(time.RFC3339, payload.End)
		if err != nil {
			log.Printf("life: execute action create_calendar_event: parse end: %v", err)
			return
		}
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			log.Printf("life: execute action create_calendar_event: token: %v", err)
			return
		}
		ev, err := gcalClient.CreateEvent(ctx, accessToken, life.CreateEventRequest{
			Summary: payload.Summary, Description: payload.Description,
			Location: payload.Location, StartTime: startTime, EndTime: endTime,
		})
		if err != nil {
			log.Printf("life: execute action create_calendar_event: create: %v", err)
			return
		}
		log.Printf("life: executed action create_calendar_event: event %s for user %s", ev.ID, userID)

	case "delete_calendar_event":
		if gcalClient == nil {
			return
		}
		var payload struct {
			EventID string `json:"event_id"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.EventID == "" {
			log.Printf("life: execute action delete_calendar_event: bad payload")
			return
		}
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			log.Printf("life: execute action delete_calendar_event: token: %v", err)
			return
		}
		if err := gcalClient.DeleteEvent(ctx, accessToken, payload.EventID); err != nil {
			log.Printf("life: execute action delete_calendar_event: %v", err)
			return
		}
		_, _ = db.ExecContext(ctx, `DELETE FROM life_gcal_events WHERE user_id = $1 AND id = $2`, userID, payload.EventID)
		log.Printf("life: executed action delete_calendar_event: %s for user %s", payload.EventID, userID)

	case "create_task":
		var payload struct {
			Title  string `json:"title"`
			Notes  string `json:"notes"`
			Due    string `json:"due"`
			ListID string `json:"list_id"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.Title == "" {
			log.Printf("life: execute action create_task: bad payload")
			return
		}
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			log.Printf("life: execute action create_task: token: %v", err)
			return
		}
		listID := payload.ListID
		if listID == "" {
			lists, err := life.ListTaskLists(ctx, accessToken)
			if err != nil || len(lists) == 0 {
				log.Printf("life: execute action create_task: no task lists")
				return
			}
			listID = lists[0].ID
		}
		due := payload.Due
		if due != "" && len(due) == 10 {
			due = due + "T00:00:00.000Z"
		}
		if _, err := life.CreateTask(ctx, accessToken, listID, life.GTask{Title: payload.Title, Notes: payload.Notes, Due: due}); err != nil {
			log.Printf("life: execute action create_task: %v", err)
			return
		}
		log.Printf("life: executed action create_task: %q for user %s", payload.Title, userID)

	case "update_routine":
		var payload struct {
			RoutineID   string          `json:"routine_id"`
			Name        string          `json:"name"`
			Description string          `json:"description"`
			Schedule    json.RawMessage `json:"schedule"`
			Config      json.RawMessage `json:"config"`
			Active      *bool           `json:"active"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.RoutineID == "" {
			log.Printf("life: execute action update_routine: bad payload")
			return
		}
		sets := []string{}
		params := []any{}
		idx := 1
		if payload.Name != "" {
			sets = append(sets, fmt.Sprintf("name = $%d", idx)); params = append(params, payload.Name); idx++
		}
		if payload.Description != "" {
			sets = append(sets, fmt.Sprintf("description = $%d", idx)); params = append(params, payload.Description); idx++
		}
		if len(payload.Schedule) > 0 {
			sets = append(sets, fmt.Sprintf("schedule = $%d", idx)); params = append(params, string(payload.Schedule)); idx++
		}
		if len(payload.Config) > 0 {
			sets = append(sets, fmt.Sprintf("config = $%d", idx)); params = append(params, string(payload.Config)); idx++
		}
		if payload.Active != nil {
			sets = append(sets, fmt.Sprintf("active = $%d", idx)); params = append(params, *payload.Active); idx++
		}
		if len(sets) == 0 {
			return
		}
		sets = append(sets, "updated_at = NOW()")
		params = append(params, payload.RoutineID, userID)
		q := fmt.Sprintf("UPDATE life_routines SET %s WHERE id = $%d AND user_id = $%d", strings.Join(sets, ", "), idx, idx+1)
		if _, err := db.ExecContext(ctx, q, params...); err != nil {
			log.Printf("life: execute action update_routine: %v", err)
		}

	case "delete_routine":
		var payload struct {
			RoutineID string `json:"routine_id"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.RoutineID == "" {
			return
		}
		db.ExecContext(ctx, `UPDATE life_routines SET active = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2`, payload.RoutineID, userID)

	case "update_calendar_event":
		if gcalClient == nil {
			return
		}
		var payload struct {
			EventID     string `json:"event_id"`
			Summary     string `json:"summary"`
			Description string `json:"description"`
			Location    string `json:"location"`
			Start       string `json:"start"`
			End         string `json:"end"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.EventID == "" {
			return
		}
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			return
		}
		req := life.CreateEventRequest{Summary: payload.Summary, Description: payload.Description, Location: payload.Location}
		if payload.Start != "" {
			if t, e := time.Parse(time.RFC3339, payload.Start); e == nil { req.StartTime = t }
		}
		if payload.End != "" {
			if t, e := time.Parse(time.RFC3339, payload.End); e == nil { req.EndTime = t }
		}
		gcalClient.UpdateEvent(ctx, accessToken, payload.EventID, req)

	case "update_task":
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			return
		}
		var payload struct {
			TaskID string `json:"task_id"`
			Title  string `json:"title"`
			Notes  string `json:"notes"`
			Due    string `json:"due"`
			Status string `json:"status"`
			ListID string `json:"list_id"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.TaskID == "" {
			return
		}
		listID := payload.ListID
		if listID == "" {
			if lists, err := life.ListTaskLists(ctx, accessToken); err == nil && len(lists) > 0 {
				listID = lists[0].ID
			}
		}
		if listID == "" {
			return
		}
		update := life.GTask{Title: payload.Title, Notes: payload.Notes, Status: payload.Status}
		if payload.Due != "" {
			if len(payload.Due) == 10 { payload.Due += "T00:00:00.000Z" }
			update.Due = payload.Due
		}
		life.UpdateTask(ctx, accessToken, listID, payload.TaskID, update)

	case "delete_task":
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			return
		}
		var payload struct {
			TaskID string `json:"task_id"`
			ListID string `json:"list_id"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.TaskID == "" {
			return
		}
		listID := payload.ListID
		if listID == "" {
			if lists, err := life.ListTaskLists(ctx, accessToken); err == nil && len(lists) > 0 {
				listID = lists[0].ID
			}
		}
		if listID != "" {
			life.DeleteTask(ctx, accessToken, listID, payload.TaskID)
		}

	case "complete_task":
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			return
		}
		var payload struct {
			TaskID string `json:"task_id"`
			ListID string `json:"list_id"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.TaskID == "" {
			return
		}
		listID := payload.ListID
		if listID == "" {
			if lists, err := life.ListTaskLists(ctx, accessToken); err == nil && len(lists) > 0 {
				listID = lists[0].ID
			}
		}
		if listID != "" {
			life.CompleteTask(ctx, accessToken, listID, payload.TaskID)
		}

	case "create_task_list":
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			return
		}
		var payload struct {
			Title string `json:"title"`
		}
		if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil || payload.Title == "" {
			return
		}
		if _, err := life.CreateTaskList(ctx, accessToken, payload.Title); err != nil {
			log.Printf("life: execute action create_task_list: %v", err)
		}

	default:
		log.Printf("life: unknown action_type %q", actionType)
	}
}

// ----- routines -----

// lifeRoutineRecord is the JSON representation of a life_routines row.
type lifeRoutineRecord struct {
	ID            string          `json:"id"`
	UserID        string          `json:"userId"`
	Name          string          `json:"name"`
	Type          string          `json:"type"`
	Description   string          `json:"description"`
	Schedule      json.RawMessage `json:"schedule"`
	Config        json.RawMessage `json:"config"`
	Active        bool            `json:"active"`
	LastTriggered *string         `json:"lastTriggered"`
	CreatedAt     string          `json:"createdAt"`
	UpdatedAt     string          `json:"updatedAt"`
}

// ListLifeRoutines handles GET /life/routines.
// Returns all active routines for the authenticated user.
// GetLifeRoutine handles GET /life/routines/{id}.
func GetLifeRoutine(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		routineID := chi.URLParam(r, "id")

		var rec lifeRoutineRecord
		var createdAt, updatedAt time.Time
		var lastTriggered sql.NullTime
		var schedule, config sql.NullString
		if err := db.QueryRowContext(r.Context(),
			`SELECT id, user_id, name, type, description, schedule, config, active, last_triggered, created_at, updated_at
			 FROM life_routines WHERE id = $1 AND user_id = $2`,
			routineID, userID,
		).Scan(&rec.ID, &rec.UserID, &rec.Name, &rec.Type, &rec.Description,
			&schedule, &config, &rec.Active, &lastTriggered, &createdAt, &updatedAt); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"routine not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"failed to look up routine"}`, http.StatusInternalServerError)
			return
		}
		rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if lastTriggered.Valid {
			v := lastTriggered.Time.UTC().Format(time.RFC3339)
			rec.LastTriggered = &v
		}
		if schedule.Valid {
			rec.Schedule = json.RawMessage(schedule.String)
		}
		if config.Valid {
			rec.Config = json.RawMessage(config.String)
		}

		json.NewEncoder(w).Encode(map[string]any{"routine": rec})
	}
}

func ListLifeRoutines(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, user_id, name, type, description, schedule, config, active, created_at, updated_at
			FROM life_routines
			WHERE user_id = $1 AND active = TRUE
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list routines"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		routines := make([]lifeRoutineRecord, 0)
		for rows.Next() {
			var rec lifeRoutineRecord
			var schedule, config []byte
			var createdAt, updatedAt time.Time
			if err := rows.Scan(
				&rec.ID, &rec.UserID, &rec.Name, &rec.Type, &rec.Description,
				&schedule, &config, &rec.Active, &createdAt, &updatedAt,
			); err != nil {
				http.Error(w, `{"error":"failed to read routine"}`, http.StatusInternalServerError)
				return
			}
			rec.Schedule = json.RawMessage(schedule)
			rec.Config = json.RawMessage(config)
			rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			routines = append(routines, rec)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate routines"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"routines": routines})
	}
}

// CreateLifeRoutine handles POST /life/routines.
// Body: {name, type, description?, schedule?, config?}
func CreateLifeRoutine(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Name        string          `json:"name"`
			Type        string          `json:"type"`
			Description string          `json:"description"`
			Schedule    json.RawMessage `json:"schedule"`
			Config      json.RawMessage `json:"config"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
			return
		}
		req.Type = strings.TrimSpace(req.Type)
		if req.Type == "" {
			http.Error(w, `{"error":"type is required"}`, http.StatusBadRequest)
			return
		}
		if len(req.Schedule) == 0 {
			req.Schedule = json.RawMessage(`{}`)
		}
		if len(req.Config) == 0 {
			req.Config = json.RawMessage(`{}`)
		}

		id := uuid.NewString()
		const q = `
			INSERT INTO life_routines (id, user_id, name, type, description, schedule, config)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, user_id, name, type, description, schedule, config, active, created_at, updated_at`

		var rec lifeRoutineRecord
		var schedule, config []byte
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			id, userID, req.Name, req.Type, req.Description, []byte(req.Schedule), []byte(req.Config),
		).Scan(
			&rec.ID, &rec.UserID, &rec.Name, &rec.Type, &rec.Description,
			&schedule, &config, &rec.Active, &createdAt, &updatedAt,
		); err != nil {
			log.Printf("life: create routine for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to create routine"}`, http.StatusInternalServerError)
			return
		}
		rec.Schedule = json.RawMessage(schedule)
		rec.Config = json.RawMessage(config)
		rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"routine": rec})
	}
}

// UpdateLifeRoutine handles PUT /life/routines/{id}.
// Body: partial update of name, description, schedule, config, active.
func UpdateLifeRoutine(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		routineID := chi.URLParam(r, "id")

		var req struct {
			Name        *string         `json:"name"`
			Description *string         `json:"description"`
			Schedule    json.RawMessage `json:"schedule"`
			Config      json.RawMessage `json:"config"`
			Active      *bool           `json:"active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		const q = `
			UPDATE life_routines
			SET name        = COALESCE($1, name),
			    description = COALESCE($2, description),
			    schedule    = CASE WHEN $3::jsonb IS NOT NULL THEN $3::jsonb ELSE schedule END,
			    config      = CASE WHEN $4::jsonb IS NOT NULL THEN $4::jsonb ELSE config END,
			    active      = COALESCE($5, active),
			    updated_at  = NOW()
			WHERE id = $6 AND user_id = $7
			RETURNING id, user_id, name, type, description, schedule, config, active, created_at, updated_at`

		var scheduleParam, configParam interface{}
		if len(req.Schedule) > 0 {
			scheduleParam = []byte(req.Schedule)
		}
		if len(req.Config) > 0 {
			configParam = []byte(req.Config)
		}

		var rec lifeRoutineRecord
		var schedule, config []byte
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			req.Name, req.Description, scheduleParam, configParam, req.Active,
			routineID, userID,
		).Scan(
			&rec.ID, &rec.UserID, &rec.Name, &rec.Type, &rec.Description,
			&schedule, &config, &rec.Active, &createdAt, &updatedAt,
		); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"routine not found"}`, http.StatusNotFound)
				return
			}
			log.Printf("life: update routine %s: %v", routineID, err)
			http.Error(w, `{"error":"failed to update routine"}`, http.StatusInternalServerError)
			return
		}
		rec.Schedule = json.RawMessage(schedule)
		rec.Config = json.RawMessage(config)
		rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"routine": rec})
	}
}

// DeleteLifeRoutine handles DELETE /life/routines/{id}.
// Soft-deletes by setting active = FALSE.
func DeleteLifeRoutine(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		routineID := chi.URLParam(r, "id")

		res, err := db.ExecContext(r.Context(),
			`UPDATE life_routines SET active = FALSE, updated_at = NOW()
			 WHERE id = $1 AND user_id = $2`,
			routineID, userID,
		)
		if err != nil {
			log.Printf("life: delete routine %s: %v", routineID, err)
			http.Error(w, `{"error":"failed to delete routine"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"routine not found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}
