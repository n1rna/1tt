package llms

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/n1rna/1tt/api/internal/crawl"
	"github.com/tmc/langchaingo/llms"
)

// AgentRequest holds all inputs for llms.txt generation.
type AgentRequest struct {
	Pages       []crawl.CrawlPage
	DetailLevel string // "overview", "standard", "detailed"
	SourceType  string // "github" or "website"
}

// AgentResult holds the output of a completed generation.
type AgentResult struct {
	Content      string
	InputTokens  int
	OutputTokens int
}

// RunAgent runs the multi-turn tool-calling agent that produces an llms.txt
// file from a set of crawled pages.
func RunAgent(ctx context.Context, llmCfg *ai.LLMConfig, req AgentRequest) (*AgentResult, error) {
	if req.DetailLevel == "" {
		req.DetailLevel = "standard"
	}
	if req.SourceType == "" {
		req.SourceType = "website"
	}

	model, err := ai.NewLLM(llmCfg)
	if err != nil {
		return nil, fmt.Errorf("llmstxt: create LLM: %w", err)
	}

	store := newPageStore(req.Pages)

	systemPrompt := buildPrompt(req.SourceType, req.DetailLevel)
	userMessage := buildUserMessage(req.DetailLevel, req.SourceType, len(req.Pages))

	_, err = ai.RunToolAgent(ctx, model, ai.ToolAgentConfig{
		Messages:    ai.BuildMessages(systemPrompt, nil, userMessage),
		Tools:       toolDefs(),
		MaxRounds:   15,
		Temperature: 0.7,
		MaxTokens:   4096,
		Execute: func(_ context.Context, call llms.ToolCall) string {
			return executeTool(store, call.FunctionCall.Name, call.FunctionCall.Arguments)
		},
	})
	if err != nil {
		return nil, err
	}

	store.mu.Lock()
	output := store.result
	store.mu.Unlock()

	if output == "" {
		return nil, fmt.Errorf("llmstxt: write_llms_txt was never called — no output produced")
	}

	return &AgentResult{Content: output}, nil
}

// ─── Page store ──────────────────────────────────────────────────────────────

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

// ─── Tools ───────────────────────────────────────────────────────────────────

func toolDefs() []llms.Tool {
	return []llms.Tool{
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "list_pages",
				Description: "List all crawled pages with their URL, title, and content size.",
				Parameters:  map[string]any{"type": "object", "properties": map[string]any{}},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "read_page",
				Description: "Read the full markdown content of a specific crawled page by URL.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"url": map[string]any{"type": "string", "description": "The URL of the page to read"},
					},
					"required": []string{"url"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "write_llms_txt",
				Description: "Write the final llms.txt content.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"content": map[string]any{"type": "string", "description": "The complete llms.txt file content"},
					},
					"required": []string{"content"},
				},
			},
		},
	}
}

func executeTool(store *pageStore, name, args string) string {
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

// ─── Prompts ─────────────────────────────────────────────────────────────────

func buildPrompt(sourceType, detailLevel string) string {
	return `You are an expert at creating llms.txt files — structured documentation summaries designed for consumption by large language models.

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
}

func buildUserMessage(detailLevel, sourceType string, pageCount int) string {
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
