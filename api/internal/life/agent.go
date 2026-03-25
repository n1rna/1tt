// Package life implements the AI-powered life planning agent and its supporting types.
package life

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/tmc/langchaingo/llms"
)

// Agent is the life planning AI agent. It wraps the generic ai.ToolAgent
// with life-specific tools, context, and database access.
type Agent struct {
	llmCfg     ai.LLMConfig
	db         *sql.DB
	gcalClient *GCalClient // may be nil if Google Calendar is not configured
}

// NewAgent constructs an Agent from the given LLM configuration, database, and
// optional Google Calendar client.
func NewAgent(llmCfg ai.LLMConfig, db *sql.DB, gcalClient *GCalClient) *Agent {
	return &Agent{llmCfg: llmCfg, db: db, gcalClient: gcalClient}
}

// Type aliases so existing callers (handlers, channels, scheduler) continue to
// compile without changes. The canonical types now live in the ai package.
type ToolEffect = ai.ToolEffect
type StreamEvent = ai.StreamEvent
type ChatResult = ai.ToolAgentResult

// ChatRequest holds all inputs required for a single chat turn.
type ChatRequest struct {
	UserID                  string
	Message                 string
	History                 []Message // previous messages in the conversation, oldest first
	Memories                []Memory
	Profile                 *Profile
	Routines                []Routine
	PendingActionablesCount int
	CalendarEvents          []GCalEvent       // upcoming calendar events (may be nil)
	RoutineEventLinks       map[string][]string // maps routine_id → list of linked event summaries
	AutoApprove             bool              // if true, agent executes actions directly; if false, creates actionables for confirmation
	SystemContext           string            // optional extra context appended to system prompt
}

// Message represents a single turn in the conversation history.
type Message struct {
	Role    string // "user" or "assistant"
	Content string
}

// Memory is a user fact or preference stored in life_memories.
type Memory struct {
	ID       string
	Category string
	Content  string
}

// Profile holds the user's life profile settings.
type Profile struct {
	Timezone  string
	WakeTime  string
	SleepTime string
}

// Routine is a summary of an active life_routines row used in the system prompt.
type Routine struct {
	ID          string
	Name        string
	Type        string
	Description string
}

// ActionableRecord holds the data for a resolved actionable, used when feeding
// the resolution back to the agent.
type ActionableRecord struct {
	ID          string
	Type        string
	Title       string
	Description string
}

// buildToolAgentConfig constructs the common ToolAgentConfig from a ChatRequest.
func (a *Agent) buildToolAgentConfig(req ChatRequest) ai.ToolAgentConfig {
	systemPrompt := buildSystemPrompt(
		req.Profile,
		req.Memories,
		req.Routines,
		req.PendingActionablesCount,
		req.CalendarEvents,
		req.RoutineEventLinks,
		req.AutoApprove,
		time.Now().UTC(),
	)
	if req.SystemContext != "" {
		systemPrompt += "\n\n## Additional context\n" + req.SystemContext
	}

	// Convert life.Message → ai.Message for BuildMessages.
	history := make([]ai.Message, len(req.History))
	for i, h := range req.History {
		history[i] = ai.Message{Role: h.Role, Content: h.Content}
	}

	return ai.ToolAgentConfig{
		Messages: ai.BuildMessages(systemPrompt, history, req.Message),
		Tools:    toolDefs(),
		Execute: func(ctx context.Context, call llms.ToolCall) string {
			return executeTool(ctx, a.db, a.gcalClient, req.UserID, req.AutoApprove, call)
		},
		MaxRounds:   5,
		Temperature: 0.7,
		MaxTokens:   4096,
	}
}

// Chat executes a single conversation turn with a ReAct tool-calling loop.
func (a *Agent) Chat(ctx context.Context, req ChatRequest) (*ChatResult, error) {
	model, err := ai.NewLLM(&a.llmCfg)
	if err != nil {
		return nil, err
	}
	return ai.RunToolAgent(ctx, model, a.buildToolAgentConfig(req))
}

