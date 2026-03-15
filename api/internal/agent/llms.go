package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Ingenimax/agent-sdk-go/pkg/agent"
	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
	anthropicllm "github.com/Ingenimax/agent-sdk-go/pkg/llm/anthropic"
	openaillm "github.com/Ingenimax/agent-sdk-go/pkg/llm/openai"
	"github.com/Ingenimax/agent-sdk-go/pkg/memory"
	"github.com/Ingenimax/agent-sdk-go/pkg/multitenancy"
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
	pages   []crawl.CrawlPage
	byURL   map[string]*crawl.CrawlPage
	result  string
	mu      sync.Mutex
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

func (t *listPagesTool) Name() string        { return "list_pages" }
func (t *listPagesTool) Description() string {
	return "List all crawled pages with their URL, title, and content size. Use this first to understand the site structure before reading specific pages."
}
func (t *listPagesTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{}
}
func (t *listPagesTool) Run(ctx context.Context, input string) (string, error) {
	return t.Execute(ctx, input)
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

func (t *readPageTool) Name() string        { return "read_page" }
func (t *readPageTool) Description() string {
	return "Read the full markdown content of a specific crawled page by URL. Use this to inspect pages that seem important for building the llms.txt file."
}
func (t *readPageTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"url": {
			Type:        "string",
			Description: "The URL of the page to read",
			Required:    true,
		},
	}
}
func (t *readPageTool) Run(ctx context.Context, input string) (string, error) {
	return t.Execute(ctx, input)
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

func (t *writeLlmsTxtTool) Name() string        { return "write_llms_txt" }
func (t *writeLlmsTxtTool) Description() string {
	return "Write the final llms.txt content. Call this once you have analyzed the site structure and page content. Pass the complete llms.txt file content."
}
func (t *writeLlmsTxtTool) Parameters() map[string]interfaces.ParameterSpec {
	return map[string]interfaces.ParameterSpec{
		"content": {
			Type:        "string",
			Description: "The complete llms.txt file content",
			Required:    true,
		},
	}
}
func (t *writeLlmsTxtTool) Run(ctx context.Context, input string) (string, error) {
	return t.Execute(ctx, input)
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

// GenerateLlmsTxt creates an AI agent that analyzes crawled pages and produces
// a structured llms.txt file. The agent uses tools to inspect pages selectively
// rather than dumping everything into context.
//
// sourceType should be "github" for cloned repos, or "website" for crawled sites.
func GenerateLlmsTxt(ctx context.Context, llmCfg LLMConfig, pages []crawl.CrawlPage, detailLevel string, sourceType string) (string, TokenUsage, error) {
	// The agent-sdk-go memory system requires org ID and conversation ID in context.
	ctx = multitenancy.WithOrgID(ctx, "1two")
	ctx = memory.WithConversationID(ctx, fmt.Sprintf("llms-%d", time.Now().UnixNano()))

	store := newPageStore(pages)

	// Create LLM client based on provider
	var llmClient interfaces.LLM
	switch llmCfg.Provider {
	case "anthropic":
		llmClient = anthropicllm.NewClient(
			llmCfg.APIKey,
			anthropicllm.WithModel(llmCfg.Model),
		)
	default: // "openai" — works with any OpenAI-compatible API (Kimi K2, OpenAI, etc.)
		opts := []openaillm.Option{
			openaillm.WithModel(llmCfg.Model),
		}
		if llmCfg.BaseURL != "" {
			opts = append(opts, openaillm.WithBaseURL(llmCfg.BaseURL))
		}
		llmClient = openaillm.NewClient(llmCfg.APIKey, opts...)
	}

	// Create the agent with tools
	a, err := agent.NewAgent(
		agent.WithLLM(llmClient),
		agent.WithMemory(memory.NewConversationBuffer()),
		agent.WithSystemPrompt(systemPrompt),
		agent.WithName("llms-txt-generator"),
		agent.WithTools(
			&listPagesTool{store: store},
			&readPageTool{store: store},
			&writeLlmsTxtTool{store: store},
		),
		agent.WithMaxIterations(15),
		agent.WithRequirePlanApproval(false),
	)
	if err != nil {
		return "", TokenUsage{}, fmt.Errorf("agent: create agent: %w", err)
	}

	// Build the input prompt based on source type
	var input string
	if sourceType == "github" {
		input = fmt.Sprintf(
			"Generate an llms.txt file for this GitHub repository. Detail level: %s. "+
				"There are %d files available from the repo. "+
				"Start by listing all files to understand the project structure, "+
				"then read the README and key documentation files, "+
				"then read important source files to understand the architecture, "+
				"and finally call write_llms_txt with the complete output.",
			detailLevel, len(pages),
		)
	} else {
		input = fmt.Sprintf(
			"Generate an llms.txt file for this website. Detail level: %s. "+
				"There are %d crawled pages available. "+
				"Start by listing all pages, then read the important ones, "+
				"and finally call write_llms_txt with the complete output.",
			detailLevel, len(pages),
		)
	}

	// Run the agent with detailed response for token tracking
	resp, err := a.RunDetailed(ctx, input)
	if err != nil {
		return "", TokenUsage{}, fmt.Errorf("agent: run: %w", err)
	}

	// Extract the result from the write_llms_txt tool
	store.mu.Lock()
	result := store.result
	store.mu.Unlock()

	// If the agent didn't call write_llms_txt, fall back to its text output
	if result == "" {
		result = resp.Content
	}

	usage := TokenUsage{}
	if resp.Usage != nil && (resp.Usage.InputTokens > 0 || resp.Usage.OutputTokens > 0) {
		usage.InputTokens = resp.Usage.InputTokens
		usage.OutputTokens = resp.Usage.OutputTokens
	} else {
		// The agent SDK may not aggregate token usage across multi-turn tool calls.
		// Estimate based on content size (~4 chars per token) to ensure billing works.
		totalChars := len(input) + len(result)
		for _, p := range pages {
			totalChars += len(p.Markdown) + len(p.Title)
		}
		// Conservative estimate: input tokens ≈ total chars / 4, output ≈ result / 4
		usage.InputTokens = (totalChars - len(result)) / 4
		usage.OutputTokens = len(result) / 4
		if usage.InputTokens < 100 {
			usage.InputTokens = 100
		}
		if usage.OutputTokens < 50 {
			usage.OutputTokens = 50
		}
	}

	return result, usage, nil
}
