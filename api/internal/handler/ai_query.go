package handler

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/n1rna/1two/api/internal/billing"
	"github.com/n1rna/1two/api/internal/config"
	"github.com/n1rna/1two/api/internal/middleware"
)

// --- Request / response types ---

type aiQueryColumn struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	IsPrimary bool   `json:"isPrimary"`
}

type aiQueryForeignKey struct {
	Column    string `json:"column"`
	RefTable  string `json:"refTable"`
	RefColumn string `json:"refColumn"`
}

type aiQueryTable struct {
	Schema      string            `json:"schema"`
	Name        string            `json:"name"`
	Columns     []aiQueryColumn     `json:"columns"`
	ForeignKeys []aiQueryForeignKey `json:"foreignKeys"`
}

type aiQueryRequest struct {
	// Legacy single-turn fields.
	Prompt string       `json:"prompt"`
	Schema []aiQueryTable `json:"schema"`

	// Conversation mode: if non-nil, Messages takes precedence.
	Messages []chatMessage `json:"messages"`

	Dialect string `json:"dialect"`
}

type aiQueryResponse struct {
	SQL        string `json:"sql"`
	Reasoning  string `json:"reasoning,omitempty"`
	TokensUsed int    `json:"tokensUsed"`
}

// --- Suggestion types ---

type aiQuerySuggestion struct {
	Label string `json:"label"`
	SQL   string `json:"sql"`
}

type aiQuerySuggestionsRequest struct {
	Schema  []aiQueryTable `json:"schema"`
	Dialect string       `json:"dialect"`
}

type aiQuerySuggestionsResponse struct {
	Suggestions []aiQuerySuggestion `json:"suggestions"`
}

// --- OpenAI-compatible chat completion wire types ---

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionRequest struct {
	Model     string        `json:"model"`
	Messages  []chatMessage `json:"messages"`
	Temp      float64       `json:"temperature"`
	MaxTokens int           `json:"max_tokens"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
}

// --- Schema formatter ---

// formatSchema converts the schema array into a compact text block for the system prompt.
func formatSchema(tables []aiQueryTable) string {
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

		// Build a lookup of FK target by column name for inline annotation.
		fkByCol := make(map[string]aiQueryForeignKey, len(t.ForeignKeys))
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

// buildSystemPrompt constructs the query-generation system prompt based on dialect.
// For the "elasticsearch" dialect the tables parameter is unused; the caller
// is expected to supply index mappings via the conversation messages instead.
func buildSystemPrompt(dialect string, tables []aiQueryTable) string {
	if dialect == "" {
		dialect = "postgres"
	}

	if dialect == "elasticsearch" {
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
{"query":{"match_all":{}},"size":10}`
	}

	schemaTxt := formatSchema(tables)
	return fmt.Sprintf(`You are a SQL expert for %s databases. Generate a single SQL query based on the user's request.

Database schema:
%s
Rules:
- Output ONLY the raw SQL query, nothing else
- No markdown formatting, no code fences, no explanations
- Use %s syntax (PostgreSQL or SQLite)
- Use exact table and column names from the schema
- Include LIMIT 100 for SELECT queries unless the user specifies otherwise
- Make reasonable assumptions for ambiguous requests`, dialect, schemaTxt, dialect)
}

// conversationSystemSuffix returns the suffix appended to the frontend-provided
// system message in conversation mode, instructing the LLM to emit reasoning
// followed by a fenced code block.
func conversationSystemSuffix(dialect string) string {
	if dialect == "elasticsearch" {
		return "\n\nBriefly explain your approach in 1-2 sentences, then output the JSON in a fenced code block: ```json ... ```. CRITICAL: The JSON must be a raw JSON object starting with { — no HTTP method/path prefix, no comments, no text inside the JSON block."
	}
	return "\n\nAfter your reasoning, output the SQL on a new line starting with ```sql and ending with ```. Your reasoning should be brief (1-2 sentences max)."
}

