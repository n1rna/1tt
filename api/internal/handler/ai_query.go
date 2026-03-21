package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/n1rna/1tt/api/internal/billing"
	"github.com/n1rna/1tt/api/internal/config"
	"github.com/n1rna/1tt/api/internal/middleware"
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
	Schema      string             `json:"schema"`
	Name        string             `json:"name"`
	Columns     []aiQueryColumn    `json:"columns"`
	ForeignKeys []aiQueryForeignKey `json:"foreignKeys"`
}

type aiQueryRequest struct {
	// Legacy single-turn fields.
	Prompt string         `json:"prompt"`
	Schema []aiQueryTable `json:"schema"`

	// Conversation mode: if non-nil, Messages takes precedence.
	// System messages from the frontend are stripped and replaced by the
	// backend-generated prompt.
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
	Dialect string         `json:"dialect"`
}

type aiQuerySuggestionsResponse struct {
	Suggestions []aiQuerySuggestion `json:"suggestions"`
}

// chatMessage is a single turn in a conversation from the frontend.
type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// --- Schema converter ---

// toSchemaTable converts a handler aiQueryTable to ai.SchemaTable.
func toSchemaTable(t aiQueryTable) ai.SchemaTable {
	cols := make([]ai.SchemaColumn, len(t.Columns))
	for i, c := range t.Columns {
		cols[i] = ai.SchemaColumn{Name: c.Name, Type: c.Type, IsPrimary: c.IsPrimary}
	}
	fks := make([]ai.SchemaForeignKey, len(t.ForeignKeys))
	for i, fk := range t.ForeignKeys {
		fks[i] = ai.SchemaForeignKey{Column: fk.Column, RefTable: fk.RefTable, RefColumn: fk.RefColumn}
	}
	return ai.SchemaTable{Schema: t.Schema, Name: t.Name, Columns: cols, ForeignKeys: fks}
}

// agentTypeForDialect maps a dialect string to the corresponding AgentType.
func agentTypeForDialect(dialect string) ai.AgentType {
	switch dialect {
	case "sqlite":
		return ai.AgentQuerySQLite
	case "redis":
		return ai.AgentQueryRedis
	case "elasticsearch":
		return ai.AgentQueryElasticsearch
	default:
		return ai.AgentQueryPostgres
	}
}

// --- Handlers ---

// GenerateAiQuery handles POST /ai/query — generates SQL, Redis, or Elasticsearch
// queries via LLM.
// Auth required. Pro/Max plan required.
//
// Accepts two request formats:
//
//  1. Legacy single-turn: {"prompt":"...","schema":[...],"dialect":"postgres"}
//  2. Conversation:       {"messages":[{"role":"user","content":"..."},...], "dialect":"postgres", "schema":[...]}
//
// In conversation mode, any system messages from the frontend are stripped and
// the backend builds its own system prompt from the schema. This ensures
// consistency and prevents prompt injection via the messages array.
//
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

		log.Printf("ai_query: request — prompt=%q messages_len=%d dialect=%q", req.Prompt, len(req.Messages), req.Dialect)

		if req.Dialect == "" {
			req.Dialect = "postgres"
		}

		// Build schema context — used for SQL dialects; empty string for redis/ES
		// (the prompt template ignores it for those dialects).
		var schemaTables []ai.SchemaTable
		for _, t := range req.Schema {
			schemaTables = append(schemaTables, toSchemaTable(t))
		}
		schemaContext := ai.FormatSchemaContext(schemaTables)

		// Build conversation history from the messages array, filtering out any
		// system messages the frontend may have included.
		var history []ai.Message
		var userMessage string

		if len(req.Messages) > 0 {
			// Conversation mode: collect non-system turns into history;
			// the last user message becomes the current turn.
			var nonSystem []chatMessage
			for _, m := range req.Messages {
				if m.Role != "system" {
					nonSystem = append(nonSystem, m)
				}
			}

			if len(nonSystem) == 0 {
				http.Error(w, `{"error":"messages must contain at least one non-system message"}`, http.StatusBadRequest)
				return
			}

			// The last message must be from the user.
			last := nonSystem[len(nonSystem)-1]
			if last.Role != "user" {
				http.Error(w, `{"error":"last message must be from the user"}`, http.StatusBadRequest)
				return
			}
			userMessage = last.Content

			// Everything before the last message is history.
			for _, m := range nonSystem[:len(nonSystem)-1] {
				role := m.Role
				if role == "assistant" {
					role = "assistant"
				}
				history = append(history, ai.Message{Role: role, Content: m.Content})
			}
		} else {
			// Legacy single-turn mode.
			if strings.TrimSpace(req.Prompt) == "" {
				http.Error(w, `{"error":"prompt is required"}`, http.StatusBadRequest)
				return
			}
			userMessage = req.Prompt
		}

		llmCfg := &ai.LLMConfig{
			Provider: cfg.LLMProvider,
			APIKey:   cfg.LLMAPIKey,
			BaseURL:  cfg.LLMBaseURL,
			Model:    cfg.LLMModel,
		}
		if llmCfg.BaseURL == "" {
			llmCfg.BaseURL = "https://api.moonshot.ai/v1"
		}
		if llmCfg.Model == "" {
			llmCfg.Model = "kimi-k2-0711-preview"
		}

		agentResult, agentErr := ai.Run(r.Context(), llmCfg, ai.AgentConfig{
			Type:        agentTypeForDialect(req.Dialect),
			UserMessage: userMessage,
			Context:     schemaContext,
			History:     history,
			ExtraData: map[string]any{
				"dialect": req.Dialect,
			},
		})

		if agentErr != nil {
			log.Printf("ai_query: agent error for user %s: %v", userID, agentErr)
			http.Error(w, `{"error":"failed to generate query"}`, http.StatusInternalServerError)
			return
		}

		tokens := agentResult.InputTokens + agentResult.OutputTokens

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
			SQL:        agentResult.Output,
			Reasoning:  agentResult.Reasoning,
			TokensUsed: tokens,
		})
	}
}

// GenerateAiQuerySuggestions handles POST /ai/query/suggestions.
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
	if strings.Contains(n, "date") || strings.Contains(n, "time") ||
		strings.Contains(n, "created") || strings.Contains(n, "updated") ||
		strings.Contains(n, "timestamp") || strings.Contains(n, "at") {
		return esKindDate
	}
	if strings.Contains(n, "count") || strings.Contains(n, "total") ||
		strings.Contains(n, "amount") || strings.Contains(n, "price") ||
		strings.Contains(n, "size") || strings.Contains(n, "num") ||
		strings.Contains(n, "score") || strings.Contains(n, "age") {
		return esKindNumeric
	}
	return esKindText
}

// buildEsSuggestions generates rule-based Elasticsearch query suggestions from
// a list of field names. It always starts with "Match all documents" and then
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
