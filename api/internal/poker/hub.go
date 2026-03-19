package poker

import (
	"database/sql"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const cleanupInterval = 60 * time.Second
const sessionArchiveTTL = 7 * 24 * time.Hour // 7 days

// Hub manages live WebSocket connections for all active planning-poker sessions.
// All durable state (sessions, stories, votes) lives in the database; the Hub
// only owns the in-memory connection map and per-session timer state.
type Hub struct {
	db   *sql.DB
	mu   sync.RWMutex
	conns map[string]*SessionConns // sessionID -> live connections
	done  chan struct{}
}

// SessionConns holds every live WebSocket participant for one session, plus the
// ephemeral timer state (which is intentionally not persisted).
type SessionConns struct {
	mu           sync.RWMutex
	participants map[string]*liveParticipant // participantID -> connection

	// Timer state — in-memory only (ephemeral, real-time).
	timerRunning   bool
	timerDuration  int
	timerRemaining int
	timerCancel    func() // cancel context for running timer goroutine
}

// liveParticipant is an active (or recently disconnected) WebSocket connection.
type liveParticipant struct {
	id          string
	name        string
	conn        *websocket.Conn
	isOwner     bool
	isConnected bool
	reconnectID string
	mu          sync.Mutex // serialises writes to conn
}

// writeJSON sends a message to the participant, holding the per-participant
// mutex so concurrent goroutines never interleave writes on the same socket.
func (p *liveParticipant) writeJSON(v interface{}) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.conn == nil {
		return nil
	}
	return p.conn.WriteJSON(v)
}

// NewHub creates a Hub backed by db and starts its background cleanup goroutine.
func NewHub(db *sql.DB) *Hub {
	h := &Hub{
		db:    db,
		conns: make(map[string]*SessionConns),
		done:  make(chan struct{}),
	}
	go h.cleanup()
	return h
}

// ---------------------------------------------------------------------------
// Session connection registry
// ---------------------------------------------------------------------------

// getOrCreateConns returns the SessionConns for a session, creating it if absent.
func (h *Hub) getOrCreateConns(sessionID string) *SessionConns {
	h.mu.Lock()
	defer h.mu.Unlock()
	sc, ok := h.conns[sessionID]
	if !ok {
		sc = &SessionConns{
			participants: make(map[string]*liveParticipant),
		}
		h.conns[sessionID] = sc
	}
	return sc
}

// getConns returns the SessionConns for a session, or nil if none exist.
func (h *Hub) getConns(sessionID string) *SessionConns {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.conns[sessionID]
}

// removeConnsIfEmpty removes the SessionConns entry when the last participant
// has left — frees memory for sessions no one is watching.
func (h *Hub) removeConnsIfEmpty(sessionID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	sc, ok := h.conns[sessionID]
	if !ok {
		return
	}
	sc.mu.RLock()
	n := len(sc.participants)
	sc.mu.RUnlock()
	if n == 0 {
		delete(h.conns, sessionID)
	}
}

// ---------------------------------------------------------------------------
// Participant management (in-memory)
// ---------------------------------------------------------------------------

// AddParticipant registers a new live connection and broadcasts updated state.
func (h *Hub) AddParticipant(sessionID, participantID, name, reconnectID string, conn *websocket.Conn, isOwner bool) {
	sc := h.getOrCreateConns(sessionID)
	sc.mu.Lock()
	sc.participants[participantID] = &liveParticipant{
		id:          participantID,
		name:        name,
		conn:        conn,
		isOwner:     isOwner,
		isConnected: true,
		reconnectID: reconnectID,
	}
	sc.mu.Unlock()
	log.Printf("poker: participant joined session=%s name=%s id=%s owner=%v", sessionID, name, participantID, isOwner)
	h.BroadcastSession(sessionID)
}