// stripMarkdownFences removes optional ```sql ... ```, ```json ... ```, or
// plain ``` ... ``` fences from LLM output.
func stripMarkdownFences(s string) string {
	s = strings.TrimSpace(s)
	// Remove opening fence: ```sql, ```json, or ```
	if strings.HasPrefix(s, "```") {
		// Drop the first line (the fence line)
		idx := strings.Index(s, "\n")
		if idx == -1 {
			return ""
		}
		s = s[idx+1:]
	}
	// Remove closing fence
	if strings.HasSuffix(s, "```") {
		idx := strings.LastIndex(s, "```")
		s = s[:idx]
	}
	return strings.TrimSpace(s)
}

// parseAiResponse splits an LLM response that may contain a fenced code block
// (```sql, ```json, or plain ```) into a (reasoning, query) pair.
//
//   - If a fenced block is present: everything before it is the reasoning, the
//     content inside the fence is the query output.
//   - If no fence is present: the entire content is treated as the query output.
func parseAiResponse(content string) (reasoning, queryOut string) {
	// Recognise both ```sql and ```json opening fences.
	openFences := []string{"```sql", "```json", "```"}
	const closeFence = "```"

	start := -1
	openLen := 0
	for _, fence := range openFences {
		idx := strings.Index(content, fence)
		if idx == -1 {
			continue
		}
		// For the plain ``` fence make sure it is not the closing fence of an
		// already-matched opening fence (i.e. only use it when none of the
		// language-tagged fences matched).
		if fence == "```" && start != -1 {
			break
		}
		start = idx
		openLen = len(fence)
		break
	}

	if start == -1 {
		// No fence — treat the whole response as raw content.
		return "", stripMarkdownFences(content)
	}

	reasoning = strings.TrimSpace(content[:start])

	// Advance past the opening fence line.
	afterOpen := content[start+openLen:]
	// Skip the newline immediately following the fence marker.
	if len(afterOpen) > 0 && afterOpen[0] == '\n' {
		afterOpen = afterOpen[1:]
	}

	end := strings.Index(afterOpen, closeFence)
	if end == -1 {
		// Closing fence missing — use everything after the open fence.
		queryOut = strings.TrimSpace(afterOpen)
		return reasoning, queryOut
	}

	queryOut = strings.TrimSpace(afterOpen[:end])
	return reasoning, queryOut
}

