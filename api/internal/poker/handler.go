package poker

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/n1rna/1tt/api/internal/middleware"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// disconnectGracePeriod is how long a disconnected participant's record is
// retained before being permanently removed from the session.
const disconnectGracePeriod = 60 * time.Second

// ---------------------------------------------------------------------------
// POST /poker/sessions  (authenticated)
// ---------------------------------------------------------------------------

type createSessionRequest struct {
	Name  string      `json:"name"`
	Scale VotingScale `json:"scale"`
}

type createSessionResponse struct {
	SessionID  string `json:"sessionId"`
	OwnerToken string `json:"ownerToken"`
}

// HandleCreateSession creates a new planning-poker session.
func HandleCreateSession(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		var req createSessionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}

		scale := resolveScale(req.Scale)

		sessionID, ownerToken, err := hub.CreateSession(req.Name, userID, scale)
		if err != nil {
			log.Printf("poker: HandleCreateSession error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create session"})
			return
		}
		writeJSON(w, http.StatusOK, createSessionResponse{SessionID: sessionID, OwnerToken: ownerToken})
	}
}

// ---------------------------------------------------------------------------
// GET /api/v1/poker/check?session=ID  (public)
// ---------------------------------------------------------------------------

// HandleCheckSession returns whether a session exists and is joinable.
func HandleCheckSession(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("session")
		if id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "session parameter is required"})
			return
		}

		s, err := hub.GetSessionMeta(id)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusOK, map[string]interface{}{"exists": false})
			return
		}
		if err != nil {
			log.Printf("poker: HandleCheckSession error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if s.status == "archived" {
			writeJSON(w, http.StatusOK, map[string]interface{}{"exists": false})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"exists":   true,
			"disabled": s.status == "disabled",
			"name":     s.name,
		})
	}
}

// ---------------------------------------------------------------------------
// GET /poker/sessions  (authenticated)
// ---------------------------------------------------------------------------

// HandleListSessions returns all sessions owned by the authenticated user.
func HandleListSessions(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		sessions, err := hub.ListSessionsByOwner(userID)
		if err != nil {
			log.Printf("poker: HandleListSessions error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list sessions"})
			return
		}
		if sessions == nil {
			sessions = []SessionSummary{}
		}
		writeJSON(w, http.StatusOK, sessions)
	}
}

// ---------------------------------------------------------------------------
// POST /poker/sessions/{id}/disable  (authenticated)
// ---------------------------------------------------------------------------

// HandleDisableSession disables a session so no new participants can join.
func HandleDisableSession(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "session id required"})
			return
		}

		ok, err := hub.DisableSession(id, userID)
		if err != nil {
			log.Printf("poker: HandleDisableSession error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "session not found or not owned by you"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "disabled"})
	}
}

// ---------------------------------------------------------------------------
// POST /poker/sessions/{id}/enable  (authenticated)
// ---------------------------------------------------------------------------

// HandleEnableSession re-enables a disabled session.
func HandleEnableSession(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "session id required"})
			return
		}

		ok, err := hub.EnableSession(id, userID)
		if err != nil {
			log.Printf("poker: HandleEnableSession error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "session not found or not owned by you"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "enabled"})
	}
}

// ---------------------------------------------------------------------------
// DELETE /poker/sessions/{id}  (authenticated)
// ---------------------------------------------------------------------------

