"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, ArrowRight, ChevronDown, Brain, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  generateAiSqlChat,
  buildSchemaSystemMessage,
  getAiSqlSuggestions,
} from "@/lib/ai-sql";
import type { SqlSuggestion } from "@/lib/ai-sql";
import type { TableSchema, SqlDialect, AiSession, AiSessionEntry } from "./types";

// ─── Shimmer CSS (inlined to avoid coupling with llms-txt-generator) ──────────

const SHIMMER_CSS = `
@keyframes ai-shimmer-sweep {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
.ai-shimmer-row {
  position: relative;
  overflow: hidden;
}
.ai-shimmer-row::after {
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
  animation: ai-shimmer-sweep 2.4s ease-in-out infinite;
  pointer-events: none;
}
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiSqlBarProps {
  schema: TableSchema[];
  dialect: SqlDialect;
  onSqlGenerated: (sql: string) => void;
  aiEnabled: boolean;
  aiSession?: AiSession;
  onAiSessionChange?: (session: AiSession) => void;
  getEditorContent?: () => string;
  lastQuerySummary?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSqlFromResponse(text: string): { sql: string; reasoning: string } {
  // Try to extract fenced ```sql block
  const match = text.match(/```sql\s*([\s\S]*?)```/i);
  const sql = match ? match[1].trim() : text.trim();

  // Reasoning is everything before the code block
  const reasoning = match
    ? text.slice(0, text.indexOf(match[0])).trim()
    : "";

  return { sql, reasoning };
}

function truncateSql(sql: string, maxLen = 60): string {
  const single = sql.replace(/\s+/g, " ").trim();
  return single.length > maxLen ? single.slice(0, maxLen) + "…" : single;
}

function newEntry(userPrompt: string): AiSessionEntry {
  return {
    id: Math.random().toString(36).slice(2),
    userPrompt,
    sql: "",
    status: "thinking",
  };
}

function emptySession(): AiSession {
  return { messages: [], entries: [], schemaInjected: false };
}

// ─── AiHistoryEntry ───────────────────────────────────────────────────────────