// RemoveParticipant marks a participant as disconnected without removing their
// record, so they can reconnect within the grace period.
func (h *Hub) RemoveParticipant(sessionID, participantID string) {
	sc := h.getConns(sessionID)
	if sc == nil {
		return
	}
	sc.mu.Lock()
	p, ok := sc.participants[participantID]
	if ok {
		p.mu.Lock()
		p.isConnected = false
		p.conn = nil
		p.mu.Unlock()
	}
	sc.mu.Unlock()
	if ok {
		log.Printf("poker: participant disconnected session=%s id=%s", sessionID, participantID)
		h.BroadcastSession(sessionID)
	}
}

// PurgeParticipant fully removes a participant's record, closes their
// connection, and sends a "kicked" message first.
func (h *Hub) PurgeParticipant(sessionID, participantID string) {
	sc := h.getConns(sessionID)
	if sc == nil {
		return
	}
	sc.mu.Lock()
	p, ok := sc.participants[participantID]
	if ok {
		p.mu.Lock()
		if p.conn != nil {
			_ = p.conn.WriteJSON(ServerMessage{Type: "kicked", Message: "You have been removed from the session"})
			_ = p.conn.Close()
			p.conn = nil
		}
		p.mu.Unlock()
		delete(sc.participants, participantID)
	}
	sc.mu.Unlock()
	if ok {
		log.Printf("poker: participant purged session=%s id=%s", sessionID, participantID)
		h.BroadcastSession(sessionID)
	}
	h.removeConnsIfEmpty(sessionID)
}

// ReconnectParticipant looks up a participant by reconnectID, swaps the
// WebSocket connection, and marks them as connected again. Returns the
// participant's ID and name, or ("", "", false) if not found.
func (h *Hub) ReconnectParticipant(sessionID, reconnectID string, conn *websocket.Conn) (id, name string, isOwner bool, ok bool) {
	sc := h.getConns(sessionID)
	if sc == nil {
		return "", "", false, false
	}
	sc.mu.Lock()
	defer sc.mu.Unlock()
	for _, p := range sc.participants {
		if p.reconnectID == reconnectID {
			p.mu.Lock()
			p.conn = conn
			p.isConnected = true
			p.mu.Unlock()
			log.Printf("poker: participant reconnected session=%s id=%s", sessionID, p.id)
			return p.id, p.name, p.isOwner, true
		}
	}
	return "", "", false, false
}

