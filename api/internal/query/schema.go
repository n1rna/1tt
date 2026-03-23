package query

import (
	"fmt"
	"strings"
)

// SchemaTable is the schema information for a single database table.
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
