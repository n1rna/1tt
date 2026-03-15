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

type aiSqlColumn struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	IsPrimary bool   `json:"isPrimary"`
}

type aiSqlForeignKey struct {
	Column    string `json:"column"`
	RefTable  string `json:"refTable"`
	RefColumn string `json:"refColumn"`
}

type aiSqlTable struct {
	Schema      string            `json:"schema"`
	Name        string            `json:"name"`
	Columns     []aiSqlColumn     `json:"columns"`
	ForeignKeys []aiSqlForeignKey `json:"foreignKeys"`
}

type aiSqlRequest struct {
	// Legacy single-turn fields.
	Prompt string       `json:"prompt"`
	Schema []aiSqlTable `json:"schema"`

	// Conversation mode: if non-nil, Messages takes precedence.
	Messages []chatMessage `json:"messages"`

	Dialect string `json:"dialect"`
}

type aiSqlResponse struct {
	SQL        string `json:"sql"`
	Reasoning  string `json:"reasoning,omitempty"`
	TokensUsed int    `json:"tokensUsed"`
}

// --- Suggestion types ---

type aiSqlSuggestion struct {
	Label string `json:"label"`
	SQL   string `json:"sql"`
}

type aiSqlSuggestionsRequest struct {
	Schema  []aiSqlTable `json:"schema"`
	Dialect string       `json:"dialect"`
}

type aiSqlSuggestionsResponse struct {
	Suggestions []aiSqlSuggestion `json:"suggestions"`
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
func formatSchema(tables []aiSqlTable) string {
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
		fkByCol := make(map[string]aiSqlForeignKey, len(t.ForeignKeys))
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

// buildSystemPrompt constructs the SQL-generation system prompt.
func buildSystemPrompt(dialect string, tables []aiSqlTable) string {
	if dialect == "" {
		dialect = "postgres"
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

// conversationSystemSuffix is appended to the frontend-provided system message
// when using conversation mode, instructing the LLM to emit both reasoning and
// a fenced SQL block so that parseAiResponse can split them cleanly.
const conversationSystemSuffix = "\n\nAfter your reasoning, output the SQL on a new line starting with ```sql and ending with ```. Your reasoning should be brief (1-2 sentences max)."

// stripMarkdownFences removes optional ```sql ... ``` or ``` ... ``` fences from LLM output.
func stripMarkdownFences(s string) string {
	s = strings.TrimSpace(s)
	// Remove opening fence: ```sql or ```
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

// parseAiResponse splits an LLM response that may contain a ```sql...``` fenced
// block into a (reasoning, sql) pair.
//
//   - If a ```sql fence is present: everything before it is the reasoning, the
//     content inside the fence is the SQL.
//   - If no fence is present: the entire content is treated as SQL (legacy
//     behaviour), and reasoning is empty.
func parseAiResponse(content string) (reasoning, sqlOut string) {
	const openFence = "```sql"
	const closeFence = "```"

	start := strings.Index(content, openFence)
	if start == -1 {
		// No fence — treat the whole response as SQL.
		return "", stripMarkdownFences(content)
	}

	reasoning = strings.TrimSpace(content[:start])

	// Advance past the opening fence line.
	afterOpen := content[start+len(openFence):]
	// Skip the newline immediately following the fence marker.
	if len(afterOpen) > 0 && afterOpen[0] == '\n' {
		afterOpen = afterOpen[1:]
	}

	end := strings.Index(afterOpen, closeFence)
	if end == -1 {
		// Closing fence missing — use everything after the open fence as SQL.
		sqlOut = strings.TrimSpace(afterOpen)
		return reasoning, sqlOut
	}

	sqlOut = strings.TrimSpace(afterOpen[:end])
	return reasoning, sqlOut
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

// GenerateAiSql handles POST /ai/sql.
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
func GenerateAiSql(cfg *config.Config, db *sql.DB) http.HandlerFunc {
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

		var req aiSqlRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		var (
			rawContent string
			tokens     int
			llmErr     error
		)

		if req.Messages != nil {
			// --- Conversation mode ---
			// The frontend provides the full messages array including a system
			// message that already contains the schema. Append the
			// reasoning+fence instruction to the first system message so the
			// LLM knows how to format its response.
			messages := make([]chatMessage, len(req.Messages))
			copy(messages, req.Messages)

			for i, msg := range messages {
				if msg.Role == "system" {
					messages[i].Content = msg.Content + conversationSystemSuffix
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
			log.Printf("ai_sql: llm error for user %s: %v", userID, llmErr)
			http.Error(w, `{"error":"failed to generate SQL"}`, http.StatusInternalServerError)
			return
		}

		reasoning, cleanSQL := parseAiResponse(rawContent)

		// Track usage — one increment per call (simple approach).
		if _, err := billing.IncrementUsage(r.Context(), db, userID, "ai-token-used"); err != nil {
			// Non-fatal — log and continue so the user still gets their result.
			log.Printf("ai_sql: usage increment error for user %s: %v", userID, err)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(aiSqlResponse{
			SQL:        cleanSQL,
			Reasoning:  reasoning,
			TokensUsed: tokens,
		})
	}
}

// GenerateAiSqlSuggestions handles POST /ai/sql/suggestions.
// Auth required. Rule-based — no LLM call. Analyzes the schema and returns
// up to 8 canned query suggestions.
func GenerateAiSqlSuggestions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		// Suppress "declared but not used" — userID is validated above.
		_ = userID

		var req aiSqlSuggestionsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		suggestions := buildSuggestions(req.Schema, req.Dialect)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(aiSqlSuggestionsResponse{Suggestions: suggestions})
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
func qualifiedTable(t aiSqlTable) string {
	if t.Schema != "" && t.Schema != "public" {
		return quoteIdent(t.Schema) + "." + quoteIdent(t.Name)
	}
	return quoteIdent(t.Name)
}

// buildSuggestions generates rule-based query suggestions from the schema.
func buildSuggestions(tables []aiSqlTable, dialect string) []aiSqlSuggestion {
	const maxSuggestions = 8

	if dialect == "" {
		dialect = "postgres"
	}

	var suggestions []aiSqlSuggestion

	add := func(label, sqlStr string) bool {
		if len(suggestions) >= maxSuggestions {
			return false
		}
		suggestions = append(suggestions, aiSqlSuggestion{Label: label, SQL: sqlStr})
		return true
	}

	// Build a name→table map for FK join resolution.
	tableByName := make(map[string]aiSqlTable, len(tables))
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
