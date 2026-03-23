package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/tmc/langchaingo/llms"
)

// ToolExecutor is a function that executes a tool call and returns the result string.
type ToolExecutor func(ctx context.Context, call llms.ToolCall) string

// ToolEffect represents a side effect from a tool call during a tool agent run.
type ToolEffect struct {
	Tool   string `json:"tool"`   // tool name
	ID     string `json:"id"`     // ID of the created object (if applicable)
	Result string `json:"result"` // raw JSON result from the tool
}

// ToolAgentResult holds the result of a tool agent chat turn.
type ToolAgentResult struct {
	Text    string       // the assistant's response text
	Effects []ToolEffect // all tool side effects from this turn
}

// StreamEvent is a single event emitted during a streaming tool agent turn.
type StreamEvent struct {
	Type string `json:"type"` // "token", "tool_call", "tool_result", "done", "error"
	Data string `json:"data"` // token text, tool name, result JSON, or error message
}

// ToolAgentConfig holds all inputs for a tool agent chat turn.
type ToolAgentConfig struct {
	SystemPrompt  string
	Messages      []llms.MessageContent // pre-built message history (system + history + user)
	Tools         []llms.Tool
	Execute       ToolExecutor // function to execute tool calls
	MaxRounds     int          // max tool-calling iterations (default 5)
	Temperature   float64      // LLM temperature (default 0.7)
	MaxTokens     int          // max output tokens per call (default 4096)
	EffectIDParse func(toolName, result string) string // optional: extract effect ID from result
}

// defaultEffectIDParse attempts to extract an ID from a tool result JSON.
func defaultEffectIDParse(_ string, result string) string {
	var parsed struct {
		ID           string `json:"id"`
		ActionableID string `json:"actionable_id"`
		MemoryID     string `json:"memory_id"`
		RoutineID    string `json:"routine_id"`
	}
	_ = json.Unmarshal([]byte(result), &parsed)
	id := parsed.ID
	if id == "" {
		id = parsed.ActionableID
	}
	if id == "" {
		id = parsed.MemoryID
	}
	if id == "" {
		id = parsed.RoutineID
	}
	return id
}

func (c *ToolAgentConfig) maxRounds() int {
	if c.MaxRounds > 0 {
		return c.MaxRounds
	}
	return 5
}

func (c *ToolAgentConfig) temperature() float64 {
	if c.Temperature > 0 {
		return c.Temperature
	}
	return 0.7
}

func (c *ToolAgentConfig) maxTokens() int {
	if c.MaxTokens > 0 {
		return c.MaxTokens
	}
	return 4096
}

func (c *ToolAgentConfig) parseEffectID(toolName, result string) string {
	if c.EffectIDParse != nil {
		return c.EffectIDParse(toolName, result)
	}
	return defaultEffectIDParse(toolName, result)
}

