package ai

import (
	"fmt"
	"strings"
)

// BuildLlmsTxtPrompt returns the system prompt for the llms.txt agent.
func BuildLlmsTxtPrompt(sourceType, detailLevel string) string {
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

// BuildLlmsTxtUserMessage returns the initial user message for the llms.txt agent.
func BuildLlmsTxtUserMessage(detailLevel, sourceType string, pageCount int) string {
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

// BuildQueryPrompt constructs the complete system prompt for query generation.
// It handles all four dialects: postgres, sqlite, redis, elasticsearch.
// schemaContext is the pre-formatted schema text (from FormatSchemaContext);
// it is unused for redis and elasticsearch dialects.
func BuildQueryPrompt(dialect string, schemaContext string) string {
	if dialect == "" {
		dialect = "postgres"
	}

	switch dialect {
	case "redis":
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

	case "elasticsearch":
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

After your reasoning, output the SQL on a new line starting with `+"`"+`sql and ending with `+"`"+`. Your reasoning should be brief (1-2 sentences max).`, dialect, schemaContext, dialect)
	}
}

// SchemaTable is the schema information for a single database table.
// It mirrors the aiQueryTable type in the handler package so it can be
// constructed by the handler and passed to FormatSchemaContext.
type SchemaTable struct {
	Schema      string
	Name        string
	Columns     []SchemaColumn
	ForeignKeys []SchemaForeignKey
}

// SchemaColumn describes a single column in a table.
type SchemaColumn struct {
	Name      string
	Type      string
	IsPrimary bool
}

// SchemaForeignKey describes a foreign-key relationship on a column.
type SchemaForeignKey struct {
	Column    string
	RefTable  string
	RefColumn string
}

// FormatSchemaContext converts a slice of SchemaTable into the compact text
// block embedded in the query system prompt.
func FormatSchemaContext(tables []SchemaTable) string {
	var sb strings.Builder
	for i, t := range tables {
		if i > 0 {
			sb.WriteString("\n")
		}
		if t.Schema != "" && t.Schema != "public" {
			fmt.Fprintf(&sb, "Table \"%s\".\"%s\":\n", t.Schema, t.Name)
		} else {
			fmt.Fprintf(&sb, "Table \"%s\":\n", t.Name)
		}

		fkByCol := make(map[string]SchemaForeignKey, len(t.ForeignKeys))
		for _, fk := range t.ForeignKeys {
			fkByCol[fk.Column] = fk
		}

		for _, col := range t.Columns {
			typePart := strings.ToUpper(col.Type)
			var extras []string
			if col.IsPrimary {
				extras = append(extras, "PRIMARY KEY")
			}
			if fk, ok := fkByCol[col.Name]; ok {
				extras = append(extras, fmt.Sprintf("→ %s(%s)", fk.RefTable, fk.RefColumn))
			}
			if len(extras) > 0 {
				fmt.Fprintf(&sb, "  %s %s %s\n", col.Name, typePart, strings.Join(extras, " "))
			} else {
				fmt.Fprintf(&sb, "  %s %s\n", col.Name, typePart)
			}
		}
	}
	return sb.String()
}
