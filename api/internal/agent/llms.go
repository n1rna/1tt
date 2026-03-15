package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	anthropicoption "github.com/anthropics/anthropic-sdk-go/option"
	openai "github.com/openai/openai-go/v2"
	openaioption "github.com/openai/openai-go/v2/option"
	"github.com/openai/openai-go/v2/packages/param"

	"github.com/n1rna/1two/api/internal/crawl"
)

// LLMConfig holds the configuration for the LLM provider.
type LLMConfig struct {
	Provider string // "openai" or "anthropic"
	APIKey   string
	BaseURL  string // for OpenAI-compatible providers (e.g. Kimi K2)
	Model    string // model ID
}

const systemPrompt = `You are an expert at creating llms.txt files — structured documentation summaries designed for consumption by large language models.

You have access to tools that let you inspect content from a website or source code repository. Use them to understand the structure, read key content, and produce a well-organized llms.txt file.

The llms.txt format:
# Project or Site Name
> Brief one-line description of what this project/site is

## Section Name
- [Page or File Title](URL): Brief description of what this covers

Your workflow:
1. First, call list_pages to see all available pages/files with their URLs, titles, and sizes.
2. Call read_page on key items to understand their content. Prioritize:
   - README files (understand the project purpose)
   - Documentation pages or docs/ directory
   - API references and guides
   - Configuration files (understand the tech stack)
3. Once you understand the structure, call write_llms_txt with the final output.

Guidelines:
- Group content under logical section headings
- Focus on documentation, API references, guides, tutorials, and key source modules
- Exclude marketing, legal, duplicate, and boilerplate content
- Write concise, informative descriptions for each link
- Order sections from most important (getting started, overview) to least
- For source code repos: include sections for Setup, Architecture, Key Modules, API, Configuration
- For documentation sites: include sections for Getting Started, Guides, API Reference, Examples
- For 'overview' level: include only the most important top-level items, minimal sections
- For 'standard' level: balanced coverage with descriptions
- For 'detailed' level: comprehensive coverage, include subpages/files, extended descriptions

IMPORTANT: You MUST call write_llms_txt with your final output. Do not just output text.`

// TokenUsage holds token counts from the agent execution.
type TokenUsage struct {
	InputTokens  int
	OutputTokens int
}

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

// --- Tool: list_pages ---

type listPagesTool struct {
	store *pageStore
}

func (t *listPagesTool) Name() string { return "list_pages" }
func (t *listPagesTool) Description() string {
	return "List all crawled pages with their URL, title, and content size. Use this first to understand the site structure before reading specific pages."
}
func (t *listPagesTool) Execute(ctx context.Context, args string) (string, error) {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Total pages: %d\n\n", len(t.store.pages)))
	for _, p := range t.store.pages {
		title := p.Title
		if title == "" {
			title = "(no title)"
		}
		contentSize := len(p.Markdown)
		sb.WriteString(fmt.Sprintf("- %s | %s | %d bytes\n", p.URL, title, contentSize))
	}
	return sb.String(), nil
}

// --- Tool: read_page ---

type readPageTool struct {
	store *pageStore
}