// callChatCompletionMessages sends a chat completion request to the configured
// OpenAI-compatible endpoint using the provided messages slice directly.
// It returns the assistant message content and total token count.
func callChatCompletionMessages(cfg *config.Config, messages []chatMessage) (string, int, error) {
	baseURL := cfg.LLMBaseURL
	if baseURL == "" {
		baseURL = "https://api.moonshot.ai/v1"
	}
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"

	model := cfg.LLMModel
	if model == "" {
		model = "kimi-k2-0711-preview"
	}

	payload := chatCompletionRequest{
		Model:     model,
		Messages:  messages,
		Temp:      0.1,
		MaxTokens: 2000,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", 0, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", 0, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.LLMAPIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("llm request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("llm returned %d: %s", resp.StatusCode, string(respBody))
	}

	var completion chatCompletionResponse
	if err := json.Unmarshal(respBody, &completion); err != nil {
		return "", 0, fmt.Errorf("unmarshal response: %w", err)
	}

	if len(completion.Choices) == 0 {
		return "", 0, fmt.Errorf("llm returned no choices")
	}

	content := strings.TrimSpace(completion.Choices[0].Message.Content)
	return content, completion.Usage.TotalTokens, nil
}

// callChatCompletion is a convenience wrapper around callChatCompletionMessages
// that builds a two-message (system + user) conversation from discrete prompts.
func callChatCompletion(cfg *config.Config, systemPrompt, userPrompt string) (string, int, error) {
	messages := []chatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
	return callChatCompletionMessages(cfg, messages)
}

// --- Handlers ---

// GenerateAiQuery handles POST /ai/sql — generates SQL or Elasticsearch queries via LLM.
// Auth required. Pro/Max plan required. Calls the LLM and returns a SQL query.
//
// Accepts two request formats:
//
//  1. Legacy single-turn: {"prompt":"...","schema":[...],"dialect":"postgres"}
//  2. Conversation:       {"messages":[{"role":"...","content":"..."},...], "dialect":"postgres"}
//
// When "messages" is present (non-nil), conversation mode is used and the
// frontend-supplied system message is augmented with reasoning/fence instructions.
// Both modes return {"sql":"...","reasoning":"...","tokensUsed":N}.
func GenerateAiQuery(cfg *config.Config, db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Plan check — free tier has AiTokensPerMonth == 0.
		tier := billing.GetUserPlanTier(r.Context(), db, userID)
		limits := billing.Plans[tier]
		if limits.AiTokensPerMonth == 0 {
			http.Error(w, `{"error":"AI SQL generation requires a Pro or Max plan"}`, http.StatusForbidden)
			return
		}

		var req aiQueryRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		var (
			rawContent string
			tokens     int
			llmErr     error
		)

		log.Printf("ai_query: request — prompt=%q messages_len=%d dialect=%q", req.Prompt, len(req.Messages), req.Dialect)

		if req.Messages != nil && len(req.Messages) > 0 {
			// --- Conversation mode ---
			// The frontend provides the full messages array including a system
			// message that already contains the schema. Append the
			// reasoning+fence instruction to the first system message so the
			// LLM knows how to format its response.
			messages := make([]chatMessage, len(req.Messages))
			copy(messages, req.Messages)

			suffix := conversationSystemSuffix(req.Dialect)
			for i, msg := range messages {
				if msg.Role == "system" {
					messages[i].Content = msg.Content + suffix
					break
				}
			}

			if len(messages) == 0 {
				http.Error(w, `{"error":"messages array must not be empty"}`, http.StatusBadRequest)
				return
			}

			rawContent, tokens, llmErr = callChatCompletionMessages(cfg, messages)
		} else {
			// --- Legacy single-turn mode ---
			if strings.TrimSpace(req.Prompt) == "" {
				http.Error(w, `{"error":"prompt is required"}`, http.StatusBadRequest)
				return
			}

			sysPrompt := buildSystemPrompt(req.Dialect, req.Schema)
			rawContent, tokens, llmErr = callChatCompletion(cfg, sysPrompt, req.Prompt)
		}

		if llmErr != nil {
			log.Printf("ai_query: llm error for user %s: %v", userID, llmErr)
			http.Error(w, `{"error":"failed to generate SQL"}`, http.StatusInternalServerError)
			return
		}

		reasoning, cleanQuery := parseAiResponse(rawContent)

		// For Elasticsearch: ensure the output is clean JSON without HTTP prefix or comments
		if req.Dialect == "elasticsearch" {
			cleanQuery = sanitizeEsJSON(cleanQuery)
		}

		// Track actual token usage from the LLM response.
		tokenCount := int64(tokens)
		if tokenCount <= 0 {
			tokenCount = 1 // minimum 1 so every call is tracked
		}
		if _, err := billing.IncrementUsageBy(r.Context(), db, userID, "ai-token-used", tokenCount); err != nil {
			log.Printf("ai_query: usage increment error for user %s: %v", userID, err)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(aiQueryResponse{
			SQL:        cleanQuery,
			Reasoning:  reasoning,
			TokensUsed: tokens,
		})
	}
}

// GenerateAiQuerySuggestions handles POST /ai/sql/suggestions.
// Auth required. Rule-based — no LLM call. Analyzes the schema and returns
// up to 8 canned query suggestions.
//
// When dialect == "elasticsearch" the schema field is ignored and the
// fields field ([]string) is used to derive ES-specific suggestions.
func GenerateAiQuerySuggestions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		_ = userID

		// Use a flexible decoder so we can handle both SQL and ES requests.
		var raw map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		var dialect string
		if d, ok := raw["dialect"]; ok {
			_ = json.Unmarshal(d, &dialect)
		}

		if dialect == "elasticsearch" {
			var fields []string
			if f, ok := raw["fields"]; ok {
				_ = json.Unmarshal(f, &fields)
			}
			suggestions := buildEsSuggestions(fields)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(aiQuerySuggestionsResponse{Suggestions: suggestions})
			return
		}

		// SQL path — unmarshal into the typed struct.
		var req aiQuerySuggestionsRequest
		if s, ok := raw["schema"]; ok {
			_ = json.Unmarshal(s, &req.Schema)
		}
		req.Dialect = dialect

		suggestions := buildSuggestions(req.Schema, req.Dialect)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(aiQuerySuggestionsResponse{Suggestions: suggestions})
	}
}