// IsStillDisconnected returns true if the participant exists but is currently
// not connected. Used by the grace-period goroutine in the handler.
func (h *Hub) IsStillDisconnected(sessionID, participantID string) bool {
	sc := h.getConns(sessionID)
	if sc == nil {
		return false
	}
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	p, ok := sc.participants[participantID]
	return ok && !p.isConnected
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

// BroadcastSession builds the current session state from the DB (+ live
// connections) and sends it to all connected participants.
func (h *Hub) BroadcastSession(sessionID string) {
	state, err := h.BuildSessionState(sessionID)
	if err != nil {
		log.Printf("poker: BroadcastSession build error session=%s: %v", sessionID, err)
		return
	}
	msg := ServerMessage{Type: "state", Session: state}

	sc := h.getConns(sessionID)
	if sc == nil {
		return
	}
	sc.mu.RLock()
	participants := make([]*liveParticipant, 0, len(sc.participants))
	for _, p := range sc.participants {
		if p.isConnected {
			participants = append(participants, p)
		}
	}
	sc.mu.RUnlock()

	for _, p := range participants {
		if err := p.writeJSON(msg); err != nil {
			log.Printf("poker: broadcast write error session=%s participant=%s: %v", sessionID, p.id, err)
		}
	}
}

// SendTo sends a message to a single connected participant.
func (h *Hub) SendTo(sessionID, participantID string, msg ServerMessage) {
	sc := h.getConns(sessionID)
	if sc == nil {
		return
	}
	sc.mu.RLock()
	p, ok := sc.participants[participantID]
	sc.mu.RUnlock()
	if !ok || !p.isConnected {
		return
	}
	if err := p.writeJSON(msg); err != nil {
		log.Printf("poker: sendTo error session=%s participant=%s: %v", sessionID, participantID, err)
	}
}

// BroadcastRaw sends an arbitrary message to all connected participants without
// rebuilding state from DB. Used for tick/timer_expired messages.
func (h *Hub) BroadcastRaw(sessionID string, msg ServerMessage) {
	sc := h.getConns(sessionID)
	if sc == nil {
		return
	}
	sc.mu.RLock()
	participants := make([]*liveParticipant, 0, len(sc.participants))
	for _, p := range sc.participants {
		if p.isConnected {
			participants = append(participants, p)
		}
	}
	sc.mu.RUnlock()
	for _, p := range participants {
		if err := p.writeJSON(msg); err != nil {
			log.Printf("poker: broadcastRaw write error session=%s participant=%s: %v", sessionID, p.id, err)
		}
	}
}

// ---------------------------------------------------------------------------
// Timer (in-memory only)
// ---------------------------------------------------------------------------

// StartTimer starts a per-second countdown for the session. Any running timer
// is cancelled first. When it expires a "timer_expired" event is broadcast.
func (h *Hub) StartTimer(sessionID string, duration int) {
	sc := h.getOrCreateConns(sessionID)
	sc.mu.Lock()
	if sc.timerCancel != nil {
		sc.timerCancel()
		sc.timerCancel = nil
	}

	done := make(chan struct{})
	sc.timerRunning = true
	sc.timerDuration = duration
	sc.timerRemaining = duration
	sc.timerCancel = func() { close(done) }
	sc.mu.Unlock()

	log.Printf("poker: timer started session=%s duration=%ds", sessionID, duration)

	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				sc.mu.Lock()
				if sc.timerRemaining > 0 {
					sc.timerRemaining--
				}
				expired := sc.timerRemaining == 0
				if expired {
					sc.timerRunning = false
					sc.timerCancel = nil
				}
				sc.mu.Unlock()

				if expired {
					h.BroadcastRaw(sessionID, ServerMessage{Type: "timer_expired"})
					h.BroadcastSession(sessionID)
					return
				}
				sc.mu.RLock()
				remaining := sc.timerRemaining
				sc.mu.RUnlock()
				h.BroadcastRaw(sessionID, ServerMessage{Type: "tick", Tick: remaining})
			}
		}
	}()

	h.BroadcastSession(sessionID)
}

// StopTimer cancels any running timer for the session.
func (h *Hub) StopTimer(sessionID string) {
	sc := h.getConns(sessionID)
	if sc == nil {
		return
	}
	sc.mu.Lock()
	if sc.timerCancel != nil {
		sc.timerCancel()
		sc.timerCancel = nil
	}
	sc.timerRunning = false
	sc.mu.Unlock()
	log.Printf("poker: timer stopped session=%s", sessionID)
	h.BroadcastSession(sessionID)
}

// timerState returns a snapshot of the timer fields for a session.
func (h *Hub) timerState(sessionID string) (running bool, duration, remaining int) {
	sc := h.getConns(sessionID)
	if sc == nil {
		return false, 0, 0
	}
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return sc.timerRunning, sc.timerDuration, sc.timerRemaining
}

// ---------------------------------------------------------------------------
// Cleanup goroutine
// ---------------------------------------------------------------------------

// cleanup runs periodically and archives sessions that have had no activity
// for longer than sessionArchiveTTL.
func (h *Hub) cleanup() {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()
	for {
		select {
		case <-h.done:
			return
		case <-ticker.C:
			if h.db == nil {
				continue
			}
			_, err := h.db.Exec(`
				UPDATE poker_sessions
				SET    status = 'archived', updated_at = NOW()
				WHERE  status = 'active'
				  AND  updated_at < NOW() - INTERVAL '7 days'`)
			if err != nil {
				log.Printf("poker: cleanup archive error: %v", err)
			}
		}
	}
}

// Shutdown signals the cleanup goroutine to stop.
func (h *Hub) Shutdown() {
	close(h.done)
	log.Printf("poker: hub shut down")
}