func (t *readPageTool) Name() string { return "read_page" }
func (t *readPageTool) Description() string {
	return "Read the full markdown content of a specific crawled page by URL. Use this to inspect pages that seem important for building the llms.txt file."
}
func (t *readPageTool) Execute(ctx context.Context, args string) (string, error) {
	var params struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil {
		// Try raw string as URL
		params.URL = strings.TrimSpace(args)
	}
	if params.URL == "" {
		return "", fmt.Errorf("url parameter is required")
	}

	page, ok := t.store.byURL[params.URL]
	if !ok {
		return fmt.Sprintf("Page not found: %s", params.URL), nil
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
	return sb.String(), nil
}

// --- Tool: write_llms_txt ---

type writeLlmsTxtTool struct {
	store *pageStore
}

func (t *writeLlmsTxtTool) Name() string { return "write_llms_txt" }
func (t *writeLlmsTxtTool) Description() string {
	return "Write the final llms.txt content. Call this once you have analyzed the site structure and page content. Pass the complete llms.txt file content."
}
func (t *writeLlmsTxtTool) Execute(ctx context.Context, args string) (string, error) {
	var params struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil {
		return "", fmt.Errorf("invalid arguments: %w", err)
	}
	if params.Content == "" {
		return "", fmt.Errorf("content parameter is required")
	}

	t.store.mu.Lock()
	t.store.result = params.Content
	t.store.mu.Unlock()

	return "llms.txt written successfully.", nil
}

// tool is a common interface for the three agent tools.
type tool interface {
	Name() string
	Description() string
	Execute(ctx context.Context, args string) (string, error)
}

// executeTool dispatches a tool call by name and returns the string result.
func executeTool(ctx context.Context, tools []tool, name, args string) string {
	for _, t := range tools {
		if t.Name() == name {
			result, err := t.Execute(ctx, args)
			if err != nil {
				return fmt.Sprintf("error: %v", err)
			}
			return result
		}
	}
	return fmt.Sprintf("unknown tool: %s", name)
}

// buildInputPrompt returns the initial user message based on source type.
func buildInputPrompt(detailLevel, sourceType string, pageCount int) string {
	if sourceType == "github" {
		return fmt.Sprintf(
			"Generate an llms.txt file for this GitHub repository. Detail level: %s. "+
				"There are %d files available from the repo. "+
				"Start by listing all files to understand the project structure, "+
				"then read the README and key documentation files, "+
				"then read important source files to understand the architecture, "+
				"and finally call write_llms_txt with the complete output.",
			detailLevel, pageCount,
		)
	}
	return fmt.Sprintf(
		"Generate an llms.txt file for this website. Detail level: %s. "+
			"There are %d crawled pages available. "+
			"Start by listing all pages, then read the important ones, "+
			"and finally call write_llms_txt with the complete output.",
		detailLevel, pageCount,
	)
}

// --- OpenAI-compatible agent loop ---

// openaiToolDefs returns the tool definitions for the OpenAI chat completions API.
func openaiToolDefs(tools []tool) []openai.ChatCompletionToolUnionParam {
	defs := make([]openai.ChatCompletionToolUnionParam, 0, len(tools))
	for _, t := range tools {
		var schema openai.FunctionParameters
		switch t.Name() {
		case "list_pages":
			schema = openai.FunctionParameters{
				"type":       "object",
				"properties": map[string]any{},
			}
		case "read_page":
			schema = openai.FunctionParameters{
				"type": "object",
				"properties": map[string]any{
					"url": map[string]any{
						"type":        "string",
						"description": "The URL of the page to read",
					},
				},
				"required": []string{"url"},
			}
		case "write_llms_txt":
			schema = openai.FunctionParameters{
				"type": "object",
				"properties": map[string]any{
					"content": map[string]any{
						"type":        "string",
						"description": "The complete llms.txt file content",
					},
				},
				"required": []string{"content"},
			}
		}

		fn := openai.FunctionDefinitionParam{
			Name:        t.Name(),
			Description: openai.String(t.Description()),
			Parameters:  schema,
		}
		defs = append(defs, openai.ChatCompletionFunctionTool(fn))
	}
	return defs
}

func runOpenAILoop(ctx context.Context, cfg LLMConfig, tools []tool, inputPrompt string) (TokenUsage, error) {
	client := openai.NewClient(
		openaioption.WithAPIKey(cfg.APIKey),
		openaioption.WithBaseURL(cfg.BaseURL),
	)

	toolDefs := openaiToolDefs(tools)
	messages := []openai.ChatCompletionMessageParamUnion{
		openai.SystemMessage(systemPrompt),
		openai.UserMessage(inputPrompt),
	}

	var totalUsage TokenUsage
	const maxIterations = 15

	for i := 0; i < maxIterations; i++ {
		resp, err := client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
			Model:       cfg.Model,
			Messages:    messages,
			Tools:       toolDefs,
			Temperature: param.NewOpt(0.7),
		})
		if err != nil {
			return totalUsage, fmt.Errorf("openai call: %w", err)
		}

		totalUsage.InputTokens += int(resp.Usage.PromptTokens)
		totalUsage.OutputTokens += int(resp.Usage.CompletionTokens)

		if len(resp.Choices) == 0 {
			break
		}

		choice := resp.Choices[0]
		toolCalls := choice.Message.ToolCalls

		log.Printf("agent: iteration %d — %d tool calls, %d tokens so far (in=%d out=%d)",
			i+1, len(toolCalls),
			totalUsage.InputTokens+totalUsage.OutputTokens,
			totalUsage.InputTokens, totalUsage.OutputTokens,
		)

		if len(toolCalls) == 0 {
			// No tool calls — the model is done.
			break
		}

		// Append the assistant message (with its tool calls) to the conversation.
		assistantParam := openai.ChatCompletionAssistantMessageParam{}
		for _, tc := range toolCalls {
			assistantParam.ToolCalls = append(assistantParam.ToolCalls, tc.ToParam())
		}
		messages = append(messages, openai.ChatCompletionMessageParamUnion{OfAssistant: &assistantParam})

		// Execute each tool and append its result.
		for _, tc := range toolCalls {
			name := tc.Function.Name
			args := tc.Function.Arguments
			result := executeTool(ctx, tools, name, args)
			log.Printf("agent: tool %q → %d bytes result", name, len(result))
			messages = append(messages, openai.ToolMessage(result, tc.ID))
		}
	}

	return totalUsage, nil
}

// --- Anthropic agent loop ---

