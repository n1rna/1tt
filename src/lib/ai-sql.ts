import type { TableSchema, SqlDialect } from "@/components/account/database-studio/types";

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

export async function getAiSqlSuggestions(
  schema: TableSchema[],
  dialect: SqlDialect
): Promise<SqlSuggestion[]> {
  const res = await fetch("/api/proxy/ai/sql/suggestions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema, dialect }),
  });
  if (!res.ok) return [];
  const data = await res.json() as { suggestions?: SqlSuggestion[] };
  return data.suggestions ?? [];
}
