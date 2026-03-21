package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/tmc/langchaingo/llms"

	"github.com/n1rna/1tt/api/internal/crawl"
)

const maxLlmsTxtIterations = 15

// pageStore holds crawled pages indexed by URL for tool access.
type pageStore struct {
	pages  []crawl.CrawlPage
	byURL  map[string]*crawl.CrawlPage
	result string
	mu     sync.Mutex
}

func newPageStore(pages []crawl.CrawlPage) *pageStore {
	byURL := make(map[string]*crawl.CrawlPage, len(pages))
	for i := range pages {
		byURL[pages[i].URL] = &pages[i]
	}
	return &pageStore{pages: pages, byURL: byURL}
}

// llmsTxtToolDefs returns the langchaingo tool definitions for the three agent tools.
func llmsTxtToolDefs() []llms.Tool {
	return []llms.Tool{
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "list_pages",
				Description: "List all crawled pages with their URL, title, and content size. Use this first to understand the site structure before reading specific pages.",
				Parameters: map[string]any{
					"type":       "object",
					"properties": map[string]any{},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "read_page",
				Description: "Read the full markdown content of a specific crawled page by URL. Use this to inspect pages that seem important for building the llms.txt file.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"url": map[string]any{
							"type":        "string",
							"description": "The URL of the page to read",
						},
					},
					"required": []string{"url"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "write_llms_txt",
				Description: "Write the final llms.txt content. Call this once you have analyzed the site structure and page content. Pass the complete llms.txt file content.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"content": map[string]any{
							"type":        "string",
							"description": "The complete llms.txt file content",
						},
					},
					"required": []string{"content"},
				},
			},
		},
	}
}

// executeLlmsTool dispatches a tool call by name against the page store.
func executeLlmsTool(ctx context.Context, store *pageStore, name, args string) string {
	switch name {
	case "list_pages":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Total pages: %d\n\n", len(store.pages)))
		for _, p := range store.pages {
			title := p.Title
			if title == "" {
				title = "(no title)"
			}
			sb.WriteString(fmt.Sprintf("- %s | %s | %d bytes\n", p.URL, title, len(p.Markdown)))
		}
		return sb.String()

	case "read_page":
		var params struct {
			URL string `json:"url"`
		}
		if err := json.Unmarshal([]byte(args), &params); err != nil {
			params.URL = strings.TrimSpace(args)
		}
		if params.URL == "" {
			return "error: url parameter is required"
		}
		page, ok := store.byURL[params.URL]
		if !ok {
			return fmt.Sprintf("Page not found: %s", params.URL)
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("URL: %s\n", page.URL))
		if page.Title != "" {
			sb.WriteString(fmt.Sprintf("Title: %s\n", page.Title))
		}
		sb.WriteString(fmt.Sprintf("Status: %d\n\n", page.StatusCode))
		content := page.Markdown
		if len(content) > 12000 {
			content = content[:12000] + "\n\n[content truncated at 12000 bytes]"
		}
		sb.WriteString(content)
		return sb.String()

	case "write_llms_txt":
		var params struct {
			Content string `json:"content"`
		}
		if err := json.Unmarshal([]byte(args), &params); err != nil {
			return fmt.Sprintf("error: invalid arguments: %v", err)
		}
		if params.Content == "" {
			return "error: content parameter is required"
		}
		store.mu.Lock()
		store.result = params.Content
		store.mu.Unlock()
		return "llms.txt written successfully."

	default:
		return fmt.Sprintf("unknown tool: %s", name)
	}
}

// runLlmsTxtAgent runs the multi-turn tool-calling agent that produces an
// llms.txt file from a set of crawled pages.
func runLlmsTxtAgent(ctx context.Context, model llms.Model, cfg AgentConfig) (*RunResult, error) {
	// Extract pages from ExtraData.
	pagesRaw, ok := cfg.ExtraData["pages"]
	if !ok {
		return nil, fmt.Errorf("llms_txt agent: missing 'pages' in ExtraData")
	}
	pages, ok := pagesRaw.([]crawl.CrawlPage)
	if !ok {
		return nil, fmt.Errorf("llms_txt agent: 'pages' must be []crawl.CrawlPage")
	}

	detailLevel, _ := cfg.ExtraData["detailLevel"].(string)
	if detailLevel == "" {
		detailLevel = "standard"
	}
	sourceType, _ := cfg.ExtraData["sourceType"].(string)
	if sourceType == "" {
		sourceType = "website"
	}

	store := newPageStore(pages)
	toolDefs := llmsTxtToolDefs()

	systemPrompt := BuildLlmsTxtPrompt(sourceType, detailLevel)
	userMessage := BuildLlmsTxtUserMessage(detailLevel, sourceType, len(pages))

	// Build the initial message list.
	messages := []llms.MessageContent{
		{
			Role:  llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(systemPrompt)},
		},
		{
			Role:  llms.ChatMessageTypeHuman,
			Parts: []llms.ContentPart{llms.TextPart(userMessage)},
		},
	}

	var totalInput, totalOutput int

	for i := 0; i < maxLlmsTxtIterations; i++ {
		resp, err := model.GenerateContent(ctx, messages,
			llms.WithTemperature(0.7),
			llms.WithMaxTokens(4096),
			llms.WithTools(toolDefs),
		)
		if err != nil {
			return nil, fmt.Errorf("llms_txt agent: iteration %d: %w", i+1, err)
		}

		if len(resp.Choices) == 0 {
			break
		}

		choice := resp.Choices[0]
		in, out := extractTokens(choice.GenerationInfo)
		totalInput += in
		totalOutput += out

		toolCalls := choice.ToolCalls

		log.Printf("ai: llms_txt iteration %d — %d tool calls, tokens so far (in=%d out=%d)",
			i+1, len(toolCalls), totalInput, totalOutput)

		if len(toolCalls) == 0 {
			// No tool calls — the model is done. If write_llms_txt was already
			// called, we have a result; otherwise the model quit early.
			break
		}

		// Append the assistant message (with its tool calls) to the conversation.
		assistantParts := make([]llms.ContentPart, 0, len(toolCalls)+1)
		if choice.Content != "" {
			assistantParts = append(assistantParts, llms.TextPart(choice.Content))
		}
		for _, tc := range toolCalls {
			assistantParts = append(assistantParts, tc)
		}
		messages = append(messages, llms.MessageContent{
			Role:  llms.ChatMessageTypeAI,
			Parts: assistantParts,
		})

		// Execute each tool call and append its result.
		for _, tc := range toolCalls {
			result := executeLlmsTool(ctx, store, tc.FunctionCall.Name, tc.FunctionCall.Arguments)
			log.Printf("ai: tool %q → %d bytes result", tc.FunctionCall.Name, len(result))
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

	store.mu.Lock()
	result := store.result
	store.mu.Unlock()

	if result == "" {
		return nil, fmt.Errorf("llms_txt agent: write_llms_txt was never called — no output produced")
	}

	return &RunResult{
		Output:       result,
		InputTokens:  totalInput,
		OutputTokens: totalOutput,
	}, nil
}