// anthropicToolDefs returns the tool definitions for the Anthropic Messages API.
func anthropicToolDefs(tools []tool) []anthropic.ToolUnionParam {
	defs := make([]anthropic.ToolUnionParam, 0, len(tools))
	for _, t := range tools {
		var schema anthropic.ToolInputSchemaParam
		switch t.Name() {
		case "list_pages":
			schema = anthropic.ToolInputSchemaParam{
				Properties: map[string]any{},
			}
		case "read_page":
			schema = anthropic.ToolInputSchemaParam{
				Properties: map[string]any{
					"url": map[string]any{
						"type":        "string",
						"description": "The URL of the page to read",
					},
				},
				Required: []string{"url"},
			}
		case "write_llms_txt":
			schema = anthropic.ToolInputSchemaParam{
				Properties: map[string]any{
					"content": map[string]any{
						"type":        "string",
						"description": "The complete llms.txt file content",
					},
				},
				Required: []string{"content"},
			}
		}

		toolParam := anthropic.ToolParam{
			Name:        t.Name(),
			Description: anthropic.String(t.Description()),
			InputSchema: schema,
		}
		defs = append(defs, anthropic.ToolUnionParam{OfTool: &toolParam})
	}
	return defs
}

func runAnthropicLoop(ctx context.Context, cfg LLMConfig, tools []tool, inputPrompt string) (TokenUsage, error) {
	client := anthropic.NewClient(
		anthropicoption.WithAPIKey(cfg.APIKey),
	)

	toolDefs := anthropicToolDefs(tools)
	messages := []anthropic.MessageParam{
		anthropic.NewUserMessage(anthropic.NewTextBlock(inputPrompt)),
	}

	var totalUsage TokenUsage
	const maxIterations = 15

	for i := 0; i < maxIterations; i++ {
		resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
			Model:     anthropic.Model(cfg.Model),
			MaxTokens: 4096,
			Messages:  messages,
			Tools:     toolDefs,
			System: []anthropic.TextBlockParam{
				{Text: systemPrompt},
			},
		})
		if err != nil {
			return totalUsage, fmt.Errorf("anthropic call: %w", err)
		}

		totalUsage.InputTokens += int(resp.Usage.InputTokens)
		totalUsage.OutputTokens += int(resp.Usage.OutputTokens)

		// Collect tool_use blocks from the response.
		var toolUseBlocks []anthropic.ContentBlockUnion
		for _, block := range resp.Content {
			if block.Type == "tool_use" {
				toolUseBlocks = append(toolUseBlocks, block)
			}
		}

		log.Printf("agent: iteration %d — %d tool calls, %d tokens so far (in=%d out=%d)",
			i+1, len(toolUseBlocks),
			totalUsage.InputTokens+totalUsage.OutputTokens,
			totalUsage.InputTokens, totalUsage.OutputTokens,
		)

		if resp.StopReason != anthropic.StopReasonToolUse || len(toolUseBlocks) == 0 {
			// Not a tool call turn — the model is done.
			break
		}

		// Append the assistant message (containing its response content) to the conversation.
		assistantContentBlocks := make([]anthropic.ContentBlockParamUnion, 0, len(resp.Content))
		for _, block := range resp.Content {
			if block.Type == "text" {
				assistantContentBlocks = append(assistantContentBlocks,
					anthropic.NewTextBlock(block.Text))
			} else if block.Type == "tool_use" {
				assistantContentBlocks = append(assistantContentBlocks,
					anthropic.NewToolUseBlock(block.ID, block.Input, block.Name))
			}
		}
		messages = append(messages, anthropic.NewAssistantMessage(assistantContentBlocks...))

		// Execute each tool_use block and collect results into a single user message.
		toolResultBlocks := make([]anthropic.ContentBlockParamUnion, 0, len(toolUseBlocks))
		for _, block := range toolUseBlocks {
			args := string(block.Input)
			result := executeTool(ctx, tools, block.Name, args)
			log.Printf("agent: tool %q → %d bytes result", block.Name, len(result))
			toolResultBlocks = append(toolResultBlocks,
				anthropic.NewToolResultBlock(block.ID, result, false))
		}
		messages = append(messages, anthropic.NewUserMessage(toolResultBlocks...))
	}

	return totalUsage, nil
}

// GenerateLlmsTxt creates an AI agent that analyzes crawled pages and produces
// a structured llms.txt file. The agent uses tools to inspect pages selectively
// rather than dumping everything into context.
//
// sourceType should be "github" for cloned repos, or "website" for crawled sites.
func GenerateLlmsTxt(ctx context.Context, llmCfg LLMConfig, pages []crawl.CrawlPage, detailLevel string, sourceType string) (string, TokenUsage, error) {
	store := newPageStore(pages)

	tools := []tool{
		&listPagesTool{store: store},
		&readPageTool{store: store},
		&writeLlmsTxtTool{store: store},
	}

	inputPrompt := buildInputPrompt(detailLevel, sourceType, len(pages))

	var usage TokenUsage
	var err error

	switch llmCfg.Provider {
	case "anthropic":
		usage, err = runAnthropicLoop(ctx, llmCfg, tools, inputPrompt)
	default: // "openai" — works with any OpenAI-compatible API (Kimi K2, OpenAI, etc.)
		usage, err = runOpenAILoop(ctx, llmCfg, tools, inputPrompt)
	}
	if err != nil {
		return "", TokenUsage{}, err
	}

	store.mu.Lock()
	result := store.result
	store.mu.Unlock()

	if result == "" {
		return "", usage, fmt.Errorf("agent: write_llms_txt was never called — no output produced")
	}

	return result, usage, nil
}
