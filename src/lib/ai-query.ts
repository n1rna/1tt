import type { TableSchema, SqlDialect, AiMessage } from "@/components/account/database-studio/types";

export interface AiQueryResponse {
  sql: string;
  tokensUsed: number;
  error?: string;
}

export interface QuerySuggestion {
  label: string;
  sql: string;
}

export interface AiChatResponse {
  sql: string;
  reasoning?: string;
  tokensUsed: number;
  error?: string;
}

export async function generateAiChat(
  messages: AiMessage[],
  dialect: SqlDialect
): Promise<AiChatResponse> {
  const res = await fetch("/api/proxy/ai/sql", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, dialect }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { sql: "", tokensUsed: 0, error: (err as { error?: string }).error ?? `HTTP ${res.status}` };
  }
  return res.json() as Promise<AiChatResponse>;
}

export function buildSystemMessage(schema: TableSchema[], dialect: SqlDialect): string {
  if (dialect === "elasticsearch") {
    const indexName = schema[0]?.name ?? "*";
    const fields = schema.flatMap(t =>
      t.columns.map(c => `  ${c.name}${c.type ? ` — ${c.type}` : ""}`)
    );
    const fieldList = fields.length > 0 ? fields.join("\n") : "  (no fields known)";

    return `You are an Elasticsearch expert. Generate a valid Elasticsearch query body as JSON.

Index: ${indexName}
Index mappings (field — type):
${fieldList}

Rules:
- Output ONLY valid JSON — the complete request body for the _search endpoint
- No markdown, no code fences, no explanations outside the JSON
- Use exact field names from the mappings above
- Include "size": 10 unless specified otherwise
- For text fields, use "match" queries; for keyword fields use "term"
- For date fields, use "range" with relative dates like "now-7d"
- For aggregations, set "size": 0 to skip hits
- Common patterns: bool queries for combining, nested for nested objects
- For follow-up requests, use conversation context to understand what the user wants modified`;
  }

  const schemaText = schema.map(t => {
    const cols = t.columns.map(c => {
      let col = `  ${c.name} ${c.type}`;
      if (c.isPrimary) col += " PRIMARY KEY";
      if (c.foreignKey) col += ` → ${c.foreignKey.table}(${c.foreignKey.column})`;
      return col;
    }).join("\n");
    return `Table "${t.schema}"."${t.name}":\n${cols}`;
  }).join("\n\n");

  return `You are a SQL expert for ${dialect === "postgres" ? "PostgreSQL" : "SQLite"} databases.

Database schema:
${schemaText}

Rules:
- First write a brief reasoning (1-2 sentences) explaining your approach
- Then output the SQL in a fenced code block: \`\`\`sql ... \`\`\`
- Use ${dialect === "postgres" ? "PostgreSQL" : "SQLite"} syntax
- Use exact table and column names from the schema
- Include LIMIT 100 for SELECT queries unless specified otherwise
- For follow-up requests, use conversation context to understand what the user wants modified`;
}

export async function getAiSuggestions(
  schema: TableSchema[],
  dialect: SqlDialect
): Promise<QuerySuggestion[]> {
  // For ES, the backend expects {fields, dialect} instead of {schema, dialect}
  const body =
    dialect === "elasticsearch"
      ? { fields: schema.flatMap((t) => t.columns.map((c) => c.name)), dialect }
      : { schema, dialect };

  const res = await fetch("/api/proxy/ai/sql/suggestions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = await res.json() as { suggestions?: QuerySuggestion[] };
  return data.suggestions ?? [];
}