// isTimestampColumn returns true if the column type looks like a time/date type.
func isTimestampColumn(colType string) bool {
	t := strings.ToLower(colType)
	return strings.Contains(t, "timestamp") ||
		strings.Contains(t, "datetime") ||
		strings.Contains(t, "date") ||
		strings.Contains(t, "time")
}

// isStatusColumn returns true if the column name suggests a status/category field.
func isStatusColumn(colName string) bool {
	n := strings.ToLower(colName)
	return n == "status" || n == "state" || n == "type" || n == "category" || n == "kind" || n == "role"
}

// quoteIdent wraps an identifier in double-quotes.
func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

// qualifiedTable returns "schema"."table" or just "table" depending on schema presence.
func qualifiedTable(t aiQueryTable) string {
	if t.Schema != "" && t.Schema != "public" {
		return quoteIdent(t.Schema) + "." + quoteIdent(t.Name)
	}
	return quoteIdent(t.Name)
}

// buildSuggestions generates rule-based query suggestions from the schema.
func buildSuggestions(tables []aiQueryTable, dialect string) []aiQuerySuggestion {
	const maxSuggestions = 8

	if dialect == "" {
		dialect = "postgres"
	}

	var suggestions []aiQuerySuggestion

	add := func(label, sqlStr string) bool {
		if len(suggestions) >= maxSuggestions {
			return false
		}
		suggestions = append(suggestions, aiQuerySuggestion{Label: label, SQL: sqlStr})
		return true
	}

	// Build a name→table map for FK join resolution.
	tableByName := make(map[string]aiQueryTable, len(tables))
	for _, t := range tables {
		tableByName[t.Name] = t
	}

	for _, t := range tables {
		qt := qualifiedTable(t)

		// 1. Select all from table.
		if !add(
			fmt.Sprintf("Select all from %s", t.Name),
			fmt.Sprintf("SELECT * FROM %s LIMIT 100;", qt),
		) {
			break
		}

		// 2. Recent entries — for tables with a timestamp column.
		for _, col := range t.Columns {
			if isTimestampColumn(col.Type) {
				if !add(
					fmt.Sprintf("Recent %s entries", t.Name),
					fmt.Sprintf("SELECT * FROM %s ORDER BY %s DESC LIMIT 100;", qt, quoteIdent(col.Name)),
				) {
					return suggestions
				}
				break // one suggestion per table
			}
		}

		// 3. Count by status/type column.
		for _, col := range t.Columns {
			if isStatusColumn(col.Name) {
				if !add(
					fmt.Sprintf("Count %s by %s", t.Name, col.Name),
					fmt.Sprintf("SELECT %s, COUNT(*) AS count FROM %s GROUP BY %s ORDER BY count DESC;", quoteIdent(col.Name), qt, quoteIdent(col.Name)),
				) {
					return suggestions
				}
				break
			}
		}

		// 4. JOIN suggestions for foreign keys.
		for _, fk := range t.ForeignKeys {
			refT, ok := tableByName[fk.RefTable]
			if !ok {
				continue
			}
			qRefT := qualifiedTable(refT)
			if !add(
				fmt.Sprintf("Join %s with %s", t.Name, fk.RefTable),
				fmt.Sprintf(
					"SELECT * FROM %s\nJOIN %s ON %s.%s = %s.%s\nLIMIT 100;",
					qt, qRefT,
					qt, quoteIdent(fk.Column),
					qRefT, quoteIdent(fk.RefColumn),
				),
			) {
				return suggestions
			}
		}
	}

	return suggestions
}

