"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { generateAiSql, getAiSqlSuggestions } from "@/lib/ai-sql";
import type { TableSchema, SqlDialect } from "./types";
import type { SqlSuggestion } from "@/lib/ai-sql";

interface AiSqlBarProps {
  schema: TableSchema[];
  dialect: SqlDialect;
  onSqlGenerated: (sql: string) => void;
  aiEnabled: boolean;
}

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

export function AiSqlBar({ schema, dialect, onSqlGenerated, aiEnabled }: AiSqlBarProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SqlSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear error after 5 seconds
  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  }, []);

  // Load suggestions on mount (only if AI is enabled and schema has tables)
  useEffect(() => {
    if (!aiEnabled || schema.length === 0 || suggestionsLoaded) return;

    let cancelled = false;
    setSuggestionsLoading(true);

    getAiSqlSuggestions(schema, dialect).then((result) => {
      if (cancelled) return;
      setSuggestions(result);
      setSuggestionsLoaded(true);
      setSuggestionsLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setSuggestionsLoaded(true);
        setSuggestionsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiEnabled, dialect]);

  // Cleanup error timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading || !aiEnabled) return;

    setLoading(true);
    setError(null);

    const result = await generateAiSql(trimmed, schema, dialect);

    setLoading(false);

    if (result.error) {
      showError(result.error);
      return;
    }

    if (result.sql) {
      onSqlGenerated(result.sql);
      setPrompt("");
    }
  }, [prompt, loading, aiEnabled, schema, dialect, onSqlGenerated, showError]);

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

  const showSuggestions = aiEnabled && (suggestionsLoading || suggestions.length > 0);

  return (
    <div className="bg-muted/20 border-b px-3 pt-2 pb-1.5 shrink-0">
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
              ? "Describe what you need in plain English…"
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
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
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

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-destructive pl-8">{error}</p>
      )}

      {/* Suggestion chips */}
      {showSuggestions && (
        <div className="mt-1.5 pl-8">
          {suggestionsLoading ? (
            <SuggestionSkeletons />
          ) : (
            <div
              className={cn(
                "flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5",
                "animate-in fade-in duration-300"
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
          )}
        </div>
      )}
    </div>
  );
}
