package poker

import "time"

// ClientMessage is every message a client can send over the WebSocket connection.
type ClientMessage struct {
	Type string `json:"type"`

	// join
	Name        string `json:"name,omitempty"`
	ReconnectID string `json:"reconnectId,omitempty"`

	// vote
	Value string `json:"value,omitempty"`

	// create_story
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`

	// start_timer
	Duration int `json:"duration,omitempty"`

	// remove_voter
	VoterID string `json:"voterId,omitempty"`

	// select_story
	StoryIdx int `json:"storyIdx,omitempty"`

	// set_scale
	ScaleType    string   `json:"scaleType,omitempty"`
	CustomValues []string `json:"customValues,omitempty"`
}

// ServerMessage is every message the server pushes to clients.
type ServerMessage struct {
	Type    string        `json:"type"`
	Session *SessionState `json:"session,omitempty"`
	Message string        `json:"message,omitempty"`
	Tick    int           `json:"tick,omitempty"`
}

// SessionState is the client-safe snapshot of a session sent on each broadcast.
type SessionState struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	OwnerID        string             `json:"ownerId"`
	Scale          VotingScale        `json:"scale"`
	Participants   []ParticipantState `json:"participants"`
	Stories        []StoryState       `json:"stories"`
	ActiveStoryIdx int                `json:"activeStoryIdx"`
	VotingOpen     bool               `json:"votingOpen"`
	TimerRunning   bool               `json:"timerRunning"`
	TimerDuration  int                `json:"timerDuration"`
	TimerRemaining int                `json:"timerRemaining"`
}

// ParticipantState is the per-participant view included in SessionState.
// The Vote field is only populated when the active story has been revealed.
type ParticipantState struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	IsOwner     bool   `json:"isOwner"`
	IsConnected bool   `json:"isConnected"`
	HasVoted    bool   `json:"hasVoted"`
	Vote        string `json:"vote,omitempty"`
}

// StoryState is the per-story view included in SessionState.
// Votes map is only populated after the story is revealed.
type StoryState struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Description string            `json:"description,omitempty"`
	Votes       map[string]string `json:"votes,omitempty"`
	Revealed    bool              `json:"revealed"`
	Result      *StoryResult      `json:"result,omitempty"`
}

// StoryResult holds the computed statistics for a revealed story.
type StoryResult struct {
	Average      float64        `json:"average,omitempty"`
	Median       string         `json:"median,omitempty"`
	Mode         string         `json:"mode,omitempty"`
	Distribution map[string]int `json:"distribution"`
	TotalVotes   int            `json:"totalVotes"`
}

// VotingScale describes the set of card values available in the session.
type VotingScale struct {
	Type   string   `json:"type"`   // fibonacci | tshirt | powers2 | custom
	Values []string `json:"values"`
}

// SessionSummary is a lightweight view of a session for list endpoints.
type SessionSummary struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Disabled         bool      `json:"disabled"`
	ParticipantCount int       `json:"participantCount"`
	StoryCount       int       `json:"storyCount"`
	CreatedAt        time.Time `json:"createdAt"`
}

// Predefined scales.
var (
	ScaleFibonacci = VotingScale{
		Type:   "fibonacci",
		Values: []string{"0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?"},
	}
	ScaleTShirt = VotingScale{
		Type:   "tshirt",
		Values: []string{"XS", "S", "M", "L", "XL", "XXL", "?"},
	}
	ScalePowers2 = VotingScale{
		Type:   "powers2",
		Values: []string{"1", "2", "4", "8", "16", "32", "64", "?"},
	}
)

// scaleForType returns the predefined scale for a type string, or the default
// Fibonacci scale if the type is not recognised.
func scaleForType(scaleType string) VotingScale {
	switch scaleType {
	case "tshirt":
		return ScaleTShirt
	case "powers2":
		return ScalePowers2
	default:
		return ScaleFibonacci
	}
}