// sanitizeEsJSON cleans up LLM-generated Elasticsearch JSON that may contain
// unwanted prefixes (e.g. "GET /index/_search\n{...}"), inline comments
// (// or /* */), or trailing text after the JSON object.
func sanitizeEsJSON(s string) string {
	s = strings.TrimSpace(s)

	// Strip HTTP method + path prefix: "GET /users/_search\n" or "POST /_search\n"
	if idx := strings.Index(s, "\n"); idx != -1 && idx < 80 {
		line := strings.TrimSpace(s[:idx])
		upper := strings.ToUpper(line)
		if strings.HasPrefix(upper, "GET ") || strings.HasPrefix(upper, "POST ") ||
			strings.HasPrefix(upper, "PUT ") || strings.HasPrefix(upper, "DELETE ") {
			s = strings.TrimSpace(s[idx+1:])
		}
	}

	// Find the first '{' — everything before it is discarded
	braceIdx := strings.Index(s, "{")
	if braceIdx == -1 {
		return s // no JSON object found, return as-is
	}
	s = s[braceIdx:]

	// Remove single-line comments (// ...) that some LLMs add despite instructions
	lines := strings.Split(s, "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") {
			continue // skip full-line comments
		}
		// Remove inline comments: find // that isn't inside a string
		// Simple heuristic: if // appears after a " or }, it's likely a comment
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

// ─── Elasticsearch suggestion helpers ────────────────────────────────────────

// esFieldKind classifies a bare field name into a simple kind used to pick the
// right suggestion template.
type esFieldKind int

const (
	esKindDate    esFieldKind = iota
	esKindNumeric esFieldKind = iota
	esKindText    esFieldKind = iota
)

func classifyEsField(name string) esFieldKind {
	n := strings.ToLower(name)
	// Date / time heuristics
	if strings.Contains(n, "date") || strings.Contains(n, "time") ||
		strings.Contains(n, "created") || strings.Contains(n, "updated") ||
		strings.Contains(n, "timestamp") || strings.Contains(n, "at") {
		return esKindDate
	}
	// Numeric heuristics
	if strings.Contains(n, "count") || strings.Contains(n, "total") ||
		strings.Contains(n, "amount") || strings.Contains(n, "price") ||
		strings.Contains(n, "size") || strings.Contains(n, "num") ||
		strings.Contains(n, "score") || strings.Contains(n, "age") {
		return esKindNumeric
	}
	return esKindText
}

// buildEsSuggestions generates rule-based Elasticsearch query suggestions from
// a list of field names.  It always starts with "Match all documents" and then
// adds up to 7 field-specific chips.
func buildEsSuggestions(fields []string) []aiQuerySuggestion {
	const max = 8
	var suggestions []aiQuerySuggestion

	add := func(label, body string) bool {
		if len(suggestions) >= max {
			return false
		}
		suggestions = append(suggestions, aiQuerySuggestion{Label: label, SQL: body})
		return true
	}

	// 1. Always include match_all.
	add("Match all documents", `{"query":{"match_all":{}},"size":10}`)

	seenDate := false
	seenNumeric := false

	for _, f := range fields {
		if len(suggestions) >= max {
			break
		}
		kind := classifyEsField(f)
		switch kind {
		case esKindDate:
			if !seenDate {
				seenDate = true
				add(
					fmt.Sprintf("Recent by %s", f),
					fmt.Sprintf(`{"query":{"range":{"%s":{"gte":"now-7d/d"}}},"sort":[{"%s":{"order":"desc"}}],"size":10}`, f, f),
				)
			}
		case esKindNumeric:
			if !seenNumeric {
				seenNumeric = true
				add(
					fmt.Sprintf("Stats on %s", f),
					fmt.Sprintf(`{"aggs":{"stats":{"stats":{"field":"%s"}}},"size":0}`, f),
				)
			}
		case esKindText:
			add(
				fmt.Sprintf("Search %s", f),
				fmt.Sprintf(`{"query":{"match":{"%s":{"query":"value"}}},"size":10}`, f),
			)
			// Add a terms aggregation for the first text/keyword field too.
			if len(suggestions) < max {
				add(
					fmt.Sprintf("Top %s values", f),
					fmt.Sprintf(`{"aggs":{"top_%s":{"terms":{"field":"%s.keyword","size":10}}},"size":0}`, f, f),
				)
			}
		}
	}

	return suggestions
}
