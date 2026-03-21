"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, ArrowRight, ChevronDown, ChevronUp, Brain, AlertCircle, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  generateAiChat,
  getAiSuggestions,
} from "@/lib/ai-query";
import type { QuerySuggestion } from "@/lib/ai-query";
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

interface AiQueryBarProps {
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

function extractQueryFromResponse(text: string): { sql: string; reasoning: string } {
  // Try fenced ```sql, ```json, or ```redis block
  const match = text.match(/```(?:sql|json|redis)\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  const sql = match ? match[1].trim() : text.trim();

  // Reasoning is everything before the code block
  const reasoning = match
    ? text.slice(0, text.indexOf(match[0])).trim()
    : "";

  return { sql, reasoning };
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

// ─── Timeline entry ──────────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  expanded,
  isLast,
}: {
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
      {/* Timeline line + bullet */}
      <div className="flex flex-col items-center shrink-0 w-4">
        {/* Bullet */}
        <div
          className={cn(
            "flex items-center justify-center h-4 w-4 rounded-full shrink-0 z-10",
            isThinking && "bg-primary/20",
            isDone && "bg-green-500/15",
            isError && "bg-destructive/15"
          )}
        >
          {isThinking ? (
            <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
          ) : isError ? (
            <AlertCircle className="h-2.5 w-2.5 text-destructive" />
          ) : (
            <Check className="h-2.5 w-2.5 text-green-500" />
          )}
        </div>
        {/* Vertical line */}
        {!isLast && (
          <div className="w-px flex-1 bg-border/40 -mb-1" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0 pb-2.5", isLast ? "pb-1" : "pb-2.5")}>
        {/* Prompt */}
        <button
          onClick={() => isDone && setDetailOpen((v) => !v)}
          disabled={!isDone}
          className={cn(
            "flex items-center gap-1.5 w-full text-left min-w-0",
            isDone && "cursor-pointer hover:text-foreground",
            isThinking && "ai-shimmer-row rounded px-1 -mx-1"
          )}
        >
          <span
            className={cn(
              "flex-1 truncate",
              isThinking && "text-foreground font-medium",
              isDone && "text-muted-foreground",
              isError && "text-destructive"
            )}
          >
            {entry.userPrompt}
          </span>
          {isDone && (entry.reasoning || entry.sql) && (
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200",
                detailOpen && "rotate-180"
              )}
            />
          )}
        </button>

        {/* Thinking */}
        {isThinking && (
          <div className="flex items-center gap-1.5 mt-1">
            <Brain className="h-2.5 w-2.5 text-muted-foreground/40 animate-pulse" />
            <span className="text-muted-foreground/50 text-[11px]">Thinking…</span>
          </div>
        )}

        {/* Error */}
        {isError && entry.error && (
          <p className="mt-1 text-destructive text-[11px] break-words">{entry.error}</p>
        )}

        {/* Expandable detail for done entries */}
        {isDone && (
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: detailOpen ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="mt-1.5 space-y-1">
                {/* Reasoning */}
                {entry.reasoning && (
                  <div className="flex items-start gap-1.5">
                    <Brain className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                      {entry.reasoning}
                    </p>
                  </div>
                )}
                {/* Query result */}
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

// ─── AiQueryBar ───────────────────────────────────────────────────────────────

export function AiQueryBar({
  schema,
  dialect,
  onSqlGenerated,
  aiEnabled,
  aiSession,
  onAiSessionChange,
  getEditorContent,
  lastQuerySummary,
}: AiQueryBarProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<QuerySuggestion[]>([]);
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
    getAiSuggestions(schema, dialect)
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
  void updateSession; // suppress unused-variable lint

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading || !aiEnabled) return;

    setLoading(true);
    setPrompt("");

    // Build session snapshot to work with
    let current = aiSession ?? emptySession();

    // Build messages array (no system messages - backend owns them)
    const messages = [...current.messages].filter((m) => m.role !== "system");
    if (!current.schemaInjected && schema.length > 0) {
      current = { ...current, schemaInjected: true };
    }

    // Invisible context: editor content
    const editorContent = getEditorContent?.();
    if (editorContent?.trim()) {
      messages.push({
        role: "user",
        content: `Current query in editor:\n${editorContent}`,
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
    const result = await generateAiChat(messages, dialect, schema);

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

    // Parse reasoning + query from response
    const raw = result.sql ?? "";
    const { sql, reasoning } = extractQueryFromResponse(raw);

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
    (chip: QuerySuggestion) => {
      onSqlGenerated(chip.sql);
    },
    [onSqlGenerated]
  );

  const [historyExpanded, setHistoryExpanded] = useState(false);

  const showSuggestions =
    aiEnabled && !hasEntries && (suggestionsLoading || suggestions.length > 0);

  // Split entries: older ones (collapsible) vs the latest one (always shown)
  const entries = session.entries;
  const olderEntries = entries.length > 1 ? entries.slice(0, -1) : [];
  const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  return (
    <>
      {/* Inject shimmer CSS once */}
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />

      <div className="bg-muted/20 border-b px-3 pt-2 pb-1.5 shrink-0">
        {/* Session history — timeline view */}
        {hasEntries && (
          <div className="mb-2 pl-0.5">
            {/* "Show more" for older entries */}
            {olderEntries.length > 0 && !historyExpanded && (
              <button
                onClick={() => setHistoryExpanded(true)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mb-1.5 transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
                {olderEntries.length} earlier {olderEntries.length === 1 ? "prompt" : "prompts"}
              </button>
            )}

            {/* Older entries (collapsed by default) */}
            {historyExpanded && olderEntries.length > 0 && (
              <div className="max-h-32 overflow-y-auto">
                {olderEntries.map((entry) => (
                  <TimelineEntry
                    key={entry.id}
                    entry={entry}
                    expanded={false}
                    isLast={false}
                  />
                ))}
              </div>
            )}
            {historyExpanded && olderEntries.length > 0 && (
              <button
                onClick={() => setHistoryExpanded(false)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mb-1 transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
                Show less
              </button>
            )}

            {/* Latest entry — always visible and expanded */}
            {latestEntry && (
              <TimelineEntry
                key={latestEntry.id}
                entry={latestEntry}
                expanded={true}
                isLast={true}
              />
            )}
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
                : "AI query generation requires a Pro plan"
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
              title="Generate query (Enter)"
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
