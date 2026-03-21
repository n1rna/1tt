package tunnel

import "encoding/json"

// Message is the envelope for all WebSocket frames exchanged between the
// server and the CLI agent.
//
// Type values:
//
//	"query"   — server -> CLI: execute a SQL statement or Redis command
//	"schema"  — server -> CLI: introspect the connected database
//	"ping"    — server -> CLI: keepalive probe
//	"result"  — CLI -> server: successful query result
//	"error"   — CLI -> server: query or connection error
//	"ready"   — CLI -> server: CLI has connected and identified its dialect
//	"pong"    — CLI -> server: response to ping
type Message struct {
	ID      string          `json:"id,omitempty"`
	Type    string          `json:"type"`
	Dialect string          `json:"dialect,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// QueryPayload carries the SQL statement (postgres), Redis command (redis),
// or Elasticsearch HTTP request fields (elasticsearch).
type QueryPayload struct {
	SQL     string   `json:"sql,omitempty"`
	Command []string `json:"command,omitempty"`
	// Elasticsearch HTTP request fields
	Method string `json:"method,omitempty"`
	Path   string `json:"path,omitempty"`
	Body   string `json:"body,omitempty"`
}

// ResultPayload carries the response to a successful query.
//
// For SQL results, Columns and Rows are populated along with RowsAffected.
// For Redis results, Result holds the raw command reply.
type ResultPayload struct {
	Columns      []string `json:"columns,omitempty"`
	Rows         [][]any  `json:"rows,omitempty"`
	RowsAffected int64    `json:"rows_affected,omitempty"`
	Result       any      `json:"result,omitempty"`
}

// ErrorPayload describes a failure reported by the CLI.
type ErrorPayload struct {
	Message string `json:"message"`
}

// ReadyPayload is sent by the CLI immediately after it connects and finishes
// its own handshake with the target database.
type ReadyPayload struct {
	Dialect string `json:"dialect"`
	Version string `json:"version,omitempty"`
}

// SchemaPayload contains the introspected schema sent back by the CLI in
// response to a "schema" message from the server.
type SchemaPayload struct {
	Tables []SchemaTable `json:"tables,omitempty"`
}

// SchemaTable describes one table (or collection) in the schema.
type SchemaTable struct {
	Schema  string         `json:"schema"`
	Name    string         `json:"name"`
	Columns []SchemaColumn `json:"columns"`
}

// SchemaColumn describes one column within a SchemaTable.
type SchemaColumn struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	IsPrimary bool   `json:"is_primary,omitempty"`
}
