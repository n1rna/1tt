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

/**
 * Send a chat request to the AI query agent.
 * The backend owns the system prompt - we only send user/assistant messages,
 * the schema, and the dialect. The backend builds the full prompt chain.
 */
export async function generateAiChat(
  messages: AiMessage[],
  dialect: SqlDialect,
  schema?: TableSchema[]
): Promise<AiChatResponse> {
  // Strip any system messages - the backend builds its own
  const filteredMessages = messages.filter((m) => m.role !== "system");

  const res = await fetch("/api/proxy/ai/query", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: filteredMessages,
      dialect,
      schema: schema ?? [],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { sql: "", tokensUsed: 0, error: (err as { error?: string }).error ?? `HTTP ${res.status}` };
  }
  return res.json() as Promise<AiChatResponse>;
}

export async function getAiSuggestions(
  schema: TableSchema[],
  dialect: SqlDialect
): Promise<QuerySuggestion[]> {
  const body =
    dialect === "elasticsearch" || dialect === "redis"
      ? { fields: schema.flatMap((t) => t.columns.map((c) => c.name)), dialect }
      : { schema, dialect };

  const res = await fetch("/api/proxy/ai/query/suggestions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = await res.json() as { suggestions?: QuerySuggestion[] };
  return data.suggestions ?? [];
}