// HandleDeleteSession soft-deletes a session (status = archived).
func HandleDeleteSession(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "session id required"})
			return
		}

		ok, err := hub.DeleteSession(id, userID)
		if err != nil {
			log.Printf("poker: HandleDeleteSession error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "session not found or not owned by you"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

// ---------------------------------------------------------------------------
// GET /api/v1/poker/ws  (public WebSocket)
// ---------------------------------------------------------------------------

// HandleWebSocket upgrades to WebSocket and runs the read loop.
//
// Query parameters:
//   - session     (required) session ID
//   - name        (required for new joins) display name
//   - reconnectId (optional) token from a previous connection
//   - ownerToken  (optional) secret that grants the owner role
func HandleWebSocket(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID := r.URL.Query().Get("session")
		name := r.URL.Query().Get("name")
		reconnectID := r.URL.Query().Get("reconnectId")
		ownerToken := r.URL.Query().Get("ownerToken")

		if sessionID == "" {
			http.Error(w, "session parameter is required", http.StatusBadRequest)
			return
		}

		// Check session exists in DB and is not archived/disabled.
		s, err := hub.GetSessionMeta(sessionID)
		if err == sql.ErrNoRows || (err == nil && s.status == "archived") {
			http.Error(w, "session not found", http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("poker: HandleWebSocket get session meta error: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if s.status == "disabled" {
			http.Error(w, "session is disabled", http.StatusForbidden)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("poker: websocket upgrade error session=%s: %v", sessionID, err)
			return
		}

		var participantID string
		var isOwner bool

		if reconnectID != "" {
			// Attempt to reconnect.
			pid, pname, powner, ok := hub.ReconnectParticipant(sessionID, reconnectID, conn)
			if ok {
				participantID = pid
				isOwner = powner
				_ = pname // kept for logging clarity

				// Send current state to the reconnecting client only.
				state, buildErr := hub.BuildSessionState(sessionID)
				if buildErr == nil {
					_ = conn.WriteJSON(ServerMessage{Type: "state", Session: state})
				}
				hub.BroadcastSession(sessionID)
			} else {
				log.Printf("poker: reconnectId not found, treating as new join session=%s", sessionID)
			}
		}

		if participantID == "" {
			// Fresh join.
			if name == "" {
				_ = conn.WriteJSON(ServerMessage{Type: "error", Message: "name parameter is required"})
				_ = conn.Close()
				return
			}

			participantID = newID()
			newReconnectID := newID()

			// Verify ownerToken against the stored token.
			isOwner = ownerToken != "" && hub.VerifyOwnerToken(sessionID, ownerToken)

			hub.AddParticipant(sessionID, participantID, name, newReconnectID, conn, isOwner)

			state, buildErr := hub.BuildSessionState(sessionID)
			if buildErr != nil {
				log.Printf("poker: HandleWebSocket build state error: %v", buildErr)
				_ = conn.WriteJSON(ServerMessage{Type: "error", Message: "failed to load session state"})
				_ = conn.Close()
				return
			}
			_ = conn.WriteJSON(ServerMessage{
				Type:    "joined",
				Message: participantID + ":" + newReconnectID,
				Session: state,
			})
		}

		// Read loop — blocks until the connection closes.
		readMessages(conn, hub, sessionID, participantID, ownerToken)

		// Mark as disconnected and schedule cleanup after grace period.
		hub.RemoveParticipant(sessionID, participantID)
		go func() {
			time.Sleep(disconnectGracePeriod)
			if hub.IsStillDisconnected(sessionID, participantID) {
				hub.PurgeParticipant(sessionID, participantID)
				log.Printf("poker: participant purged after grace period session=%s id=%s", sessionID, participantID)
			}
		}()
	}
}

// readMessages is the per-connection read loop.
func readMessages(conn *websocket.Conn, hub *Hub, sessionID, participantID, ownerToken string) {
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure,
				websocket.CloseNoStatusReceived,
			) {
				log.Printf("poker: read error session=%s participant=%s: %v", sessionID, participantID, err)
			}
			return
		}

		var msg ClientMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			hub.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "invalid JSON"})
			continue
		}

		hub.HandleMessage(sessionID, participantID, ownerToken, msg)
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// resolveScale picks the correct VotingScale from the request, defaulting to
// Fibonacci when the type is unknown.
func resolveScale(s VotingScale) VotingScale {
	switch s.Type {
	case "custom":
		if len(s.Values) > 0 {
			return s
		}
		return ScaleFibonacci
	case "tshirt":
		return ScaleTShirt
	case "powers2":
		return ScalePowers2
	default:
		return ScaleFibonacci
	}
}

// writeJSON marshals v as JSON and writes it to w with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}
