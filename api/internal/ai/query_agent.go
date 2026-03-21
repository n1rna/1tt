package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/tmc/langchaingo/llms"
)

// runQueryAgent handles single-turn query generation for all four dialects
// (postgres, sqlite, redis, elasticsearch). It uses a simple system + history
// + user chat completion with no tool calling.
func runQueryAgent(ctx context.Context, model llms.Model, cfg AgentConfig) (*RunResult, error) {
	dialect, _ := cfg.ExtraData["dialect"].(string)
	if dialect == "" {
		dialect = "postgres"
	}

	systemPrompt := BuildQueryPrompt(dialect, cfg.Context)

	// Build message slice: system, then history, then current user message.
	messages := []llms.MessageContent{
		{
			Role:  llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(systemPrompt)},
		},
	}

	for _, h := range cfg.History {
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
		Parts: []llms.ContentPart{llms.TextPart(cfg.UserMessage)},
	})

	resp, err := model.GenerateContent(ctx, messages,
		llms.WithTemperature(0.1),
		llms.WithMaxTokens(2000),
	)
	if err != nil {
		return nil, fmt.Errorf("query agent: generate content: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("query agent: no choices returned")
	}

	choice := resp.Choices[0]
	raw := choice.Content

	reasoning, queryOut := parseAiResponse(raw)

	if dialect == "elasticsearch" {
		queryOut = sanitizeEsJSON(queryOut)
	}

	inputTokens, outputTokens := extractTokens(choice.GenerationInfo)

	return &RunResult{
		Output:       queryOut,
		Reasoning:    reasoning,
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
	}, nil
}

// parseAiResponse splits an LLM response that may contain a fenced code block
// (```sql, ```json, ```redis, or plain ```) into a (reasoning, queryOut) pair.
//
//   - If a fenced block is present: everything before it is the reasoning, the
//     content inside the fence is the query.
//   - If no fence is present: the entire content is treated as the query.
func parseAiResponse(content string) (reasoning, queryOut string) {
	openFences := []string{"```sql", "```json", "```redis", "```"}
	const closeFence = "```"

	start := -1
	openLen := 0
	for _, fence := range openFences {
		idx := strings.Index(content, fence)
		if idx == -1 {
			continue
		}
		// For the plain ``` fence, only use it when no language-tagged fence matched.
		if fence == "```" && start != -1 {
			break
		}
		start = idx
		openLen = len(fence)
		break
	}

	if start == -1 {
		return "", stripMarkdownFences(content)
	}

	reasoning = strings.TrimSpace(content[:start])

	afterOpen := content[start+openLen:]
	if len(afterOpen) > 0 && afterOpen[0] == '\n' {
		afterOpen = afterOpen[1:]
	}

	end := strings.Index(afterOpen, closeFence)
	if end == -1 {
		return reasoning, strings.TrimSpace(afterOpen)
	}

	return reasoning, strings.TrimSpace(afterOpen[:end])
}

// stripMarkdownFences removes optional ```sql, ```json, ```redis, or plain ```
// fences wrapping a string.
func stripMarkdownFences(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		idx := strings.Index(s, "\n")
		if idx == -1 {
			return ""
		}
		s = s[idx+1:]
	}
	if strings.HasSuffix(s, "```") {
		idx := strings.LastIndex(s, "```")
		s = s[:idx]
	}
	return strings.TrimSpace(s)
}

// sanitizeEsJSON cleans up LLM-generated Elasticsearch JSON that may contain
// unwanted prefixes (e.g. "GET /index/_search\n{...}"), inline comments,
// or trailing text after the JSON object.
func sanitizeEsJSON(s string) string {
	s = strings.TrimSpace(s)

	// Strip HTTP method + path prefix
	if idx := strings.Index(s, "\n"); idx != -1 && idx < 80 {
		line := strings.TrimSpace(s[:idx])
		upper := strings.ToUpper(line)
		if strings.HasPrefix(upper, "GET ") || strings.HasPrefix(upper, "POST ") ||
			strings.HasPrefix(upper, "PUT ") || strings.HasPrefix(upper, "DELETE ") {
			s = strings.TrimSpace(s[idx+1:])
		}
	}

	// Find the first '{' — discard everything before it
	braceIdx := strings.Index(s, "{")
	if braceIdx == -1 {
		return s
	}
	s = s[braceIdx:]

	// Remove single-line comments
	lines := strings.Split(s, "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") {
			continue
		}
		if commentIdx := strings.Index(line, "//"); commentIdx > 0 {
			before := strings.TrimSpace(line[:commentIdx])
			if len(before) > 0 {
				line = before
			}
		}
		cleaned = append(cleaned, line)
	}
	s = strings.Join(cleaned, "\n")

	// Find matching closing '}' by counting braces
	depth := 0
	endIdx := -1
	for i, ch := range s {
		if ch == '{' {
			depth++
		} else if ch == '}' {
			depth--
			if depth == 0 {
				endIdx = i
				break
			}
		}
	}
	if endIdx >= 0 {
		s = s[:endIdx+1]
	}

	return strings.TrimSpace(s)
}

// extractTokens reads prompt/completion token counts from a GenerationInfo map.
// It handles both OpenAI-style keys ("PromptTokens"/"CompletionTokens") and
// Anthropic-style keys ("InputTokens"/"OutputTokens").
func extractTokens(info map[string]any) (inputTokens, outputTokens int) {
	if info == nil {
		return 0, 0
	}

	// OpenAI-compatible keys (checked first as they overwrite the Anthropic values
	// when present, which is the expected behavior for OpenAI endpoints).
	if v, ok := info["PromptTokens"]; ok {
		inputTokens = toInt(v)
	}
	if v, ok := info["CompletionTokens"]; ok {
		outputTokens = toInt(v)
	}

	// Anthropic keys — only apply if no OpenAI keys were found.
	if inputTokens == 0 {
		if v, ok := info["InputTokens"]; ok {
			inputTokens = toInt(v)
		}
	}
	if outputTokens == 0 {
		if v, ok := info["OutputTokens"]; ok {
			outputTokens = toInt(v)
		}
	}

	return inputTokens, outputTokens
}

func toInt(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float32:
		return int(n)
	case float64:
		return int(n)
	}
	return 0
}
