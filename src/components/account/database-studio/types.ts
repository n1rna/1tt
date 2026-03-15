export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimary: boolean;
  isUnique: boolean;
  foreignKey?: { table: string; column: string };
}

export interface IndexSchema {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

export interface TableSchema {
  schema: string;
  name: string;
  type: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  rowEstimate: number;
}

export type CellValue = string | number | boolean | null;

export type TabType = "table" | "sql";

export interface TableTab {
  id: string;
  type: "table";
  schema: string;
  table: string;
  view: "data" | "structure";
}

export interface SqlTab {
  id: string;
  type: "sql";
  title: string;
}

export type Tab = TableTab | SqlTab;

export interface PendingEdit {
  rowIndex: number;
  column: string;
  originalValue: CellValue;
  newValue: CellValue;
}

export interface QueryResult {
  columns?: string[];
  rows?: string[][];
  rowCount?: number;
  rowsAffected?: number;
  error?: string;
  // Multi-statement results
  results?: StatementResult[];
}

export interface StatementResult {
  statement: string;
  columns?: string[];
  rows?: string[][];
  rowCount?: number;
  rowsAffected?: number;
  error?: string;
}

export type QueryExecutor = (sql: string) => Promise<QueryResult>;

export type SqlDialect = "postgres" | "sqlite" | "elasticsearch";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiSessionEntry {
  id: string;
  userPrompt: string;
  reasoning?: string;
  sql: string;
  status: "thinking" | "done" | "error";
  error?: string;
}

export interface AiSession {
  messages: AiMessage[];
  entries: AiSessionEntry[];
  schemaInjected: boolean;
}
