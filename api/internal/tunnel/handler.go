package tunnel

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/n1rna/1tt/api/internal/middleware"
)

const (
	pingInterval   = 30 * time.Second
	queryTimeout   = 30 * time.Second
	wsReadLimit    = 4 * 1024 * 1024 // 4 MiB
	wsWriteTimeout = 10 * time.Second
)

var tunnelUpgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

// ---------------------------------------------------------------------------
// POST /api/v1/tunnel/create  (authenticated)
// ---------------------------------------------------------------------------

type createTokenResponse struct {
	Token string `json:"token"`
	WSURL string `json:"ws_url"`
}

// HandleCreateToken allocates a new tunnel token for the authenticated user.
//
//	POST /api/v1/tunnel/create
//
// Returns {"token": "...", "ws_url": "wss://api.1tt.dev/api/v1/tunnel/<token>/ws"}.
func HandleCreateToken(hub *TunnelHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		token := hub.CreateToken(userID)

		// Build the WebSocket URL. In production, the public API base URL is
		// set via TUNNEL_PUBLIC_URL env var. For local dev, derive from request.
		publicBase := os.Getenv("TUNNEL_PUBLIC_URL")
		if publicBase == "" {
			// Local dev fallback: derive from request
			scheme := "ws"
			if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
				scheme = "wss"
			}
			publicBase = fmt.Sprintf("%s://%s/api/v1/tunnel", scheme, r.Host)
		}
		wsURL := fmt.Sprintf("%s/%s/ws", publicBase, token)
		writeJSON(w, http.StatusOK, createTokenResponse{Token: token, WSURL: wsURL})
	}
}

// ---------------------------------------------------------------------------
// GET /api/v1/tunnel/{token}/ws  (public — CLI authenticates via token)
// ---------------------------------------------------------------------------

// HandleWebSocket upgrades the request to a WebSocket connection for the CLI.
//
// The CLI connects here with the token it received from HandleCreateToken,
// then sends a "ready" message identifying its dialect.  The server may then
// forward "query" and "schema" messages from authenticated HTTP callers.
func HandleWebSocket(hub *TunnelHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := chi.URLParam(r, "token")
		if token == "" {
			http.Error(w, "token is required", http.StatusBadRequest)
			return
		}

		sess := hub.GetSession(token)
		if sess == nil {
			http.Error(w, "unknown token", http.StatusNotFound)
			return
		}

		conn, err := tunnelUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("tunnel: websocket upgrade error token=%s: %v", token, err)
			return
		}
		conn.SetReadLimit(wsReadLimit)

		if err := hub.RegisterConn(token, conn); err != nil {
			log.Printf("tunnel: RegisterConn error token=%s: %v", token, err)
			_ = conn.WriteJSON(Message{Type: "error", Payload: mustMarshalError("tunnel already has an active connection")})
			_ = conn.Close()
			return
		}

		// Run the read loop in the foreground; ping loop runs in background.
		stopPing := make(chan struct{})
		go runPingLoop(conn, sess, stopPing)

		readLoop(conn, hub, sess)

		// CLI disconnected — tear down the session so the next CreateToken call
		// is needed for a fresh connection.
		close(stopPing)
		sess.mu.Lock()
		sess.Conn = nil
		sess.mu.Unlock()
		// Record the time of disconnection so the cleanup goroutine can reap it.
		sess.mu.Lock()
		sess.ConnectedAt = time.Now()
		sess.mu.Unlock()

		log.Printf("tunnel: CLI disconnected token=%s", token)
	}
}

// readLoop processes incoming frames from the CLI until the connection closes.
func readLoop(conn *websocket.Conn, hub *TunnelHub, sess *TunnelSession) {
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure,
				websocket.CloseNoStatusReceived,
			) {
				log.Printf("tunnel: read error token=%s: %v", sess.Token, err)
			}
			return
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("tunnel: invalid JSON from CLI token=%s: %v", sess.Token, err)
			continue
		}

		switch msg.Type {
		case "ready":
			var p ReadyPayload
			if err := json.Unmarshal(msg.Payload, &p); err == nil {
				sess.mu.Lock()
				sess.Dialect = p.Dialect
				sess.mu.Unlock()
				log.Printf("tunnel: CLI ready token=%s dialect=%s version=%s", sess.Token, p.Dialect, p.Version)
			}

		case "result", "error", "schema":
			// Route the raw payload to the waiting HTTP handler.
			if msg.ID != "" {
				hub.deliverResponse(sess, msg.ID, data)
			}

		case "pong":
			// Keepalive acknowledged — nothing further to do.

		default:
			log.Printf("tunnel: unknown message type=%s token=%s", msg.Type, sess.Token)
		}
	}
}

// runPingLoop sends periodic pings to the CLI and stops when the channel is closed.
func runPingLoop(conn *websocket.Conn, sess *TunnelSession, stop <-chan struct{}) {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if err := sess.sendMessage(Message{Type: "ping"}); err != nil {
				log.Printf("tunnel: ping error token=%s: %v", sess.Token, err)
				return
			}
		}
	}
}

