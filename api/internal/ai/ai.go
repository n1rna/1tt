// Package ai provides shared infrastructure for AI agents: LLM client creation,
// a generic tool-calling agent loop, token tracking, and common types.
//
// Domain-specific agents live in their own packages:
//   - llmstxt: llms.txt file generation agent
//   - query: SQL/Redis/Elasticsearch query generation agent
//   - life: AI-powered life planning agent
package ai

// Message represents a single turn in a conversation history.
type Message struct {
	Role    string // "user" or "assistant"
	Content string
}
