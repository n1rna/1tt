package poker

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/big"
	"sort"
	"strconv"
	"time"
)

const sessionIDChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const sessionIDLength = 6

// ---------------------------------------------------------------------------
// DB-backed session operations
// ---------------------------------------------------------------------------

// CreateSession inserts a new session row and returns (sessionID, ownerToken).
func (h *Hub) CreateSession(name, ownerID string, scale VotingScale) (string, string, error) {
	if h.db == nil {
		return "", "", fmt.Errorf("database not available")
	}

	scaleValuesJSON, err := json.Marshal(scale.Values)
	if err != nil {
		return "", "", fmt.Errorf("marshal scale values: %w", err)
	}

	var id string
	for {
		id = generateSessionID()
		var exists bool
		err := h.db.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM poker_sessions WHERE id = $1)`, id,
		).Scan(&exists)
		if err != nil {
			return "", "", fmt.Errorf("check session id collision: %w", err)
		}
		if !exists {
			break
		}
	}

	ownerToken := newID() + newID() // 32-char hex secret
	_, err = h.db.Exec(`
		INSERT INTO poker_sessions (id, name, owner_id, owner_token, scale_type, scale_values)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		id, name, ownerID, ownerToken, scale.Type, string(scaleValuesJSON),
	)
	if err != nil {
		return "", "", fmt.Errorf("insert session: %w", err)
	}

	log.Printf("poker: session created id=%s name=%q owner=%s", id, name, ownerID)
	return id, ownerToken, nil
}

// dbSession is an internal row scan target for poker_sessions.
type dbSession struct {
	id            string
	name          string
	ownerID       string
	ownerToken    string
	scaleType     string
	scaleValues   string // JSON array
	status        string
	activeStoryID sql.NullString
	votingOpen    bool
	createdAt     time.Time
	updatedAt     time.Time
}

