// Package query implements single-turn query generation agents for SQL, Redis,
// and Elasticsearch using the ai package's LLM client.
package query

import (
	"context"
	"fmt"
	"strings"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/tmc/langchaingo/llms"
)

// Dialect identifies the target query language.
type Dialect string

const (
	DialectPostgres      Dialect = "postgres"
	DialectSQLite        Dialect = "sqlite"
	DialectRedis         Dialect = "redis"
	DialectElasticsearch Dialect = "elasticsearch"
)

// GenerateRequest holds all inputs for query generation.
type GenerateRequest struct {
	Dialect       Dialect
	UserMessage   string
	SchemaContext string       // pre-formatted schema text (for SQL dialects)
	History       []ai.Message // prior turns, oldest first
}

// GenerateResult holds the output of a query generation.
type GenerateResult struct {
	Output       string // the generated query
	Reasoning    string // optional chain-of-thought
	InputTokens  int
	OutputTokens int
}

// Generate runs a single-turn query generation agent.
func Generate(ctx context.Context, llmCfg *ai.LLMConfig, req GenerateRequest) (*GenerateResult, error) {
	if req.Dialect == "" {
		req.Dialect = DialectPostgres
	}

	model, err := ai.NewLLM(llmCfg)
	if err != nil {
		return nil, fmt.Errorf("query agent: create LLM: %w", err)
	}

	systemPrompt := buildPrompt(req.Dialect, req.SchemaContext)
	messages := ai.BuildMessages(systemPrompt, req.History, req.UserMessage)

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

	reasoning, queryOut := parseResponse(raw)
	if req.Dialect == DialectElasticsearch {
		queryOut = sanitizeEsJSON(queryOut)
	}

	inputTokens, outputTokens := ai.ExtractTokens(choice.GenerationInfo)

	return &GenerateResult{
		Output:       queryOut,
		Reasoning:    reasoning,
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
	}, nil
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

func buildPrompt(dialect Dialect, schemaContext string) string {
	switch dialect {
	case DialectRedis:
		return `You are a Redis command expert.

Your task: generate Redis commands for the user's request.

CRITICAL RULES:
- Output ONLY the raw Redis command(s). Nothing else.
- One command per line if multiple commands are needed
- Use standard Redis command syntax (e.g. SET key value, GET key, SCAN 0 MATCH pattern COUNT 100)
- For key pattern searches, use SCAN with MATCH, never KEYS
- Common commands: GET, SET, DEL, SCAN, HGETALL, HSET, LPUSH, LRANGE, SADD, SMEMBERS, ZADD, ZRANGEBYSCORE, XRANGE, INFO, TTL, EXPIRE, PERSIST, TYPE
- Do NOT include markdown formatting or code fences

Briefly explain your approach in 1-2 sentences, then output the Redis command(s) in a fenced code block: ` + "```redis ... ```" + `. One command per line. No text inside the code block.`

	case DialectElasticsearch:
		return `You are an Elasticsearch query expert.

Your task: generate the JSON request body for the Elasticsearch _search API.

CRITICAL RULES:
- Output ONLY the raw JSON object. Nothing else.
- Do NOT include the HTTP method or URL path (no "GET /index/_search" prefix)
- Do NOT include any comments — JSON does not support comments
- Do NOT include any text before or after the JSON
- The output must be valid, parseable JSON that starts with { and ends with }
- Include "size": 10 unless the user specifies otherwise
- Use appropriate query types: "match" for text search, "term" for exact keyword match, "range" for dates/numbers, "bool" for combining conditions
- For aggregations, set "size": 0 to skip hits

Example of correct output:
{"query":{"match_all":{}},"size":10}

Briefly explain your approach in 1-2 sentences, then output the JSON in a fenced code block: ` + "```json ... ```" + `. CRITICAL: The JSON must be a raw JSON object starting with { — no HTTP method/path prefix, no comments, no text inside the JSON block.`

	default: // postgres or sqlite
		return fmt.Sprintf(`You are a SQL expert for %s databases. Generate a single SQL query based on the user's request.

Database schema:
%s
Rules:
- Output ONLY the raw SQL query, nothing else
- No markdown formatting, no code fences, no explanations
- Use %s syntax (PostgreSQL or SQLite)
- Use exact table and column names from the schema
- Include LIMIT 100 for SELECT queries unless the user specifies otherwise
- Make reasonable assumptions for ambiguous requests

After your reasoning, output the SQL on a new line starting with `+"`"+`sql and ending with `+"`"+`. Your reasoning should be brief (1-2 sentences max).`, string(dialect), schemaContext, string(dialect))
	}
}

// ─── Response parsing ────────────────────────────────────────────────────────

func parseResponse(content string) (reasoning, queryOut string) {
	openFences := []string{"```sql", "```json", "```redis", "```"}
	const closeFence = "```"

	start := -1
	openLen := 0
	for _, fence := range openFences {
		idx := strings.Index(content, fence)
		if idx == -1 {
			continue
		}
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

func sanitizeEsJSON(s string) string {
	s = strings.TrimSpace(s)

	if idx := strings.Index(s, "\n"); idx != -1 && idx < 80 {
		line := strings.TrimSpace(s[:idx])
		upper := strings.ToUpper(line)
		if strings.HasPrefix(upper, "GET ") || strings.HasPrefix(upper, "POST ") ||
			strings.HasPrefix(upper, "PUT ") || strings.HasPrefix(upper, "DELETE ") {
			s = strings.TrimSpace(s[idx+1:])
		}
	}

	braceIdx := strings.Index(s, "{")
	if braceIdx == -1 {
		return s
	}
	s = s[braceIdx:]

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
