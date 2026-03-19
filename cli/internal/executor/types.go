// Package executor provides database query execution for PostgreSQL and Redis.
package executor

// Result holds the output of a database query.
type Result struct {
	Columns      []string `json:"columns,omitempty"`
	Rows         [][]any  `json:"rows,omitempty"`
	RowsAffected int64    `json:"rows_affected,omitempty"`
}

// SchemaTable represents a table (or Redis key pattern) in the schema.
type SchemaTable struct {
	Name    string         `json:"name"`
	Schema  string         `json:"schema,omitempty"`
	Columns []SchemaColumn `json:"columns,omitempty"`
}

// SchemaColumn represents a column in a relational table.
type SchemaColumn struct {
	Name       string `json:"name"`
	DataType   string `json:"data_type"`
	IsNullable bool   `json:"is_nullable"`
	Default    string `json:"default,omitempty"`
}