// getDBSession fetches a single session row. Returns sql.ErrNoRows if absent.
func (h *Hub) getDBSession(ctx context.Context, sessionID string) (*dbSession, error) {
	row := h.db.QueryRowContext(ctx, `
		SELECT id, name, owner_id, owner_token, scale_type, scale_values,
		       status, active_story_id, voting_open, created_at, updated_at
		FROM   poker_sessions
		WHERE  id = $1`, sessionID)

	var s dbSession
	err := row.Scan(
		&s.id, &s.name, &s.ownerID, &s.ownerToken, &s.scaleType, &s.scaleValues,
		&s.status, &s.activeStoryID, &s.votingOpen, &s.createdAt, &s.updatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetSessionMeta returns the session name, disabled flag, and ownerToken for
// the given session ID. Returns (nil, sql.ErrNoRows) if not found.
func (h *Hub) GetSessionMeta(sessionID string) (*dbSession, error) {
	if h.db == nil {
		return nil, fmt.Errorf("database not available")
	}
	return h.getDBSession(context.Background(), sessionID)
}

// VerifyOwnerToken checks that ownerToken matches the stored token for
// sessionID. Returns false if the session is not found or token doesn't match.
func (h *Hub) VerifyOwnerToken(sessionID, ownerToken string) bool {
	if h.db == nil {
		return false
	}
	var stored string
	err := h.db.QueryRow(
		`SELECT owner_token FROM poker_sessions WHERE id = $1`, sessionID,
	).Scan(&stored)
	if err != nil {
		return false
	}
	return stored == ownerToken
}

// ListSessionsByOwner returns a summary slice of all non-archived sessions
// owned by the given user.
func (h *Hub) ListSessionsByOwner(ownerID string) ([]SessionSummary, error) {
	if h.db == nil {
		return nil, fmt.Errorf("database not available")
	}

	rows, err := h.db.Query(`
		SELECT ps.id, ps.name, ps.status, ps.created_at,
		       (SELECT COUNT(*) FROM poker_stories WHERE session_id = ps.id) AS story_count
		FROM   poker_sessions ps
		WHERE  ps.owner_id = $1
		  AND  ps.status != 'archived'
		ORDER BY ps.created_at DESC`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	defer rows.Close()

	var result []SessionSummary
	for rows.Next() {
		var s SessionSummary
		var status string
		if err := rows.Scan(&s.ID, &s.Name, &status, &s.CreatedAt, &s.StoryCount); err != nil {
			return nil, fmt.Errorf("scan session row: %w", err)
		}
		s.Disabled = (status == "disabled")

		// Live participant count from in-memory connections.
		sc := h.getConns(s.ID)
		if sc != nil {
			sc.mu.RLock()
			for _, p := range sc.participants {
				if p.isConnected {
					s.ParticipantCount++
				}
			}
			sc.mu.RUnlock()
		}
		result = append(result, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate session rows: %w", err)
	}
	return result, nil
}

// DisableSession sets status = 'disabled'. Verifies ownership.
func (h *Hub) DisableSession(id, ownerID string) (bool, error) {
	if h.db == nil {
		return false, fmt.Errorf("database not available")
	}
	res, err := h.db.Exec(`
		UPDATE poker_sessions
		SET    status = 'disabled', updated_at = NOW()
		WHERE  id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return false, fmt.Errorf("disable session: %w", err)
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// EnableSession sets status = 'active'. Verifies ownership.
func (h *Hub) EnableSession(id, ownerID string) (bool, error) {
	if h.db == nil {
		return false, fmt.Errorf("database not available")
	}
	res, err := h.db.Exec(`
		UPDATE poker_sessions
		SET    status = 'active', updated_at = NOW()
		WHERE  id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return false, fmt.Errorf("enable session: %w", err)
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// DeleteSession soft-deletes by setting status = 'archived'. Verifies ownership.
func (h *Hub) DeleteSession(id, ownerID string) (bool, error) {
	if h.db == nil {
		return false, fmt.Errorf("database not available")
	}
	res, err := h.db.Exec(`
		UPDATE poker_sessions
		SET    status = 'archived', updated_at = NOW()
		WHERE  id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return false, fmt.Errorf("delete session: %w", err)
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		log.Printf("poker: session archived id=%s by owner=%s", id, ownerID)
	}
	return n > 0, nil
}

// ---------------------------------------------------------------------------
// Game operations (all write to DB then broadcast)
// ---------------------------------------------------------------------------

// HandleMessage routes an incoming ClientMessage to the appropriate DB
// operation and then triggers a broadcast of updated state.
func (h *Hub) HandleMessage(sessionID, participantID string, ownerToken string, msg ClientMessage) {
	if h.db == nil {
		h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "database not available"})
		return
	}

	// Determine if this participant is the owner via the ownerToken they provided
	// at join time (stored per-connection in the liveParticipant record).
	isOwner := h.participantIsOwner(sessionID, participantID)

	switch msg.Type {
	case "vote":
		h.handleVote(sessionID, participantID, msg.Value)

	case "create_story":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can create stories"})
			return
		}
		h.handleCreateStory(sessionID, msg.Title, msg.Description)

	case "select_story":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can select stories"})
			return
		}
		h.handleSelectStory(sessionID, msg.StoryIdx)

	case "start_voting":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can start voting"})
			return
		}
		h.handleStartVoting(sessionID)

	case "reveal":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can reveal votes"})
			return
		}
		h.handleReveal(sessionID)

	case "reset":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can reset votes"})
			return
		}
		h.handleReset(sessionID)

	case "next_story":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can advance to the next story"})
			return
		}
		h.handleNextStory(sessionID)

	case "start_timer":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can start the timer"})
			return
		}
		h.StartTimer(sessionID, msg.Duration)

	case "stop_timer":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can stop the timer"})
			return
		}
		h.StopTimer(sessionID)

	case "remove_voter":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can remove participants"})
			return
		}
		h.PurgeParticipant(sessionID, msg.VoterID)

	case "set_scale":
		if !isOwner {
			h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "only the owner can change the scale"})
			return
		}
		h.handleSetScale(sessionID, msg.ScaleType, msg.CustomValues)

	default:
		h.SendTo(sessionID, participantID, ServerMessage{Type: "error", Message: "unknown message type: " + msg.Type})
	}
}

// participantIsOwner checks the live connection map to see if the participant
// joined with the owner flag set.
func (h *Hub) participantIsOwner(sessionID, participantID string) bool {
	sc := h.getConns(sessionID)
	if sc == nil {
		return false
	}
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	p, ok := sc.participants[participantID]
	return ok && p.isOwner
}

// participantName looks up a participant's display name from the live map.
func (h *Hub) participantName(sessionID, participantID string) string {
	sc := h.getConns(sessionID)
	if sc == nil {
		return ""
	}
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	if p, ok := sc.participants[participantID]; ok {
		return p.name
	}
	return ""
}

// touchSession updates updated_at on the session row.
func (h *Hub) touchSession(sessionID string) {
	_, err := h.db.Exec(`UPDATE poker_sessions SET updated_at = NOW() WHERE id = $1`, sessionID)
	if err != nil {
		log.Printf("poker: touchSession error session=%s: %v", sessionID, err)
	}
}

// handleVote records/updates a vote for the active story by the participant's
// display name.
func (h *Hub) handleVote(sessionID, participantID, value string) {
	name := h.participantName(sessionID, participantID)
	if name == "" {
		return
	}

	// Fetch active story and confirm voting is open.
	var activeStoryID sql.NullString
	var votingOpen bool
	err := h.db.QueryRow(`
		SELECT active_story_id, voting_open FROM poker_sessions WHERE id = $1`, sessionID,
	).Scan(&activeStoryID, &votingOpen)
	if err != nil || !activeStoryID.Valid || !votingOpen {
		return
	}

	// Confirm story is not already revealed.
	var revealed bool
	err = h.db.QueryRow(`
		SELECT revealed FROM poker_stories WHERE id = $1`, activeStoryID.String,
	).Scan(&revealed)
	if err != nil || revealed {
		return
	}

	_, err = h.db.Exec(`
		INSERT INTO poker_votes (id, story_id, session_id, participant_name, value)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (story_id, participant_name) DO UPDATE SET value = EXCLUDED.value`,
		newID(), activeStoryID.String, sessionID, name, value,
	)
	if err != nil {
		log.Printf("poker: vote upsert error session=%s: %v", sessionID, err)
		return
	}
	h.touchSession(sessionID)
	log.Printf("poker: vote recorded session=%s story=%s participant=%s", sessionID, activeStoryID.String, name)
	h.BroadcastSession(sessionID)
}

// handleCreateStory inserts a new story, sets it as the active story, and
// closes voting.
func (h *Hub) handleCreateStory(sessionID, title, description string) {
	// Count existing stories so we can set sort_order.
	var maxOrder int
	row := h.db.QueryRow(
		`SELECT COALESCE(MAX(sort_order), -1) FROM poker_stories WHERE session_id = $1`, sessionID)
	if err := row.Scan(&maxOrder); err != nil {
		log.Printf("poker: get max sort_order error session=%s: %v", sessionID, err)
		return
	}

	storyID := newID()
	_, err := h.db.Exec(`
		INSERT INTO poker_stories (id, session_id, title, description, sort_order)
		VALUES ($1, $2, $3, $4, $5)`,
		storyID, sessionID, title, description, maxOrder+1,
	)
	if err != nil {
		log.Printf("poker: create story insert error session=%s: %v", sessionID, err)
		return
	}

	_, err = h.db.Exec(`
		UPDATE poker_sessions
		SET    active_story_id = $1, voting_open = FALSE, updated_at = NOW()
		WHERE  id = $2`, storyID, sessionID)
	if err != nil {
		log.Printf("poker: create story update session error session=%s: %v", sessionID, err)
		return
	}

	log.Printf("poker: story created session=%s story=%s title=%q", sessionID, storyID, title)
	h.BroadcastSession(sessionID)
}

// handleSelectStory changes the active story by index and closes voting.
func (h *Hub) handleSelectStory(sessionID string, idx int) {
	rows, err := h.db.Query(`
		SELECT id FROM poker_stories
		WHERE  session_id = $1
		ORDER BY sort_order ASC`, sessionID)
	if err != nil {
		log.Printf("poker: select story query error session=%s: %v", sessionID, err)
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			log.Printf("poker: select story scan error session=%s: %v", sessionID, err)
			return
		}
		ids = append(ids, id)
	}

	if idx < 0 || idx >= len(ids) {
		return
	}

	_, err = h.db.Exec(`
		UPDATE poker_sessions
		SET    active_story_id = $1, voting_open = FALSE, updated_at = NOW()
		WHERE  id = $2`, ids[idx], sessionID)
	if err != nil {
		log.Printf("poker: select story update error session=%s: %v", sessionID, err)
		return
	}

	log.Printf("poker: story selected session=%s idx=%d", sessionID, idx)
	h.BroadcastSession(sessionID)
}

// handleStartVoting opens voting on the current active story.
func (h *Hub) handleStartVoting(sessionID string) {
	var activeStoryID sql.NullString
	err := h.db.QueryRow(
		`SELECT active_story_id FROM poker_sessions WHERE id = $1`, sessionID,
	).Scan(&activeStoryID)
	if err != nil || !activeStoryID.Valid {
		return
	}

	// Cannot start voting on an already-revealed story.
	var revealed bool
	err = h.db.QueryRow(
		`SELECT revealed FROM poker_stories WHERE id = $1`, activeStoryID.String,
	).Scan(&revealed)
	if err != nil || revealed {
		return
	}

	_, err = h.db.Exec(`
		UPDATE poker_sessions
		SET    voting_open = TRUE, updated_at = NOW()
		WHERE  id = $1`, sessionID)
	if err != nil {
		log.Printf("poker: start voting update error session=%s: %v", sessionID, err)
		return
	}

	log.Printf("poker: voting started session=%s story=%s", sessionID, activeStoryID.String)
	h.BroadcastSession(sessionID)
}

// handleReveal reveals the active story's votes and closes voting.
func (h *Hub) handleReveal(sessionID string) {
	var activeStoryID sql.NullString
	err := h.db.QueryRow(
		`SELECT active_story_id FROM poker_sessions WHERE id = $1`, sessionID,
	).Scan(&activeStoryID)
	if err != nil || !activeStoryID.Valid {
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		log.Printf("poker: reveal begin tx error session=%s: %v", sessionID, err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	_, err = tx.Exec(`
		UPDATE poker_stories SET revealed = TRUE WHERE id = $1 AND revealed = FALSE`,
		activeStoryID.String)
	if err != nil {
		log.Printf("poker: reveal story update error session=%s: %v", sessionID, err)
		return
	}

	_, err = tx.Exec(`
		UPDATE poker_sessions SET voting_open = FALSE, updated_at = NOW() WHERE id = $1`, sessionID)
	if err != nil {
		log.Printf("poker: reveal session update error session=%s: %v", sessionID, err)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("poker: reveal commit error session=%s: %v", sessionID, err)
		return
	}

	log.Printf("poker: votes revealed session=%s story=%s", sessionID, activeStoryID.String)
	h.BroadcastSession(sessionID)
}

// handleReset deletes all votes for the active story, un-reveals it, and
// re-opens voting.
func (h *Hub) handleReset(sessionID string) {
	var activeStoryID sql.NullString
	err := h.db.QueryRow(
		`SELECT active_story_id FROM poker_sessions WHERE id = $1`, sessionID,
	).Scan(&activeStoryID)
	if err != nil || !activeStoryID.Valid {
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		log.Printf("poker: reset begin tx error session=%s: %v", sessionID, err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	_, err = tx.Exec(`DELETE FROM poker_votes WHERE story_id = $1`, activeStoryID.String)
	if err != nil {
		log.Printf("poker: reset delete votes error session=%s: %v", sessionID, err)
		return
	}

	_, err = tx.Exec(`UPDATE poker_stories SET revealed = FALSE WHERE id = $1`, activeStoryID.String)
	if err != nil {
		log.Printf("poker: reset story update error session=%s: %v", sessionID, err)
		return
	}

	_, err = tx.Exec(`
		UPDATE poker_sessions SET voting_open = TRUE, updated_at = NOW() WHERE id = $1`, sessionID)
	if err != nil {
		log.Printf("poker: reset session update error session=%s: %v", sessionID, err)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("poker: reset commit error session=%s: %v", sessionID, err)
		return
	}

	log.Printf("poker: votes reset session=%s story=%s", sessionID, activeStoryID.String)
	h.BroadcastSession(sessionID)
}

// handleNextStory reveals the current story (if not already) then advances
// to the next one. If no next story exists a blank placeholder is created.
func (h *Hub) handleNextStory(sessionID string) {
	var activeStoryID sql.NullString
	err := h.db.QueryRow(
		`SELECT active_story_id FROM poker_sessions WHERE id = $1`, sessionID,
	).Scan(&activeStoryID)
	if err != nil {
		log.Printf("poker: next story get active error session=%s: %v", sessionID, err)
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		log.Printf("poker: next story begin tx error session=%s: %v", sessionID, err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	// Reveal current story if valid and not already revealed.
	var currentOrder int
	if activeStoryID.Valid {
		var revealed bool
		err = tx.QueryRow(
			`SELECT revealed, sort_order FROM poker_stories WHERE id = $1`,
			activeStoryID.String,
		).Scan(&revealed, &currentOrder)
		if err == nil && !revealed {
			_, err = tx.Exec(
				`UPDATE poker_stories SET revealed = TRUE WHERE id = $1`, activeStoryID.String)
			if err != nil {
				log.Printf("poker: next story reveal error session=%s: %v", sessionID, err)
				return
			}
		}
	}

	// Try to find the next unrevealed story with a higher sort_order.
	var nextID string
	err = tx.QueryRow(`
		SELECT id FROM poker_stories
		WHERE  session_id = $1 AND sort_order > $2 AND revealed = FALSE
		ORDER BY sort_order ASC
		LIMIT 1`, sessionID, currentOrder,
	).Scan(&nextID)

	if err == sql.ErrNoRows {
		// No pre-existing next story — create a placeholder.
		var maxOrder int
		_ = tx.QueryRow(
			`SELECT COALESCE(MAX(sort_order), -1) FROM poker_stories WHERE session_id = $1`, sessionID,
		).Scan(&maxOrder)
		nextID = newID()
		_, err = tx.Exec(`
			INSERT INTO poker_stories (id, session_id, title, description, sort_order)
			VALUES ($1, $2, '', '', $3)`, nextID, sessionID, maxOrder+1)
		if err != nil {
			log.Printf("poker: next story insert placeholder error session=%s: %v", sessionID, err)
			return
		}
	} else if err != nil {
		log.Printf("poker: next story find next error session=%s: %v", sessionID, err)
		return
	}

	_, err = tx.Exec(`
		UPDATE poker_sessions
		SET    active_story_id = $1, voting_open = FALSE, updated_at = NOW()
		WHERE  id = $2`, nextID, sessionID)
	if err != nil {
		log.Printf("poker: next story update session error session=%s: %v", sessionID, err)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("poker: next story commit error session=%s: %v", sessionID, err)
		return
	}

	log.Printf("poker: advanced to next story session=%s nextStory=%s", sessionID, nextID)
	h.BroadcastSession(sessionID)
}

// handleSetScale updates the scale stored on the session row.
func (h *Hub) handleSetScale(sessionID, scaleType string, customValues []string) {
	var scale VotingScale
	if scaleType == "custom" && len(customValues) > 0 {
		scale = VotingScale{Type: "custom", Values: customValues}
	} else {
		scale = scaleForType(scaleType)
	}

	valuesJSON, err := json.Marshal(scale.Values)
	if err != nil {
		log.Printf("poker: set scale marshal error session=%s: %v", sessionID, err)
		return
	}

	_, err = h.db.Exec(`
		UPDATE poker_sessions
		SET    scale_type = $1, scale_values = $2, updated_at = NOW()
		WHERE  id = $3`, scale.Type, string(valuesJSON), sessionID)
	if err != nil {
		log.Printf("poker: set scale update error session=%s: %v", sessionID, err)
		return
	}

	log.Printf("poker: scale changed session=%s type=%s", sessionID, scale.Type)
	h.BroadcastSession(sessionID)
}

// ---------------------------------------------------------------------------
// State projection — DB + live connections
// ---------------------------------------------------------------------------

// BuildSessionState reads all persistent state from the DB, merges it with the
// live connection map, and returns a SessionState suitable for broadcasting.
func (h *Hub) BuildSessionState(sessionID string) (*SessionState, error) {
	if h.db == nil {
		return nil, fmt.Errorf("database not available")
	}
	ctx := context.Background()

	// 1. Fetch session row.
	s, err := h.getDBSession(ctx, sessionID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}

	// 2. Parse scale values.
	var scaleValues []string
	if err := json.Unmarshal([]byte(s.scaleValues), &scaleValues); err != nil {
		scaleValues = []string{}
	}
	scale := VotingScale{Type: s.scaleType, Values: scaleValues}

	// 3. Fetch stories ordered by sort_order.
	storyRows, err := h.db.QueryContext(ctx, `
		SELECT id, title, description, sort_order, revealed
		FROM   poker_stories
		WHERE  session_id = $1
		ORDER BY sort_order ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("query stories: %w", err)
	}
	defer storyRows.Close()

	type dbStory struct {
		id          string
		title       string
		description string
		sortOrder   int
		revealed    bool
	}
	var stories []dbStory
	for storyRows.Next() {
		var st dbStory
		if err := storyRows.Scan(&st.id, &st.title, &st.description, &st.sortOrder, &st.revealed); err != nil {
			return nil, fmt.Errorf("scan story: %w", err)
		}
		stories = append(stories, st)
	}
	if err := storyRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate stories: %w", err)
	}

	// 4. Fetch all votes for this session indexed by storyID -> participantName -> value.
	voteRows, err := h.db.QueryContext(ctx, `
		SELECT story_id, participant_name, value
		FROM   poker_votes
		WHERE  session_id = $1`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("query votes: %w", err)
	}
	defer voteRows.Close()

	allVotes := make(map[string]map[string]string) // storyID -> name -> value
	for voteRows.Next() {
		var storyID, name, value string
		if err := voteRows.Scan(&storyID, &name, &value); err != nil {
			return nil, fmt.Errorf("scan vote: %w", err)
		}
		if allVotes[storyID] == nil {
			allVotes[storyID] = make(map[string]string)
		}
		allVotes[storyID][name] = value
	}
	if err := voteRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate votes: %w", err)
	}

	// 5. Resolve active story index.
	activeStoryIdx := 0
	if s.activeStoryID.Valid {
		for i, st := range stories {
			if st.id == s.activeStoryID.String {
				activeStoryIdx = i
				break
			}
		}
	}

	// 6. Build live participant list from in-memory connections.
	var participants []ParticipantState
	sc := h.getConns(sessionID)
	if sc != nil {
		sc.mu.RLock()
		for _, p := range sc.participants {
			var hasVoted bool
			var vote string
			if len(stories) > 0 && s.activeStoryID.Valid {
				activeID := s.activeStoryID.String
				stVotes := allVotes[activeID]
				if _, voted := stVotes[p.name]; voted {
					hasVoted = true
				}
				// Only expose vote value after reveal.
				if hasVoted {
					// Find whether the active story is revealed.
					for _, st := range stories {
						if st.id == activeID && st.revealed {
							vote = stVotes[p.name]
							break
						}
					}
				}
			}
			participants = append(participants, ParticipantState{
				ID:          p.id,
				Name:        p.name,
				IsOwner:     p.isOwner,
				IsConnected: p.isConnected,
				HasVoted:    hasVoted,
				Vote:        vote,
			})
		}
		sc.mu.RUnlock()
	}
	sort.Slice(participants, func(i, j int) bool {
		return participants[i].ID < participants[j].ID
	})

	// 7. Build story states.
	storyStates := make([]StoryState, 0, len(stories))
	for i, st := range stories {
		votes := allVotes[st.id]
		ss := StoryState{
			ID:          st.id,
			Title:       st.title,
			Description: st.description,
			Revealed:    st.revealed,
		}
		if st.revealed {
			ss.Votes = votes
			ss.Result = calculateResult(votes)
		} else if i == activeStoryIdx {
			ss.Votes = nil // votes exist but are hidden
		}
		storyStates = append(storyStates, ss)
	}

	// 8. Merge timer state.
	timerRunning, timerDuration, timerRemaining := h.timerState(sessionID)

	return &SessionState{
		ID:             s.id,
		Name:           s.name,
		OwnerID:        s.ownerID,
		Scale:          scale,
		Participants:   participants,
		Stories:        storyStates,
		ActiveStoryIdx: activeStoryIdx,
		VotingOpen:     s.votingOpen,
		TimerRunning:   timerRunning,
		TimerDuration:  timerDuration,
		TimerRemaining: timerRemaining,
	}, nil
}

// ---------------------------------------------------------------------------
// Vote statistics (unchanged from original)
// ---------------------------------------------------------------------------

// calculateResult computes statistical aggregates for a map of votes.
func calculateResult(votes map[string]string) *StoryResult {
	if len(votes) == 0 {
		return &StoryResult{Distribution: map[string]int{}}
	}

	dist := make(map[string]int)
	var numericValues []float64
	allNumeric := true

	for _, v := range votes {
		dist[v]++
		f, err := strconv.ParseFloat(v, 64)
		if err != nil {
			allNumeric = false
		} else {
			numericValues = append(numericValues, f)
		}
	}

	result := &StoryResult{
		Distribution: dist,
		TotalVotes:   len(votes),
	}

	var maxCount int
	var mode string
	for val, count := range dist {
		if count > maxCount || (count == maxCount && val < mode) {
			maxCount = count
			mode = val
		}
	}
	result.Mode = mode

	if allNumeric && len(numericValues) > 0 {
		var sum float64
		for _, v := range numericValues {
			sum += v
		}
		avg := sum / float64(len(numericValues))
		result.Average = math.Round(avg*100) / 100

		sort.Float64s(numericValues)
		n := len(numericValues)
		var median float64
		if n%2 == 0 {
			median = (numericValues[n/2-1] + numericValues[n/2]) / 2
		} else {
			median = numericValues[n/2]
		}
		result.Median = strconv.FormatFloat(median, 'f', -1, 64)
	}

	return result
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

// generateSessionID returns a 6-character uppercase alphanumeric string.
func generateSessionID() string {
	charset := []byte(sessionIDChars)
	n := big.NewInt(int64(len(charset)))
	b := make([]byte, sessionIDLength)
	for i := range b {
		idx, err := rand.Int(rand.Reader, n)
		if err != nil {
			var buf [1]byte
			if _, rerr := rand.Reader.Read(buf[:]); rerr == nil {
				b[i] = charset[int(buf[0])%len(charset)]
			}
			continue
		}
		b[i] = charset[idx.Int64()]
	}
	return string(b)
}

// newID generates a 16-character hex string from 8 crypto-random bytes.
func newID() string {
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
