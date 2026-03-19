package executor

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresExecutor wraps a pgxpool.Pool and executes SQL against it.
type PostgresExecutor struct {
	pool *pgxpool.Pool
}

// NewPostgres creates and validates a new PostgresExecutor.
// It opens a connection pool and pings the database to confirm connectivity.
func NewPostgres(connStr string) (*PostgresExecutor, error) {
	cfg, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("invalid postgres connection string: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, fmt.Errorf("could not reach postgres: %w", err)
	}

	return &PostgresExecutor{pool: pool}, nil
}

// isReadQuery returns true when the first keyword suggests a result-set query
// (SELECT, SHOW, EXPLAIN, WITH, TABLE, VALUES).
func isReadQuery(sql string) bool {
	trimmed := strings.TrimSpace(sql)
	if len(trimmed) == 0 {
		return false
	}
	firstWord := strings.ToUpper(strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == '('
	})[0])

	switch firstWord {
	case "SELECT", "SHOW", "EXPLAIN", "WITH", "TABLE", "VALUES":
		return true
	}
	return false
}

// Execute runs a SQL statement. For SELECT/SHOW/EXPLAIN/WITH it returns
// column names and rows; for DML it returns rows_affected.
func (e *PostgresExecutor) Execute(ctx context.Context, sql string) (*Result, error) {
	if isReadQuery(sql) {
		return e.query(ctx, sql)
	}
	return e.exec(ctx, sql)
}

func (e *PostgresExecutor) query(ctx context.Context, sql string) (*Result, error) {
	rows, err := e.pool.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, f := range fields {
		columns[i] = string(f.Name)
	}

	var resultRows [][]any
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("scanning row: %w", err)
		}
		resultRows = append(resultRows, values)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &Result{
		Columns: columns,
		Rows:    resultRows,
	}, nil
}

func (e *PostgresExecutor) exec(ctx context.Context, sql string) (*Result, error) {
	tag, err := e.pool.Exec(ctx, sql)
	if err != nil {
		return nil, err
	}
	return &Result{
		RowsAffected: tag.RowsAffected(),
	}, nil
}

// GetVersion returns the PostgreSQL server version string.
func (e *PostgresExecutor) GetVersion(ctx context.Context) (string, error) {
	row := e.pool.QueryRow(ctx, "SELECT version()")
	var v string
	if err := row.Scan(&v); err != nil {
		return "", err
	}
	return v, nil
}

// GetSchema queries information_schema for all user tables and their columns.
func (e *PostgresExecutor) GetSchema(ctx context.Context) ([]SchemaTable, error) {
	const colQuery = `
		SELECT
			c.table_schema,
			c.table_name,
			c.column_name,
			c.data_type,
			c.is_nullable,
			COALESCE(c.column_default, '')
		FROM information_schema.columns c
		JOIN information_schema.tables t
			ON t.table_schema = c.table_schema
			AND t.table_name  = c.table_name
		WHERE t.table_type   = 'BASE TABLE'
		  AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
		ORDER BY c.table_schema, c.table_name, c.ordinal_position
	`

	rows, err := e.pool.Query(ctx, colQuery)
	if err != nil {
		return nil, fmt.Errorf("schema query failed: %w", err)
	}
	defer rows.Close()

	tableMap := make(map[string]*SchemaTable)
	var order []string

	for rows.Next() {
		var (
			tableSchema string
			tableName   string
			columnName  string
			dataType    string
			isNullable  string
			colDefault  string
		)
		if err := rows.Scan(&tableSchema, &tableName, &columnName, &dataType, &isNullable, &colDefault); err != nil {
			return nil, err
		}

		key := tableSchema + "." + tableName
		if _, ok := tableMap[key]; !ok {
			tableMap[key] = &SchemaTable{
				Name:   tableName,
				Schema: tableSchema,
			}
			order = append(order, key)
		}

		tableMap[key].Columns = append(tableMap[key].Columns, SchemaColumn{
			Name:       columnName,
			DataType:   dataType,
			IsNullable: strings.EqualFold(isNullable, "YES"),
			Default:    colDefault,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	tables := make([]SchemaTable, 0, len(order))
	for _, key := range order {
		tables = append(tables, *tableMap[key])
	}
	return tables, nil
}

// Close shuts down the connection pool.
func (e *PostgresExecutor) Close() {
	e.pool.Close()
}