// ChatStream executes a single conversation turn with streaming. The onEvent
// callback is called for each token, tool call, tool result, and final done event.
func (a *Agent) ChatStream(ctx context.Context, req ChatRequest, onEvent func(StreamEvent)) (*ChatResult, error) {
	model, err := ai.NewLLM(&a.llmCfg)
	if err != nil {
		return nil, err
	}
	return ai.RunToolAgentStream(ctx, model, a.buildToolAgentConfig(req), onEvent)
}

// GCalClient returns the Google Calendar client associated with this agent,
// or nil if one was not configured.
func (a *Agent) GCalClient() *GCalClient {
	return a.gcalClient
}

// ProcessActionableResponse is called after a user responds to an actionable.
// It feeds the response back to the agent in the scheduler conversation so the
// agent can take follow-up actions (update calendar, create tasks, etc.).
func (a *Agent) ProcessActionableResponse(ctx context.Context, db *sql.DB, userID string, actionable ActionableRecord, response string) error {
	log.Printf("life agent: actionable %q (id=%s) resolved by user %s: %s",
		actionable.Title, actionable.ID, userID, response)

	// Build a prompt summarizing what happened
	prompt := fmt.Sprintf(
		"The user responded to the actionable \"%s\" (type: %s).\nTheir response: %s\n\n"+
			"Based on this response, take any appropriate follow-up actions: update calendar events, "+
			"create tasks, adjust routines, save preferences to memory, etc. "+
			"Use your tools — do NOT just acknowledge in text. If no action is needed, that's fine too.",
		actionable.Title, actionable.Type, response,
	)

	// Find the scheduler conversation for context
	var convID string
	err := db.QueryRowContext(ctx,
		`SELECT id FROM life_conversations WHERE user_id = $1 AND channel = 'scheduler' ORDER BY updated_at DESC LIMIT 1`,
		userID,
	).Scan(&convID)
	if err != nil {
		// No scheduler conversation — run without history
		convID = ""
	}

	// Load minimal history from the scheduler conversation
	var history []Message
	if convID != "" {
		rows, err := db.QueryContext(ctx,
			`SELECT role, content FROM life_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10`,
			convID,
		)
		if err == nil {
			for rows.Next() {
				var m Message
				if err := rows.Scan(&m.Role, &m.Content); err == nil {
					history = append(history, m)
				}
			}
			rows.Close()
			// Reverse to oldest-first
			for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
				history[i], history[j] = history[j], history[i]
			}
		}
	}

	// Load user context
	var profile Profile
	var wakeTime, sleepTime sql.NullString
	_ = db.QueryRowContext(ctx,
		`SELECT timezone, wake_time, sleep_time FROM life_profiles WHERE user_id = $1`,
		userID,
	).Scan(&profile.Timezone, &wakeTime, &sleepTime)
	if wakeTime.Valid {
		profile.WakeTime = wakeTime.String
	}
	if sleepTime.Valid {
		profile.SleepTime = sleepTime.String
	}

	memRows, _ := db.QueryContext(ctx,
		`SELECT id, category, content FROM life_memories WHERE user_id = $1 AND active = TRUE`, userID)
	var memories []Memory
	if memRows != nil {
		for memRows.Next() {
			var m Memory
			if err := memRows.Scan(&m.ID, &m.Category, &m.Content); err == nil {
				memories = append(memories, m)
			}
		}
		memRows.Close()
	}

	// Call the agent with auto-approve so it can act immediately
	result, err := a.Chat(ctx, ChatRequest{
		UserID:      userID,
		Message:     prompt,
		History:     history,
		Memories:    memories,
		Profile:     &profile,
		AutoApprove: true,
		SystemContext: "The user just responded to an actionable. Take follow-up actions using tools if appropriate. " +
			"Do NOT create new actionables asking the same question. Focus on executing the user's choice.",
	})
	if err != nil {
		return fmt.Errorf("process actionable response: %w", err)
	}

	log.Printf("life agent: actionable response processed — %d effects", len(result.Effects))
	return nil
}
