// Package life implements the AI-powered life planning agent and its supporting types.
package life

import (
	"context"
	"database/sql"
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
	CalendarEvents          []GCalEvent // upcoming calendar events (may be nil)
	AutoApprove             bool        // if true, agent executes actions directly; if false, creates actionables for confirmation
	SystemContext           string      // optional extra context appended to system prompt
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
// It logs the resolution and, in future phases, may trigger follow-up agent actions.
func (a *Agent) ProcessActionableResponse(ctx context.Context, userID string, actionable ActionableRecord, response string) error {
	log.Printf("life agent: actionable %q (id=%s) resolved by user %s: %s",
		actionable.Title, actionable.ID, userID, response)
	return nil
}