// ---------------------------------------------------------------------------
// POST /api/v1/tunnel/{token}/query  (authenticated)
// ---------------------------------------------------------------------------

// HandleStatus returns the connection status of a tunnel session.
// This is a lightweight check that does NOT relay through the WebSocket.
//
//	GET /api/v1/tunnel/{token}/status
func HandleStatus(hub *TunnelHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		token := chi.URLParam(r, "token")
		sess := hub.GetSession(token)
		if sess == nil || sess.UserID != userID {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "tunnel not found"})
			return
		}

		sess.mu.Lock()
		connected := sess.Conn != nil
		dialect := sess.Dialect
		sess.mu.Unlock()

		writeJSON(w, http.StatusOK, map[string]any{
			"connected": connected,
			"dialect":   dialect,
		})
	}
}

// HandleQuery forwards a SQL/Redis query to the CLI and waits for the result.
//
//	POST /api/v1/tunnel/{token}/query
//	Body: {"sql": "SELECT 1"}  or  {"command": ["GET", "key"]}
func HandleQuery(hub *TunnelHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		token := chi.URLParam(r, "token")
		sess, err := requireSessionForUser(hub, token, userID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}

		var body QueryPayload
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if body.SQL == "" && len(body.Command) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sql or command is required"})
			return
		}

		requestID := newRequestID()
		payloadBytes, err := json.Marshal(body)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to marshal query"})
			return
		}

		msg := Message{
			ID:      requestID,
			Type:    "query",
			Payload: json.RawMessage(payloadBytes),
		}

		respCh := hub.registerQuery(sess, requestID)
		defer sess.pendingQueries.Delete(requestID)

		if err := sess.sendMessage(msg); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "CLI is not connected"})
			return
		}

		select {
		case rawResp, ok := <-respCh:
			if !ok {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "tunnel session closed"})
				return
			}
			forwardRawResponse(w, rawResp)
		case <-time.After(queryTimeout):
			writeJSON(w, http.StatusGatewayTimeout, map[string]string{"error": "query timed out"})
		}
	}
}

// ---------------------------------------------------------------------------
// GET /api/v1/tunnel/{token}/schema  (authenticated)
// ---------------------------------------------------------------------------

// HandleSchema requests the CLI to introspect the connected database schema.
//
//	GET /api/v1/tunnel/{token}/schema
func HandleSchema(hub *TunnelHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		token := chi.URLParam(r, "token")
		sess, err := requireSessionForUser(hub, token, userID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}

		requestID := newRequestID()
		msg := Message{
			ID:   requestID,
			Type: "schema",
		}

		respCh := hub.registerQuery(sess, requestID)
		defer sess.pendingQueries.Delete(requestID)

		if err := sess.sendMessage(msg); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "CLI is not connected"})
			return
		}

		select {
		case rawResp, ok := <-respCh:
			if !ok {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "tunnel session closed"})
				return
			}
			forwardRawResponse(w, rawResp)
		case <-time.After(queryTimeout):
			writeJSON(w, http.StatusGatewayTimeout, map[string]string{"error": "schema introspection timed out"})
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// requireSessionForUser looks up the session and verifies it belongs to userID.
func requireSessionForUser(hub *TunnelHub, token, userID string) (*TunnelSession, error) {
	if token == "" {
		return nil, fmt.Errorf("token is required")
	}
	sess := hub.GetSession(token)
	if sess == nil {
		return nil, fmt.Errorf("tunnel session not found")
	}
	if sess.UserID != userID {
		return nil, fmt.Errorf("tunnel session not found")
	}
	return sess, nil
}

// forwardRawResponse writes the CLI's raw JSON response envelope directly to
// the HTTP response, extracting status from the message type field.
//
// The CLI's response is a Message with Type "result", "error", or "schema".
// We unwrap the payload and return it directly so callers receive clean JSON.
func forwardRawResponse(w http.ResponseWriter, raw []byte) {
	var msg Message
	if err := json.Unmarshal(raw, &msg); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "malformed response from CLI"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if msg.Type == "error" {
		w.WriteHeader(http.StatusBadRequest)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	if msg.Payload != nil {
		_, _ = w.Write(msg.Payload)
	} else {
		_, _ = w.Write([]byte("{}"))
	}
}

// newRequestID generates a 16-character hex string suitable for correlation IDs.
func newRequestID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		binary.LittleEndian.PutUint64(b[:], uint64(time.Now().UnixNano()))
	}
	const hexChars = "0123456789abcdef"
	out := make([]byte, 16)
	for i, v := range b {
		out[i*2] = hexChars[v>>4]
		out[i*2+1] = hexChars[v&0xf]
	}
	return string(out)
}

// mustMarshalError produces a JSON-encoded ErrorPayload, panicking only on
// programmer error (malformed struct).
func mustMarshalError(msg string) json.RawMessage {
	b, _ := json.Marshal(ErrorPayload{Message: msg})
	return b
}

// writeJSON marshals v as JSON and writes it to w with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}
