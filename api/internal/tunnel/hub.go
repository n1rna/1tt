package tunnel

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// pendingTTL is how long a session without an active WebSocket connection
	// is kept alive while the CLI is expected to connect.
	pendingTTL = 10 * time.Minute

	// disconnectedTTL is how long a previously-connected session is kept after
	// the CLI drops its WebSocket connection.
	disconnectedTTL = 5 * time.Minute

	// cleanupInterval controls how frequently the background goroutine sweeps
	// for stale sessions.
	cleanupInterval = 60 * time.Second
)

// TunnelSession is one active tunnel created for a user.
//
// Between CreateToken and the CLI upgrading to WebSocket the session is
// "pending" (Conn == nil).  Once the CLI connects, ConnectedAt is set.
type TunnelSession struct {
	Token       string
	UserID      string
	Dialect     string // set by the CLI's "ready" message
	Conn        *websocket.Conn
	CreatedAt   time.Time
	ConnectedAt time.Time // zero if never connected
	mu          sync.Mutex

	// pendingQueries maps request ID -> response channel.  The HTTP handler
	// creates the channel before writing to the WebSocket; the WebSocket read
	// loop delivers the raw response JSON onto it.
	pendingQueries sync.Map
}

// sendMessage serialises msg as JSON and writes it to the CLI's WebSocket.
// The per-session mutex serialises concurrent writes.
func (s *TunnelSession) sendMessage(msg Message) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Conn == nil {
		return fmt.Errorf("tunnel: session %s has no active connection", s.Token)
	}
	return s.Conn.WriteJSON(msg)
}

// TunnelHub manages all active TunnelSessions.
type TunnelHub struct {
	mu       sync.RWMutex
	sessions map[string]*TunnelSession // token -> session
	done     chan struct{}
}

// NewHub creates a TunnelHub and starts its background cleanup goroutine.
func NewHub() *TunnelHub {
	h := &TunnelHub{
		sessions: make(map[string]*TunnelSession),
		done:     make(chan struct{}),
	}
	go h.cleanup()
	return h
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// CreateToken allocates a new TunnelSession for userID and returns the token.
// The session is in a "pending" state until RegisterConn is called by the CLI.
func (h *TunnelHub) CreateToken(userID string) string {
	token := generateToken()
	sess := &TunnelSession{
		Token:     token,
		UserID:    userID,
		CreatedAt: time.Now(),
	}
	h.mu.Lock()
	h.sessions[token] = sess
	h.mu.Unlock()
	log.Printf("tunnel: token created userID=%s token=%s", userID, token)
	return token
}

// GetSession returns the session for the given token, or nil if not found.
func (h *TunnelHub) GetSession(token string) *TunnelSession {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.sessions[token]
}

// RegisterConn attaches conn to an existing pending session.
// Returns an error if the token is unknown or already has a connection.
func (h *TunnelHub) RegisterConn(token string, conn *websocket.Conn) error {
	h.mu.Lock()
	sess, ok := h.sessions[token]
	h.mu.Unlock()
	if !ok {
		return fmt.Errorf("tunnel: token %s not found", token)
	}
	sess.mu.Lock()
	defer sess.mu.Unlock()
	if sess.Conn != nil {
		return fmt.Errorf("tunnel: token %s already has an active connection", token)
	}
	sess.Conn = conn
	sess.ConnectedAt = time.Now()
	log.Printf("tunnel: CLI connected token=%s", token)
	return nil
}

// RemoveSession closes any open WebSocket connection and removes the session.
func (h *TunnelHub) RemoveSession(token string) {
	h.mu.Lock()
	sess, ok := h.sessions[token]
	if ok {
		delete(h.sessions, token)
	}
	h.mu.Unlock()
	if !ok {
		return
	}
	sess.mu.Lock()
	if sess.Conn != nil {
		_ = sess.Conn.Close()
		sess.Conn = nil
	}
	sess.mu.Unlock()
	// Drain any pending query channels so HTTP handlers don't block forever.
	sess.pendingQueries.Range(func(key, val any) bool {
		if ch, ok := val.(chan []byte); ok {
			close(ch)
		}
		sess.pendingQueries.Delete(key)
		return true
	})
	log.Printf("tunnel: session removed token=%s", token)
}

// Shutdown stops the cleanup goroutine and removes all sessions.
func (h *TunnelHub) Shutdown() {
	close(h.done)

	h.mu.Lock()
	tokens := make([]string, 0, len(h.sessions))
	for t := range h.sessions {
		tokens = append(tokens, t)
	}
	h.mu.Unlock()

	for _, t := range tokens {
		h.RemoveSession(t)
	}
	log.Printf("tunnel: hub shut down")
}

// ---------------------------------------------------------------------------
// Pending-query helpers (used by handler.go)
// ---------------------------------------------------------------------------

// registerQuery stores a response channel keyed by requestID.
func (h *TunnelHub) registerQuery(sess *TunnelSession, requestID string) chan []byte {
	ch := make(chan []byte, 1)
	sess.pendingQueries.Store(requestID, ch)
	return ch
}

// deliverResponse routes an incoming response to the waiting HTTP handler.
func (h *TunnelHub) deliverResponse(sess *TunnelSession, requestID string, payload []byte) {
	val, ok := sess.pendingQueries.LoadAndDelete(requestID)
	if !ok {
		log.Printf("tunnel: no pending query for id=%s (late response?)", requestID)
		return
	}
	ch, ok := val.(chan []byte)
	if !ok {
		return
	}
	select {
	case ch <- payload:
	default:
		// Channel already has a value or was closed; discard.
	}
}

// ---------------------------------------------------------------------------
// Background cleanup
// ---------------------------------------------------------------------------

func (h *TunnelHub) cleanup() {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()
	for {
		select {
		case <-h.done:
			return
		case <-ticker.C:
			h.sweepStale()
		}
	}
}

func (h *TunnelHub) sweepStale() {
	now := time.Now()

	h.mu.RLock()
	tokens := make([]string, 0, len(h.sessions))
	for t := range h.sessions {
		tokens = append(tokens, t)
	}
	h.mu.RUnlock()

	for _, t := range tokens {
		h.mu.RLock()
		sess, ok := h.sessions[t]
		h.mu.RUnlock()
		if !ok {
			continue
		}

		sess.mu.Lock()
		hasConn := sess.Conn != nil
		connectedAt := sess.ConnectedAt
		createdAt := sess.CreatedAt
		sess.mu.Unlock()

		// Never connected and pending too long — CLI likely never started.
		if !hasConn && connectedAt.IsZero() && now.Sub(createdAt) > pendingTTL {
			log.Printf("tunnel: removing stale pending session token=%s age=%s", t, now.Sub(createdAt).Round(time.Second))
			h.RemoveSession(t)
			continue
		}

		// Was connected but has since disconnected.
		if !hasConn && !connectedAt.IsZero() && now.Sub(connectedAt) > disconnectedTTL {
			log.Printf("tunnel: removing disconnected session token=%s idle=%s", t, now.Sub(connectedAt).Round(time.Second))
			h.RemoveSession(t)
		}
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// generateToken returns a 32-byte random value encoded as a 64-character hex
// string, falling back to a timestamp-based value if the OS entropy source
// is unavailable.
func generateToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// Extremely unlikely fallback: use the current time.
		var ts [8]byte
		binary.LittleEndian.PutUint64(ts[:], uint64(time.Now().UnixNano()))
		copy(b, ts[:])
	}
	return hex.EncodeToString(b)
}
