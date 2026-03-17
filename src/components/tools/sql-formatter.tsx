"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { format as sqlFormat } from "sql-formatter";
import type { SqlLanguage, KeywordCase } from "sql-formatter";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  X,
  ClipboardPaste,
  Minimize2,
  Maximize2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Brain,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useBillingStatus } from "@/lib/billing";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AiSessionEntry {
  id: string;
  userPrompt: string;
  sql: string;
  reasoning?: string;
  status: "thinking" | "done" | "error";
  error?: string;
}

interface AiSession {
  messages: AiMessage[];
  entries: AiSessionEntry[];
  systemInjected: boolean;
}

interface FormatOptions {
  dialect: SqlLanguage;
  indentStyle: "2" | "4" | "tab";
  keywordCase: KeywordCase;
  linesBetweenQueries: 1 | 2;
  denseOperators: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIALECTS: { value: SqlLanguage; label: string }[] = [
  { value: "sql", label: "Standard SQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "mariadb", label: "MariaDB" },
  { value: "bigquery", label: "BigQuery" },
  { value: "tsql", label: "Transact-SQL (MSSQL)" },
  { value: "plsql", label: "PL/SQL (Oracle)" },
  { value: "spark", label: "Spark SQL" },
  { value: "redshift", label: "Redshift" },
];

const DIALECT_API_MAP: Record<string, string> = {
  sql: "sql",
  postgresql: "postgres",
  mysql: "mysql",
  sqlite: "sqlite",
  mariadb: "mariadb",
  bigquery: "bigquery",
  tsql: "tsql",
  plsql: "plsql",
  spark: "spark",
  redshift: "redshift",
};

// ─── Shimmer CSS ──────────────────────────────────────────────────────────────

const SHIMMER_CSS = `
@keyframes sql-ai-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
.sql-ai-shimmer-row {
  position: relative;
  overflow: hidden;
}
.sql-ai-shimmer-row::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--primary) 6%, transparent) 45%,
    color-mix(in srgb, var(--primary) 10%, transparent) 50%,
    color-mix(in srgb, var(--primary) 6%, transparent) 55%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: sql-ai-shimmer 2.4s ease-in-out infinite;
  pointer-events: none;
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSqlFromResponse(text: string): { sql: string; reasoning: string } {
  const match =
    text.match(/```(?:sql)\s*([\s\S]*?)```/i) ??
    text.match(/```\s*([\s\S]*?)```/);
  const sql = match ? match[1].trim() : text.trim();
  const reasoning = match ? text.slice(0, text.indexOf(match[0])).trim() : "";
  return { sql, reasoning };
}

function buildSqlSystemMessage(dialectLabel: string): string {
  return `You are a SQL expert. Generate SQL queries based on the user's natural language description.

Rules:
- First write a brief reasoning (1-2 sentences) explaining your approach
- Then output the SQL in a fenced code block: \`\`\`sql ... \`\`\`
- Use ${dialectLabel} syntax
- Write clean, well-structured SQL
- Include sample table/column names that make sense for the request
- For follow-up requests, use conversation context`;
}

function newEntry(userPrompt: string): AiSessionEntry {
  return { id: Math.random().toString(36).slice(2), userPrompt, sql: "", status: "thinking" };
}

function emptySession(): AiSession {
  return { messages: [], entries: [], systemInjected: false };
}

// ─── SQL Syntax Highlighter ───────────────────────────────────────────────────

const SQL_KEYWORDS = new Set([
  "SELECT","FROM","WHERE","AND","OR","NOT","IN","IS","NULL",
  "INSERT","INTO","VALUES","UPDATE","SET","DELETE",
  "CREATE","TABLE","ALTER","DROP","INDEX","VIEW",
  "JOIN","LEFT","RIGHT","INNER","OUTER","FULL","CROSS",
  "ON","AS","GROUP","BY","ORDER","HAVING","LIMIT","OFFSET",
  "DISTINCT","ALL","UNION","INTERSECT","EXCEPT",
  "CASE","WHEN","THEN","ELSE","END",
  "WITH","RECURSIVE","EXISTS","BETWEEN","LIKE","ILIKE",
  "PRIMARY","KEY","FOREIGN","REFERENCES","CONSTRAINT",
  "DEFAULT","UNIQUE","CHECK","BEGIN","COMMIT","ROLLBACK","TRANSACTION",
  "RETURNING","OVER","PARTITION","WINDOW",
  "INT","INTEGER","TEXT","VARCHAR","CHAR","BOOLEAN","BOOL",
  "FLOAT","DOUBLE","DECIMAL","NUMERIC","DATE","TIME","TIMESTAMP",
  "TRUE","FALSE","ASC","DESC","NULLS","FIRST","LAST",
  "COUNT","SUM","AVG","MIN","MAX","COALESCE","NULLIF","CAST",
  "SERIAL","AUTO_INCREMENT","NOT NULL",
]);

interface Token { type: string; value: string }

function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const val = end === -1 ? sql.slice(i) : sql.slice(i, end);
      tokens.push({ type: "comment", value: val });
      i += val.length;
    } else if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const val = end === -1 ? sql.slice(i) : sql.slice(i, end + 2);
      tokens.push({ type: "comment", value: val });
      i += val.length;
    } else if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      tokens.push({ type: "string", value: sql.slice(i, j) });
      i = j;
    } else if (sql[i] === '"' || sql[i] === "`") {
      const q = sql[i];
      let j = i + 1;
      while (j < sql.length && sql[j] !== q) j++;
      tokens.push({ type: "identifier", value: sql.slice(i, j + 1) });
      i = j + 1;
    } else if (/\d/.test(sql[i]) || (sql[i] === "." && /\d/.test(sql[i + 1] ?? ""))) {
      let j = i;
      while (j < sql.length && /[\d._eE+\-]/.test(sql[j])) j++;
      tokens.push({ type: "number", value: sql.slice(i, j) });
      i = j;
    } else if (/[a-zA-Z_]/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /[\w]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      tokens.push({ type: SQL_KEYWORDS.has(word.toUpperCase()) ? "keyword" : "word", value: word });
      i = j;
    } else {
      tokens.push({ type: "text", value: sql[i] });
      i++;
    }
  }
  return tokens;
}