function AiHistoryEntry({ entry }: { entry: AiSessionEntry }) {
  const [open, setOpen] = useState(false);

  const isThinking = entry.status === "thinking";
  const isError = entry.status === "error";
  const isDone = entry.status === "done";

  return (
    <div className="rounded-md border border-border/40 overflow-hidden text-xs">
      {/* Prompt row */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5",
          isThinking && "ai-shimmer-row bg-primary/5",
          isDone && "bg-muted/30",
          isError && "bg-destructive/5"
        )}
      >
        <Sparkles
          className={cn(
            "h-3 w-3 shrink-0",
            isThinking && "text-primary animate-pulse",
            isDone && "text-primary/60",
            isError && "text-destructive"
          )}
        />
        <span
          className={cn(
            "flex-1 font-medium truncate",
            isThinking && "text-foreground",
            isDone && "text-muted-foreground",
            isError && "text-destructive"
          )}
        >
          {entry.userPrompt}
        </span>

        {/* Expand/collapse chevron when done and has reasoning */}
        {isDone && entry.reasoning && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title={open ? "Hide reasoning" : "Show reasoning"}
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {/* Thinking state */}
      {isThinking && (
        <div className="px-2.5 py-1.5 flex items-center gap-1.5 border-t border-border/30 bg-muted/10">
          <Brain className="h-3 w-3 text-muted-foreground/50 animate-pulse" />
          <span className="text-muted-foreground/60 text-[11px]">Thinking…</span>
        </div>
      )}

      {/* Error state */}
      {isError && entry.error && (
        <div className="px-2.5 py-1.5 flex items-start gap-1.5 border-t border-destructive/20 bg-destructive/5">
          <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-px" />
          <span className="text-destructive text-[11px] break-words">{entry.error}</span>
        </div>
      )}

      {/* Done: collapsed summary + optional expanded reasoning */}
      {isDone && (
        <>
          {/* Collapsed: reasoning pill */}
          {entry.reasoning && !open && (
            <div className="px-2.5 py-1 border-t border-border/20 bg-muted/10">
              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <Brain className="h-2.5 w-2.5" />
                <span className="text-[10px]">Thought for a moment</span>
              </button>
            </div>
          )}

          {/* Expanded reasoning */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              {entry.reasoning && (
                <div className="px-2.5 py-2 border-t border-border/20 bg-muted/10">
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                    {entry.reasoning}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SQL preview */}
          {entry.sql && (
            <div className="px-2.5 py-1 border-t border-border/20 bg-muted/5">
              <span className="text-[10px] font-mono text-muted-foreground/50">
                {truncateSql(entry.sql)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SuggestionSkeletons ──────────────────────────────────────────────────────

function SuggestionSkeletons() {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
      {[72, 96, 88, 80].map((w, i) => (
        <div
          key={i}
          className="shrink-0 h-6 rounded-full bg-muted/50 animate-pulse"
          style={{ width: `${w}px` }}
        />
      ))}
    </div>
  );
}

// ─── AiSqlBar ─────────────────────────────────────────────────────────────────

export function AiSqlBar({
  schema,
  dialect,
  onSqlGenerated,
  aiEnabled,
  aiSession,
  onAiSessionChange,
  getEditorContent,
  lastQuerySummary,
}: AiSqlBarProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SqlSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const session = aiSession ?? emptySession();
  const hasEntries = session.entries.length > 0;

  // Load suggestions on mount (only if AI enabled and schema has tables)
  useEffect(() => {
    if (!aiEnabled || schema.length === 0 || suggestionsLoaded) return;
    let cancelled = false;
    setSuggestionsLoading(true);
    getAiSqlSuggestions(schema, dialect)
      .then((result) => {
        if (cancelled) return;
        setSuggestions(result);
        setSuggestionsLoaded(true);
        setSuggestionsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestionsLoaded(true);
          setSuggestionsLoading(false);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiEnabled, dialect]);

  // Auto-scroll history to bottom when entries change
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.entries.length]);

  const updateSession = useCallback(
    (updater: (s: AiSession) => AiSession) => {
      onAiSessionChange?.(updater(aiSession ?? emptySession()));
    },
    [aiSession, onAiSessionChange]
  );

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading || !aiEnabled) return;

    setLoading(true);
    setPrompt("");

    // Build session snapshot to work with
    let current = aiSession ?? emptySession();

    // Build messages array
    const messages = [...current.messages];

    // Inject schema as system message once
    if (!current.schemaInjected && schema.length > 0) {
      const sysMsg = { role: "system" as const, content: buildSchemaSystemMessage(schema, dialect) };
      messages.unshift(sysMsg);
      current = { ...current, messages, schemaInjected: true };
    }

    // Invisible context: editor content
    const editorContent = getEditorContent?.();
    if (editorContent?.trim()) {
      messages.push({
        role: "user",
        content: `Current SQL in editor:\n${editorContent}`,
      });
      // Immediately followed by assistant ack to keep context coherent
      messages.push({ role: "assistant", content: "Noted." });
    }

    // Invisible context: last query summary
    if (lastQuerySummary) {
      messages.push({
        role: "user",
        content: `Last query result: ${lastQuerySummary}`,
      });
      messages.push({ role: "assistant", content: "Noted." });
    }

    // Visible user turn
    messages.push({ role: "user", content: trimmed });

    // Create thinking entry
    const entry = newEntry(trimmed);
    const nextEntries = [...current.entries, entry];
    const sessionWithEntry: AiSession = {
      ...current,
      messages,
      entries: nextEntries,
    };
    onAiSessionChange?.(sessionWithEntry);

    // Call API
    const result = await generateAiSqlChat(messages, dialect);

    if (result.error) {
      onAiSessionChange?.({
        ...sessionWithEntry,
        entries: nextEntries.map((e) =>
          e.id === entry.id
            ? { ...e, status: "error", error: result.error }
            : e
        ),
      });
      setLoading(false);
      return;
    }

    // Parse reasoning + SQL from response
    const raw = result.sql ?? "";
    const { sql, reasoning } = extractSqlFromResponse(raw);

    // Add assistant message to history
    const assistantMsg = { role: "assistant" as const, content: raw };
    const finalMessages = [...messages, assistantMsg];

    onAiSessionChange?.({
      ...sessionWithEntry,
      messages: finalMessages,
      entries: nextEntries.map((e) =>
        e.id === entry.id
          ? { ...e, status: "done", sql, reasoning }
          : e
      ),
    });

    if (sql) onSqlGenerated(sql);
    setLoading(false);
  }, [
    prompt,
    loading,
    aiEnabled,
    aiSession,
    schema,
    dialect,
    getEditorContent,
    lastQuerySummary,
    onAiSessionChange,
    onSqlGenerated,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleGenerate();
      }
    },
    [handleGenerate]
  );

  const handleChipClick = useCallback(
    (chip: SqlSuggestion) => {
      onSqlGenerated(chip.sql);
    },
    [onSqlGenerated]
  );

  const showSuggestions =
    aiEnabled && !hasEntries && (suggestionsLoading || suggestions.length > 0);

  return (
    <>
      {/* Inject shimmer CSS once */}
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />

      <div className="bg-muted/20 border-b px-3 pt-2 pb-1.5 shrink-0">
        {/* Session history */}
        {hasEntries && (
          <div className="max-h-40 overflow-y-auto mb-2 space-y-1.5 pr-0.5">
            {session.entries.map((entry) => (
              <AiHistoryEntry key={entry.id} entry={entry} />
            ))}
            <div ref={historyEndRef} />
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2">
          {/* Sparkles icon */}
          <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || !aiEnabled}
            placeholder={
              aiEnabled
                ? hasEntries
                  ? "Follow up or ask something new…"
                  : "Describe what you need in plain English…"
                : "AI SQL generation requires a Pro plan"
            }
            className={cn(
              "flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50",
              (!aiEnabled || loading) && "cursor-not-allowed opacity-60"
            )}
          />

          {/* Generate button */}
          {aiEnabled && (
            <button
              onClick={() => void handleGenerate()}
              disabled={loading || !prompt.trim()}
              className={cn(
                "shrink-0 flex items-center justify-center h-6 w-6 rounded-md transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                (loading || !prompt.trim()) && "opacity-40 cursor-not-allowed pointer-events-none"
              )}
              title="Generate SQL (Enter)"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Upgrade link */}
          {!aiEnabled && (
            <Link
              href="/account/billing"
              className="shrink-0 text-xs text-primary hover:underline underline-offset-2 whitespace-nowrap"
            >
              Upgrade to Pro
            </Link>
          )}
        </div>

        {/* Suggestion chips — only when no entries yet */}
        {showSuggestions && (
          <div className="mt-1.5 pl-8">
            {suggestionsLoading ? (
              <SuggestionSkeletons />
            ) : (
              <div className="animate-in fade-in duration-300">
                <div
                  className={cn(
                    "flex gap-1.5 pb-0.5",
                    chipsExpanded ? "flex-wrap" : "overflow-hidden max-h-7"
                  )}
                >
                  {suggestions.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleChipClick(chip)}
                      className="shrink-0 bg-muted/50 hover:bg-muted text-xs rounded-full px-3 py-1 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                {suggestions.length > 3 && (
                  <button
                    onClick={() => setChipsExpanded((v) => !v)}
                    className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform", chipsExpanded && "rotate-180")}
                    />
                    {chipsExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
