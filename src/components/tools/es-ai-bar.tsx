"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { generateEsAiQuery, getEsAiSuggestions } from "@/lib/ai-sql";
import type { SqlSuggestion } from "@/lib/ai-sql";

// ─── Shimmer CSS ──────────────────────────────────────────────────────────────

const SHIMMER_CSS = `
@keyframes es-ai-shimmer-sweep {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
.es-ai-shimmer {
  position: relative;
  overflow: hidden;
}
.es-ai-shimmer::after {
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
  animation: es-ai-shimmer-sweep 2.4s ease-in-out infinite;
  pointer-events: none;
}
`;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EsAiBarProps {
  /** Field names from the current index mapping. */
  mappingFields: string[];
  selectedIndex: string;
  onQueryGenerated: (json: string) => void;
  aiEnabled: boolean;
  /** Optional: current editor JSON content for richer context. */
  getEditorContent?: () => string;
  /** Optional: summary of the last query result. */
  lastQuerySummary?: string;
}

// ─── Skeleton chips ───────────────────────────────────────────────────────────

function SuggestionSkeletons() {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {[80, 100, 88, 72].map((w, i) => (
        <div
          key={i}
          className="shrink-0 h-6 rounded-full bg-muted/50 animate-pulse"
          style={{ width: `${w}px` }}
        />
      ))}
    </div>
  );
}

// ─── EsAiBar ──────────────────────────────────────────────────────────────────

export function EsAiBar({
  mappingFields,
  selectedIndex,
  onQueryGenerated,
  aiEnabled,
  getEditorContent,
  lastQuerySummary,
}: EsAiBarProps) {
  const [open, setOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<SqlSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load suggestions when fields are available
  useEffect(() => {
    if (!aiEnabled || suggestionsLoaded) return;
    let cancelled = false;
    setSuggestionsLoading(true);
    getEsAiSuggestions(mappingFields)
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
  }, [aiEnabled]);

  // Reload suggestions when fields change (new index selected)
  const prevIndexRef = useRef(selectedIndex);
  useEffect(() => {
    if (prevIndexRef.current === selectedIndex) return;
    prevIndexRef.current = selectedIndex;
    if (!aiEnabled) return;
    setSuggestionsLoaded(false);
    setSuggestions([]);
    setSuggestionsLoading(true);
    getEsAiSuggestions(mappingFields)
      .then((result) => {
        setSuggestions(result);
        setSuggestionsLoading(false);
        setSuggestionsLoaded(true);
      })
      .catch(() => {
        setSuggestionsLoading(false);
        setSuggestionsLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, aiEnabled]);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading || !aiEnabled) return;

    setLoading(true);
    setError(null);
    setLastGenerated(null);

    // Optionally pass editor context
    let fullPrompt = trimmed;
    const editorContent = getEditorContent?.()?.trim();
    if (editorContent) {
      fullPrompt += `\n\nCurrent query in editor:\n${editorContent}`;
    }
    if (lastQuerySummary) {
      fullPrompt += `\n\nLast query result: ${lastQuerySummary}`;
    }

    const result = await generateEsAiQuery(fullPrompt, mappingFields, selectedIndex);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const json = result.sql.trim();
    if (json) {
      setLastGenerated(json);
      onQueryGenerated(json);
      setPrompt("");
    }
    setLoading(false);
  }, [prompt, loading, aiEnabled, mappingFields, selectedIndex, getEditorContent, lastQuerySummary, onQueryGenerated]);

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
      onQueryGenerated(chip.sql);
    },
    [onQueryGenerated]
  );

  const showSuggestions = aiEnabled && (suggestionsLoading || suggestions.length > 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />

      <div className="bg-muted/20 border-b shrink-0">
        {/* Header toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 shrink-0">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">AI Assistant</span>
          <div className="flex-1" />
          {open ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
          )}
        </button>

        {/* Collapsible body */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="px-3 pb-2 pt-1 space-y-1.5">
              {/* Last generated badge */}
              {lastGenerated && (
                <div className="flex items-center gap-1.5 text-[11px] text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3 shrink-0" />
                  <span className="truncate">Query applied to editor</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-1.5 text-[11px] text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="break-words">{error}</span>
                </div>
              )}

              {/* Input row */}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading || !aiEnabled}
                  placeholder={
                    aiEnabled
                      ? "Describe the query you need…"
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

              {/* Suggestion chips */}
              {showSuggestions && (
                <div>
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
          </div>
        </div>
      </div>
    </>
  );
}
