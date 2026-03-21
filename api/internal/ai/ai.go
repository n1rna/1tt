// Package ai provides a unified interface for all AI agent executions.
// It abstracts away provider differences (OpenAI-compatible vs Anthropic)
// and agent types (simple chat completion vs multi-turn tool-calling agents).
package ai

import (
	"context"
	"fmt"
)

// AgentType identifies which agent implementation to use for a given Run call.
type AgentType string

const (
	AgentLlmsTxt            AgentType = "llms_txt"
	AgentQueryPostgres      AgentType = "query_postgres"
	AgentQuerySQLite        AgentType = "query_sqlite"
	AgentQueryRedis         AgentType = "query_redis"
	AgentQueryElasticsearch AgentType = "query_elasticsearch"
)

// RunResult holds the output of a completed agent execution.
type RunResult struct {
	// Output is the primary result: SQL query, Redis command, ES JSON, or llms.txt content.
	Output string
	// Reasoning is the model's optional chain-of-thought before the output.
	Reasoning string
	// InputTokens is the total number of prompt tokens consumed across all LLM calls.
	InputTokens int
	// OutputTokens is the total number of completion tokens produced across all LLM calls.
	OutputTokens int
}

// Message represents a single turn in a conversation history.
type Message struct {
	Role    string // "user" or "assistant"
	Content string
}

// AgentConfig contains all inputs required to execute an agent.
type AgentConfig struct {
	// Type selects which agent to run.
	Type AgentType

	// UserMessage is the most recent user message (current turn).
	UserMessage string

	// Context is pre-formatted context for the agent — e.g. schema text for
	// query agents or an index mapping description for Elasticsearch.
	Context string

	// History contains prior user/assistant turns, oldest first. System
	// messages must be stripped by the caller before populating this field.
	History []Message

	// ExtraData holds agent-specific configuration.
	//
	// For AgentLlmsTxt:
	//   "pages"       []crawl.CrawlPage — crawled/cloned pages
	//   "detailLevel" string            — "overview", "standard", or "detailed"
	//   "sourceType"  string            — "github" or "website"
	//
	// For query agents:
	//   "dialect"     string            — matches the AgentType suffix
	ExtraData map[string]any
}

// Run is the single entry point for all AI agent executions.
// It constructs an LLM client from llmCfg, then dispatches to the appropriate
// agent implementation based on agentCfg.Type.
func Run(ctx context.Context, llmCfg *LLMConfig, agentCfg AgentConfig) (*RunResult, error) {
	model, err := NewLLM(llmCfg)
	if err != nil {
		return nil, fmt.Errorf("ai.Run: create LLM client: %w", err)
	}

	switch agentCfg.Type {
	case AgentLlmsTxt:
		return runLlmsTxtAgent(ctx, model, agentCfg)

	case AgentQueryPostgres, AgentQuerySQLite, AgentQueryRedis, AgentQueryElasticsearch:
		// Inject the dialect into ExtraData so the query agent can read it.
		if agentCfg.ExtraData == nil {
			agentCfg.ExtraData = make(map[string]any)
		}
		if _, ok := agentCfg.ExtraData["dialect"]; !ok {
			agentCfg.ExtraData["dialect"] = dialectFromType(agentCfg.Type)
		}
		return runQueryAgent(ctx, model, agentCfg)

	default:
		return nil, fmt.Errorf("ai.Run: unknown agent type %q", agentCfg.Type)
	}
}

// dialectFromType maps an AgentType to its dialect string.
func dialectFromType(t AgentType) string {
	switch t {
	case AgentQueryPostgres:
		return "postgres"
	case AgentQuerySQLite:
		return "sqlite"
	case AgentQueryRedis:
		return "redis"
	case AgentQueryElasticsearch:
		return "elasticsearch"
	default:
		return "postgres"
	}
}