// RunToolAgent executes a ReAct-style tool-calling loop (non-streaming).
func RunToolAgent(ctx context.Context, model llms.Model, cfg ToolAgentConfig) (*ToolAgentResult, error) {
	messages := make([]llms.MessageContent, len(cfg.Messages))
	copy(messages, cfg.Messages)

	var effects []ToolEffect

	for round := 0; round < cfg.maxRounds(); round++ {
		resp, err := model.GenerateContent(ctx, messages,
			llms.WithTemperature(cfg.temperature()),
			llms.WithMaxTokens(cfg.maxTokens()),
			llms.WithTools(cfg.Tools),
		)
		if err != nil {
			return nil, fmt.Errorf("tool agent: round %d: %w", round, err)
		}
		if len(resp.Choices) == 0 {
			return nil, fmt.Errorf("tool agent: no choices (round %d)", round)
		}

		choice := resp.Choices[0]

		// No tool calls → done.
		if len(choice.ToolCalls) == 0 {
			return &ToolAgentResult{Text: choice.Content, Effects: effects}, nil
		}

		// Append assistant turn with tool calls.
		assistantParts := []llms.ContentPart{}
		if choice.Content != "" {
			assistantParts = append(assistantParts, llms.TextPart(choice.Content))
		}
		for _, tc := range choice.ToolCalls {
			assistantParts = append(assistantParts, llms.ToolCall{
				ID:   tc.ID,
				Type: tc.Type,
				FunctionCall: &llms.FunctionCall{
					Name:      tc.FunctionCall.Name,
					Arguments: tc.FunctionCall.Arguments,
				},
			})
		}
		messages = append(messages, llms.MessageContent{
			Role:  llms.ChatMessageTypeAI,
			Parts: assistantParts,
		})

		// Execute tools.
		for _, tc := range choice.ToolCalls {
			log.Printf("tool agent: executing %q (id=%s)", tc.FunctionCall.Name, tc.ID)
			result := cfg.Execute(ctx, tc)
			log.Printf("tool agent: %q result: %s", tc.FunctionCall.Name, result)

			effects = append(effects, ToolEffect{
				Tool:   tc.FunctionCall.Name,
				ID:     cfg.parseEffectID(tc.FunctionCall.Name, result),
				Result: result,
			})

			messages = append(messages, llms.MessageContent{
				Role: llms.ChatMessageTypeTool,
				Parts: []llms.ContentPart{
					llms.ToolCallResponse{
						ToolCallID: tc.ID,
						Name:       tc.FunctionCall.Name,
						Content:    result,
					},
				},
			})
		}
	}

	// Exhausted tool rounds — final call without tools.
	resp, err := model.GenerateContent(ctx, messages,
		llms.WithTemperature(cfg.temperature()),
		llms.WithMaxTokens(cfg.maxTokens()),
	)
	if err != nil {
		return nil, fmt.Errorf("tool agent: final generate: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("tool agent: no choices in final response")
	}
	return &ToolAgentResult{Text: resp.Choices[0].Content, Effects: effects}, nil
}

// RunToolAgentStream executes a streaming ReAct-style tool-calling loop.
// The onEvent callback is called for each token, tool call, tool result, and done event.
func RunToolAgentStream(ctx context.Context, model llms.Model, cfg ToolAgentConfig, onEvent func(StreamEvent)) (*ToolAgentResult, error) {
	messages := make([]llms.MessageContent, len(cfg.Messages))
	copy(messages, cfg.Messages)

	var effects []ToolEffect

	// Buffer tokens per round; only flush when it's the final (no tool calls) round.
	var roundBuffer []byte
	bufferedStreamFunc := func(_ context.Context, chunk []byte) error {
		roundBuffer = append(roundBuffer, chunk...)
		return nil
	}

	for round := 0; round < cfg.maxRounds(); round++ {
		roundBuffer = nil

		resp, err := model.GenerateContent(ctx, messages,
			llms.WithTemperature(cfg.temperature()),
			llms.WithMaxTokens(cfg.maxTokens()),
			llms.WithTools(cfg.Tools),
			llms.WithStreamingFunc(bufferedStreamFunc),
		)
		if err != nil {
			return nil, fmt.Errorf("tool agent stream: round %d: %w", round, err)
		}
		if len(resp.Choices) == 0 {
			return nil, fmt.Errorf("tool agent stream: no choices (round %d)", round)
		}

		choice := resp.Choices[0]

		// No tool calls → flush tokens and return.
		if len(choice.ToolCalls) == 0 {
			if len(roundBuffer) > 0 {
				onEvent(StreamEvent{Type: "token", Data: string(roundBuffer)})
			}
			result := &ToolAgentResult{Text: choice.Content, Effects: effects}
			resultJSON, _ := json.Marshal(result)
			onEvent(StreamEvent{Type: "done", Data: string(resultJSON)})
			return result, nil
		}

		// Tool calls — discard buffered tokens (they're tool call JSON noise).
		assistantParts := []llms.ContentPart{}
		if choice.Content != "" {
			assistantParts = append(assistantParts, llms.TextPart(choice.Content))
		}
		for _, tc := range choice.ToolCalls {
			assistantParts = append(assistantParts, llms.ToolCall{
				ID:   tc.ID,
				Type: tc.Type,
				FunctionCall: &llms.FunctionCall{
					Name:      tc.FunctionCall.Name,
					Arguments: tc.FunctionCall.Arguments,
				},
			})
		}
		messages = append(messages, llms.MessageContent{
			Role:  llms.ChatMessageTypeAI,
			Parts: assistantParts,
		})

		// Execute tools.
		for _, tc := range choice.ToolCalls {
			log.Printf("tool agent stream: executing %q (id=%s)", tc.FunctionCall.Name, tc.ID)
			onEvent(StreamEvent{Type: "tool_call", Data: tc.FunctionCall.Name})

			result := cfg.Execute(ctx, tc)
			log.Printf("tool agent stream: %q result: %s", tc.FunctionCall.Name, result)
			onEvent(StreamEvent{Type: "tool_result", Data: result})

			effects = append(effects, ToolEffect{
				Tool:   tc.FunctionCall.Name,
				ID:     cfg.parseEffectID(tc.FunctionCall.Name, result),
				Result: result,
			})

			messages = append(messages, llms.MessageContent{
				Role: llms.ChatMessageTypeTool,
				Parts: []llms.ContentPart{
					llms.ToolCallResponse{
						ToolCallID: tc.ID,
						Name:       tc.FunctionCall.Name,
						Content:    result,
					},
				},
			})
		}
	}

	// Exhausted tool rounds — stream final response directly.
	directStreamFunc := func(_ context.Context, chunk []byte) error {
		onEvent(StreamEvent{Type: "token", Data: string(chunk)})
		return nil
	}
	resp, err := model.GenerateContent(ctx, messages,
		llms.WithTemperature(cfg.temperature()),
		llms.WithMaxTokens(cfg.maxTokens()),
		llms.WithStreamingFunc(directStreamFunc),
	)
	if err != nil {
		return nil, fmt.Errorf("tool agent stream: final generate: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("tool agent stream: no choices in final response")
	}
	result := &ToolAgentResult{Text: resp.Choices[0].Content, Effects: effects}
	resultJSON, _ := json.Marshal(result)
	onEvent(StreamEvent{Type: "done", Data: string(resultJSON)})
	return result, nil
}

// BuildMessages constructs the standard message list: system prompt + history + user message.
func BuildMessages(systemPrompt string, history []Message, userMessage string) []llms.MessageContent {
	messages := []llms.MessageContent{
		{
			Role:  llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(systemPrompt)},
		},
	}
	for _, h := range history {
		role := llms.ChatMessageTypeHuman
		if h.Role == "assistant" {
			role = llms.ChatMessageTypeAI
		}
		messages = append(messages, llms.MessageContent{
			Role:  role,
			Parts: []llms.ContentPart{llms.TextPart(h.Content)},
		})
	}
	messages = append(messages, llms.MessageContent{
		Role:  llms.ChatMessageTypeHuman,
		Parts: []llms.ContentPart{llms.TextPart(userMessage)},
	})
	return messages
}
