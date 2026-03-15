import type { TableSchema, SqlDialect, AiMessage } from "@/components/account/database-studio/types";

export interface AiSqlResponse {
  sql: string;
  tokensUsed: number;
  error?: string;
}

export interface SqlSuggestion {
  label: string;
  sql: string;
}

export async function generateAiSql(
  prompt: string,
  schema: TableSchema[],
  dialect: SqlDialect
): Promise<AiSqlResponse> {
  const res = await fetch("/api/proxy/ai/sql", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, schema, dialect }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { sql: "", tokensUsed: 0, error: (err as { error?: string }).error ?? `HTTP ${res.status}` };
  }
  return res.json() as Promise<AiSqlResponse>;
}

export interface AiSqlChatResponse {
  sql: string;
  reasoning?: string;
  tokensUsed: number;
  error?: string;
}

export async function generateAiSqlChat(
  messages: AiMessage[],
  dialect: SqlDialect
): Promise<AiSqlChatResponse> {
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
  return res.json() as Promise<AiSqlChatResponse>;
}

export function buildSchemaSystemMessage(schema: TableSchema[], dialect: SqlDialect): string {
  if (dialect === "elasticsearch") {
    // For ES, schema represents index fields — columns are field names, table name is the index
    const fields = schema.flatMap(t =>
      t.columns.map(c => `  ${c.name}${c.type ? ` (${c.type})` : ""}`)
    );
    const indexName = schema[0]?.name ?? "*";
    const fieldList = fields.length > 0 ? fields.join("\n") : "  (no fields known)";

    return `You are an Elasticsearch expert. Generate a valid Elasticsearch query body (JSON) based on the user's request.

Index: ${indexName}
Known fields:
${fieldList}

Rules:
- First write a brief reasoning (1-2 sentences) explaining your approach
- Then output the Elasticsearch JSON query body in a fenced code block: \`\`\`json ... \`\`\`
- Output ONLY valid JSON inside the fence — the complete request body for _search
- Use exact field names from the list above
- Include "size": 10 unless the user specifies otherwise
- Use the appropriate query types: match, term, range, bool, etc.
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

export async function getAiSqlSuggestions(
  schema: TableSchema[],
  dialect: SqlDialect
): Promise<SqlSuggestion[]> {
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
  const data = await res.json() as { suggestions?: SqlSuggestion[] };
  return data.suggestions ?? [];
}

// ─── Elasticsearch helpers ────────────────────────────────────────────────────

export interface EsAiResponse {
  sql: string;  // re-uses the "sql" field name — contains the JSON query body
  reasoning?: string;
  tokensUsed: number;
  error?: string;
}

/**
 * Generate an Elasticsearch query body from a natural-language prompt.
 * Uses the existing /ai/sql endpoint with dialect "elasticsearch" and a
 * system message that describes the index mappings.
 */
export async function generateEsAiQuery(
  prompt: string,
  mappingFields: string[],
  selectedIndex: string,
): Promise<EsAiResponse> {
  const mappingText = mappingFields.length > 0
    ? mappingFields.map((f) => `  ${f}`).join("\n")
    : "  (no fields known)";

  const systemMessage = {
    role: "system" as const,
    content: `You are an Elasticsearch expert. Generate a valid Elasticsearch query body (JSON) based on the user's request.

Index: ${selectedIndex || "*"}
Known fields:
${mappingText}

Rules:
- Output ONLY valid JSON — the complete request body for _search
- No markdown formatting, no code fences, no explanations
- Use exact field names from the list above
- Include "size": 10 unless the user specifies otherwise
- Use the appropriate query types: match, term, range, bool, etc.`,
  };

  const messages = [
    systemMessage,
    { role: "user" as const, content: prompt },
  ];

  const res = await fetch("/api/proxy/ai/sql", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, dialect: "elasticsearch" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { sql: "", tokensUsed: 0, error: (err as { error?: string }).error ?? `HTTP ${res.status}` };
  }
  return res.json() as Promise<EsAiResponse>;
}

/**
 * Fetch rule-based Elasticsearch query suggestions derived from field names.
 */
export async function getEsAiSuggestions(
  fields: string[],
): Promise<SqlSuggestion[]> {
  const res = await fetch("/api/proxy/ai/sql/suggestions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields, dialect: "elasticsearch" }),
  });
  if (!res.ok) return [];
  const data = await res.json() as { suggestions?: SqlSuggestion[] };
  return data.suggestions ?? [];
}