function HighlightedSql({ sql }: { sql: string }) {
  const tokens = tokenizeSql(sql);
  return (
    <>
      {tokens.map((tok, idx) => {
        if (tok.type === "keyword")
          return <span key={idx} className="text-blue-500 dark:text-blue-400">{tok.value}</span>;
        if (tok.type === "string")
          return <span key={idx} className="text-green-600 dark:text-green-400">{tok.value}</span>;
        if (tok.type === "number")
          return <span key={idx} className="text-orange-500 dark:text-orange-400">{tok.value}</span>;
        if (tok.type === "comment")
          return <span key={idx} className="text-muted-foreground italic">{tok.value}</span>;
        if (tok.type === "identifier")
          return <span key={idx} className="text-purple-600 dark:text-purple-400">{tok.value}</span>;
        return <span key={idx}>{tok.value}</span>;
      })}
    </>
  );
}

// ─── Timeline Entry ───────────────────────────────────────────────────────────

function TimelineEntry({ entry, expanded, isLast }: {
  entry: AiSessionEntry;
  expanded: boolean;
  isLast: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(expanded);
  const isThinking = entry.status === "thinking";
  const isError = entry.status === "error";
  const isDone = entry.status === "done";

  return (
    <div className="relative flex gap-2.5 text-xs">
      <div className="flex flex-col items-center shrink-0 w-4">
        <div className={cn(
          "flex items-center justify-center h-4 w-4 rounded-full shrink-0 z-10",
          isThinking && "bg-primary/20",
          isDone && "bg-green-500/15",
          isError && "bg-destructive/15"
        )}>
          {isThinking ? (
            <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
          ) : isError ? (
            <AlertCircle className="h-2.5 w-2.5 text-destructive" />
          ) : (
            <Check className="h-2.5 w-2.5 text-green-500" />
          )}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border/40 -mb-1" />}
      </div>

      <div className={cn("flex-1 min-w-0 pb-2.5", isLast && "pb-1")}>
        <button
          onClick={() => isDone && setDetailOpen((v) => !v)}
          disabled={!isDone}
          className={cn(
            "flex items-center gap-1.5 w-full text-left min-w-0",
            isDone && "cursor-pointer hover:text-foreground",
            isThinking && "sql-ai-shimmer-row rounded px-1 -mx-1"
          )}
        >
          <span className={cn(
            "flex-1 truncate",
            isThinking && "text-foreground font-medium",
            isDone && "text-muted-foreground",
            isError && "text-destructive"
          )}>
            {entry.userPrompt}
          </span>
          {isDone && (entry.reasoning || entry.sql) && (
            <ChevronDown className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200",
              detailOpen && "rotate-180"
            )} />
          )}
        </button>

        {isThinking && (
          <div className="flex items-center gap-1.5 mt-1">
            <Brain className="h-2.5 w-2.5 text-muted-foreground/40 animate-pulse" />
            <span className="text-muted-foreground/50 text-[11px]">Thinking…</span>
          </div>
        )}

        {isError && entry.error && (
          <p className="mt-1 text-destructive text-[11px] break-words">{entry.error}</p>
        )}

        {isDone && (
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: detailOpen ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="mt-1.5 space-y-1">
                {entry.reasoning && (
                  <div className="flex items-start gap-1.5">
                    <Brain className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{entry.reasoning}</p>
                  </div>
                )}
                {entry.sql && (
                  <div className="rounded bg-muted/30 px-2 py-1">
                    <code className="text-[10px] font-mono text-muted-foreground/70 break-all whitespace-pre-wrap">
                      {entry.sql.length > 200 ? entry.sql.slice(0, 200) + "…" : entry.sql}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Resize Handle ────────────────────────────────────────────────────────────

function ResizeHandle({ onResize }: {
  onResize: (delta: number, containerWidth: number) => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let lastX = e.clientX;
    const container = handleRef.current?.parentElement;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - lastX;
      lastX = e.clientX;
      onResize(delta, containerWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [onResize]);

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className="hidden md:block w-1 shrink-0 cursor-col-resize bg-border hover:bg-ring transition-colors"
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SqlFormatterTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [widths, setWidths] = useState([50, 50]);
  const [options, setOptions] = useState<FormatOptions>({
    dialect: "sql",
    indentStyle: "2",
    keywordCase: "upper",
    linesBetweenQueries: 1,
    denseOperators: false,
  });

  // AI
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSession, setAiSession] = useState<AiSession>(emptySession());
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [aiBarOpen, setAiBarOpen] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Auth / billing
  const { data: session } = useSession();
  const { data: billing } = useBillingStatus();
  const aiEnabled = !!session && billing != null && billing.plan !== "free";

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Format on change ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setFormatError(null);
      return;
    }
    const t = setTimeout(() => {
      try {
        const tabWidth = options.indentStyle === "4" ? 4 : 2;
        const useTabs = options.indentStyle === "tab";
        const formatted = sqlFormat(input, {
          language: options.dialect,
          tabWidth,
          useTabs,
          keywordCase: options.keywordCase,
          linesBetweenQueries: options.linesBetweenQueries,
          denseOperators: options.denseOperators,
        });
        setOutput(formatted);
        setFormatError(null);
      } catch (err) {
        setFormatError(err instanceof Error ? err.message : String(err));
        setOutput("");
      }
    }, 50);
    return () => clearTimeout(t);
  }, [input, options]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleMinify = useCallback(() => {
    if (!input.trim()) return;
    try {
      const m = sqlFormat(input, {
        language: options.dialect,
        tabWidth: 1,
        useTabs: false,
        linesBetweenQueries: 1,
        keywordCase: options.keywordCase,
        denseOperators: true,
      }).replace(/\s+/g, " ").trim();
      setInput(m);
    } catch { /* ignore */ }
  }, [input, options]);

  const handleBeautify = useCallback(() => {
    if (output) setInput(output);
  }, [output]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setFormatError(null);
    textareaRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    setInput(text);
  }, []);

  const handleResize = useCallback((delta: number, containerWidth: number) => {
    setWidths((prev) => {
      const deltaPct = (delta / containerWidth) * 100;
      const newLeft = prev[0] + deltaPct;
      const newRight = prev[1] - deltaPct;
      if (newLeft < 15 || newRight < 15) return prev;
      return [newLeft, newRight];
    });
  }, []);

  // ── AI ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiSession.entries.length]);

  const handleAiGenerate = useCallback(async () => {
    const trimmed = aiPrompt.trim();
    if (!trimmed || aiLoading || !aiEnabled) return;

    setAiLoading(true);
    setAiPrompt("");

    let current = { ...aiSession };
    const messages: AiMessage[] = [...current.messages];

    if (!current.systemInjected) {
      const dialectLabel = DIALECTS.find((d) => d.value === options.dialect)?.label ?? options.dialect;
      messages.unshift({ role: "system", content: buildSqlSystemMessage(dialectLabel) });
      current = { ...current, messages, systemInjected: true };
    }

    messages.push({ role: "user", content: trimmed });

    const entry = newEntry(trimmed);
    const nextEntries = [...current.entries, entry];
    const sessionWithEntry: AiSession = { ...current, messages, entries: nextEntries };
    setAiSession(sessionWithEntry);

    try {
      const res = await fetch("/api/proxy/ai/query", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          dialect: DIALECT_API_MAP[options.dialect] ?? "sql",
        }),
      });

      const data = await res.json() as { sql?: string; tokensUsed?: number; error?: string };

      if (!res.ok || data.error) {
        setAiSession((s) => ({
          ...s,
          entries: s.entries.map((e) =>
            e.id === entry.id ? { ...e, status: "error" as const, error: data.error ?? `HTTP ${res.status}` } : e
          ),
        }));
        setAiLoading(false);
        return;
      }

      const raw = data.sql ?? "";
      const { sql, reasoning } = extractSqlFromResponse(raw);

      setAiSession((s) => ({
        ...s,
        messages: [...messages, { role: "assistant", content: raw }],
        entries: s.entries.map((e) =>
          e.id === entry.id ? { ...e, status: "done" as const, sql, reasoning } : e
        ),
      }));

      if (sql) setInput(sql);
    } catch (err) {
      setAiSession((s) => ({
        ...s,
        entries: s.entries.map((e) =>
          e.id === entry.id
            ? { ...e, status: "error" as const, error: err instanceof Error ? err.message : "Unknown error" }
            : e
        ),
      }));
    }
    setAiLoading(false);
  }, [aiPrompt, aiLoading, aiEnabled, aiSession, options.dialect]);

  const handleAiKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleAiGenerate();
      }
    },
    [handleAiGenerate]
  );

  const hasAiEntries = aiSession.entries.length > 0;
  const olderEntries = hasAiEntries ? aiSession.entries.slice(0, -1) : [];
  const latestEntry = hasAiEntries ? aiSession.entries[aiSession.entries.length - 1] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />

      {/* ── AI Bar — collapsible header + content ── */}
      <button
        onClick={() => setAiBarOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 border-b shrink-0 text-left transition-colors",
          aiBarOpen
            ? "bg-primary/5 hover:bg-primary/10"
            : "bg-muted/10 hover:bg-muted/20"
        )}
      >
        <Sparkles className={cn("h-3 w-3 shrink-0", aiBarOpen ? "text-primary" : "text-muted-foreground/50")} />
        <span className={cn("text-xs font-medium", aiBarOpen ? "text-primary" : "text-muted-foreground/50")}>
          AI Assistant
        </span>
        {hasAiEntries && (
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            {aiSession.entries.length} {aiSession.entries.length === 1 ? "prompt" : "prompts"}
          </span>
        )}
        <div className="flex-1" />
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            aiBarOpen ? "text-primary/60 rotate-180" : "text-muted-foreground/40"
          )}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out shrink-0"
        style={{ gridTemplateRows: aiBarOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="bg-muted/20 border-b px-3 pt-2 pb-1.5">
            {hasAiEntries && (
              <div className="mb-2 pl-0.5">
                {olderEntries.length > 0 && !historyExpanded && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setHistoryExpanded(true); }}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mb-1.5 transition-colors"
                  >
                    <ChevronDown className="h-3 w-3" />
                    {olderEntries.length} earlier {olderEntries.length === 1 ? "prompt" : "prompts"}
                  </button>
                )}
                {historyExpanded && olderEntries.length > 0 && (
                  <>
                    <div className="max-h-32 overflow-y-auto">
                      {olderEntries.map((e) => (
                        <TimelineEntry key={e.id} entry={e} expanded={false} isLast={false} />
                      ))}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHistoryExpanded(false); }}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mb-1 transition-colors"
                    >
                      <ChevronUp className="h-3 w-3" />
                      Show less
                    </button>
                  </>
                )}
                {latestEntry && (
                  <TimelineEntry key={latestEntry.id} entry={latestEntry} expanded isLast />
                )}
                <div ref={historyEndRef} />
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={handleAiKeyDown}
                disabled={aiLoading || !aiEnabled}
                placeholder={
                  aiEnabled
                    ? hasAiEntries
                      ? "Follow up or ask something new…"
                      : "Describe the SQL you need in plain English…"
                    : "AI query generation requires a Pro plan"
                }
                className={cn(
                  "flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50",
                  (!aiEnabled || aiLoading) && "cursor-not-allowed opacity-60"
                )}
              />
              {aiEnabled && (
                <button
                  onClick={() => void handleAiGenerate()}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className={cn(
                    "shrink-0 flex items-center justify-center h-6 w-6 rounded-md transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    (aiLoading || !aiPrompt.trim()) && "opacity-40 cursor-not-allowed pointer-events-none"
                  )}
                  title="Generate SQL (Enter)"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {!aiEnabled && (
                <Link
                  href="/account/billing"
                  className="shrink-0 text-xs text-primary hover:underline underline-offset-2 whitespace-nowrap"
                >
                  Upgrade to Pro
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2 border-b shrink-0">
        <select
          value={options.dialect}
          onChange={(e) => setOptions((o) => ({ ...o, dialect: e.target.value as SqlLanguage }))}
          className="h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:border-ring cursor-pointer"
        >
          {DIALECTS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        <select
          value={options.indentStyle}
          onChange={(e) => setOptions((o) => ({ ...o, indentStyle: e.target.value as FormatOptions["indentStyle"] }))}
          className="h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:border-ring cursor-pointer"
        >
          <option value="2">2 spaces</option>
          <option value="4">4 spaces</option>
          <option value="tab">Tabs</option>
        </select>

        <select
          value={options.keywordCase}
          onChange={(e) => setOptions((o) => ({ ...o, keywordCase: e.target.value as KeywordCase }))}
          className="h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:border-ring cursor-pointer"
        >
          <option value="upper">UPPER keywords</option>
          <option value="lower">lower keywords</option>
          <option value="preserve">preserve case</option>
        </select>

        <select
          value={options.linesBetweenQueries}
          onChange={(e) => setOptions((o) => ({ ...o, linesBetweenQueries: Number(e.target.value) as 1 | 2 }))}
          className="h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:border-ring cursor-pointer"
        >
          <option value={1}>1 line between queries</option>
          <option value={2}>2 lines between queries</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={options.denseOperators}
            onChange={(e) => setOptions((o) => ({ ...o, denseOperators: e.target.checked }))}
            className="rounded border-input"
          />
          Dense operators
        </label>

        <div className="flex items-center gap-1 ml-auto">
          <Button size="sm" variant="outline" onClick={handleBeautify} disabled={!output} className="h-7 text-xs px-2">
            <Maximize2 className="h-3 w-3 mr-1" />
            Beautify
          </Button>
          <Button size="sm" variant="outline" onClick={handleMinify} disabled={!input.trim()} className="h-7 text-xs px-2">
            <Minimize2 className="h-3 w-3 mr-1" />
            Minify
          </Button>
        </div>

        {formatError && (
          <div className="flex items-center gap-1 text-xs text-destructive w-full md:w-auto">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatError.slice(0, 80)}{formatError.length > 80 ? "…" : ""}</span>
          </div>
        )}
      </div>

      {/* ── Split panes ── */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Left: Input */}
        <div
          className="flex flex-col min-h-0 border-b md:border-b-0 md:border-r h-1/2 md:h-auto"
          style={{ width: undefined, flex: `0 0 ${widths[0]}%` }}
        >
          <div className="flex items-center gap-2 px-3 h-8 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Input</span>
            <div className="flex items-center gap-0.5 ml-auto">
              {!input && (
                <Button variant="ghost" size="sm" onClick={handlePaste} className="h-6 px-1.5 text-xs">
                  <ClipboardPaste className="h-3 w-3 mr-1" />
                  Paste
                </Button>
              )}
              {input && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="h-6 px-1.5 text-xs">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste or type SQL here…"
              className="w-full h-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none placeholder:text-muted-foreground caret-foreground"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Resize handle (desktop only) */}
        <ResizeHandle onResize={handleResize} />

        {/* Right: Output */}
        <div
          className="flex flex-col min-h-0 flex-1"
        >
          <div className="flex items-center gap-2 px-3 h-8 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Formatted</span>
            <div className="flex items-center gap-0.5 ml-auto">
              {output && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-1.5 text-xs">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
            {formatError ? (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Format error</p>
                  <p className="mt-1 text-xs font-mono text-muted-foreground">{formatError}</p>
                </div>
              </div>
            ) : output ? (
              <pre className="font-mono text-sm leading-6 whitespace-pre-wrap break-words">
                <HighlightedSql sql={output} />
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Formatted SQL will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
