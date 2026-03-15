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
	Prompt  string       `json:"prompt"`
	Schema  []aiSqlTable `json:"schema"`
	Dialect string       `json:"dialect"`
}

type aiSqlResponse struct {
	SQL        string `json:"sql"`
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

// callChatCompletion sends a single chat completion request to the configured
// OpenAI-compatible endpoint and returns the assistant message content plus
// total token count.
func callChatCompletion(cfg *config.Config, systemPrompt, userPrompt string) (string, int, error) {
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
		Model: model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
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

// --- Handlers ---

// GenerateAiSql handles POST /ai/sql.
// Auth required. Pro/Max plan required. Calls the LLM and returns a SQL query.
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

		if strings.TrimSpace(req.Prompt) == "" {
			http.Error(w, `{"error":"prompt is required"}`, http.StatusBadRequest)
			return
		}

		sysPrompt := buildSystemPrompt(req.Dialect, req.Schema)
		rawSQL, tokens, err := callChatCompletion(cfg, sysPrompt, req.Prompt)
		if err != nil {
			log.Printf("ai_sql: llm error for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to generate SQL"}`, http.StatusInternalServerError)
			return
		}

		cleanSQL := stripMarkdownFences(rawSQL)

		// Track usage — one increment per call (simple approach).
		if _, err := billing.IncrementUsage(r.Context(), db, userID, "ai-token-used"); err != nil {
			// Non-fatal — log and continue so the user still gets their result.
			log.Printf("ai_sql: usage increment error for user %s: %v", userID, err)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(aiSqlResponse{
			SQL:        cleanSQL,
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
