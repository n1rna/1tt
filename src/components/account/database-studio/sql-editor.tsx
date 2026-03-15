"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { sql, PostgreSQL, SQLite } from "@codemirror/lang-sql";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { useTheme } from "next-themes";
import { Play, Loader2, AlertTriangle, CheckCircle2, Sparkles, GripHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CellValue, QueryExecutor, SqlDialect, TableSchema, AiSession } from "./types";
import { AiQueryBar } from "./ai-query-bar";

interface LocalQueryResult {
  columns?: string[];
  rows?: string[][];
  rowCount?: number;
  rowsAffected?: number;
  error?: string;
  execMs?: number;
  results?: LocalStatementResult[];
}

interface LocalStatementResult {
  statement: string;
  columns?: string[];
  rows?: string[][];
  rowCount?: number;
  rowsAffected?: number;
  error?: string;
}

interface SqlEditorProps {
  queryExecutor: QueryExecutor;
  dialect?: SqlDialect;
  schema?: TableSchema[];
  aiEnabled?: boolean;
  initialValue?: string;
  onContentChange?: (content: string) => void;
  aiSession?: AiSession;
  onAiSessionChange?: (session: AiSession) => void;
}

function ResultsView({ result }: { result: LocalQueryResult | null }) {
  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Run a query to see results
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <pre className="font-mono text-xs break-all whitespace-pre-wrap">
            {result.error}
          </pre>
        </div>
      </div>
    );
  }

  if (result.rowsAffected !== undefined) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span>
          <span className="font-medium text-foreground">
            {result.rowsAffected}
          </span>{" "}
          row{result.rowsAffected === 1 ? "" : "s"} affected
          {result.execMs !== undefined && (
            <span className="ml-2 text-xs text-muted-foreground/60">
              ({result.execMs}ms)
            </span>
          )}
        </span>
      </div>
    );
  }

  const cols = result.columns ?? [];
  const dataRows = result.rows ?? [];

  if (cols.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Query returned no columns
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs font-mono min-w-max">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/50 border-b">
            {cols.map((c) => (
              <th
                key={c}
                className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap border-r border-border/30"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                "hover:bg-muted/30 border-b border-border/20",
                ri % 2 === 1 && "bg-muted/10"
              )}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1.5 border-r border-border/20 whitespace-nowrap max-w-xs"
                >
                  {(cell as CellValue) === null ? (
                    <span className="italic text-muted-foreground/50 text-[10px] bg-muted/40 px-1 rounded">
                      NULL
                    </span>
                  ) : (
                    <span className="truncate block" title={String(cell)}>
                      {String(cell)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {dataRows.length === 0 && (
            <tr>
              <td
                colSpan={cols.length}
                className="px-3 py-6 text-center text-muted-foreground"
              >
                No rows returned
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatementResultView({ result }: { result: LocalStatementResult }) {
  if (result.error) {
    return (
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <pre className="font-mono text-xs break-all whitespace-pre-wrap">
            {result.error}
          </pre>
        </div>
      </div>
    );
  }

  if (result.rowsAffected !== undefined && !result.columns) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span>
          <span className="font-medium text-foreground">
            {result.rowsAffected}
          </span>{" "}
          row{result.rowsAffected === 1 ? "" : "s"} affected
        </span>
      </div>
    );
  }

  const cols = result.columns ?? [];
  const dataRows = result.rows ?? [];

  if (cols.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Query returned no columns
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs font-mono min-w-max">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/50 border-b">
            {cols.map((c) => (
              <th
                key={c}
                className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap border-r border-border/30"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                "hover:bg-muted/30 border-b border-border/20",
                ri % 2 === 1 && "bg-muted/10"
              )}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1.5 border-r border-border/20 whitespace-nowrap max-w-xs"
                >
                  {(cell as CellValue) === null ? (
                    <span className="italic text-muted-foreground/50 text-[10px] bg-muted/40 px-1 rounded">
                      NULL
                    </span>
                  ) : (
                    <span className="truncate block" title={String(cell)}>
                      {String(cell)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {dataRows.length === 0 && (
            <tr>
              <td
                colSpan={cols.length}
                className="px-3 py-6 text-center text-muted-foreground"
              >
                No rows returned
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MultiResultsView({ results }: { results: LocalStatementResult[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = results[activeIdx];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b bg-muted/20 overflow-x-auto shrink-0">
        {results.map((r, i) => {
          const label = r.error
            ? `Error`
            : r.columns
              ? `${r.rowCount ?? 0} row${(r.rowCount ?? 0) === 1 ? "" : "s"}`
              : `${r.rowsAffected ?? 0} affected`;
          return (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={cn(
                "px-3 py-1.5 text-xs border-r border-border/30 whitespace-nowrap transition-colors",
                i === activeIdx
                  ? "bg-background text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                r.error && "text-red-500"
              )}
              title={r.statement}
            >
              <span className="text-muted-foreground/50 mr-1.5">
                {i + 1}.
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Statement preview */}
      <div className="px-3 py-1.5 border-b bg-muted/10 shrink-0">
        <pre className="text-[11px] font-mono text-muted-foreground truncate">
          {active?.statement}
        </pre>
      </div>

      {/* Result content */}
      {active && <StatementResultView result={active} />}
    </div>
  );
}

const DEFAULT_QUERY = "SELECT * FROM information_schema.tables\nWHERE table_schema = 'public'\nLIMIT 50;";

export function SqlEditor({ queryExecutor, dialect = "postgres", schema, aiEnabled = false, initialValue, onContentChange, aiSession, onAiSessionChange }: SqlEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [result, setResult] = useState<LocalQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastQuerySummary, setLastQuerySummary] = useState<string | undefined>();

  const runQuery = useCallback(async () => {
    const view = editorViewRef.current;
    if (!view || loading) return;
    const query = view.state.doc.toString().trim();
    if (!query) return;

    setLoading(true);
    setResult(null);
    const start = performance.now();

    try {
      const res = await queryExecutor(query);
      const execMs = Math.round(performance.now() - start);
      setResult({ ...res, execMs });
      // Build summary for AI context
      let summary: string | undefined;
      if (res.error) {
        summary = `Query error: ${res.error}`;
      } else if (res.results && res.results.length > 0) {
        summary = res.results
          .map((r, i) =>
            r.error
              ? `Statement ${i + 1}: error — ${r.error}`
              : r.columns
                ? `Statement ${i + 1}: ${r.rowCount ?? 0} rows`
                : `Statement ${i + 1}: ${r.rowsAffected ?? 0} rows affected`
          )
          .join("; ");
      } else if (res.columns && res.rows) {
        summary = `${res.rows.length} rows, columns: ${res.columns.join(", ")}`;
      } else if (res.rowsAffected !== undefined) {
        summary = `${res.rowsAffected} rows affected`;
      }
      setLastQuerySummary(summary);
    } catch (err) {
      const execMs = Math.round(performance.now() - start);
      const errMsg = err instanceof Error ? err.message : "Query failed";
      setResult({
        error: errMsg,
        execMs,
      });
      setLastQuerySummary(`Query error: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  }, [queryExecutor, loading]);

  const setEditorContent = useCallback((newSql: string) => {
    const view = editorViewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newSql },
    });
  }, []);

  // Keep runQuery ref stable for keymap
  const runQueryRef = useRef(runQuery);
  useEffect(() => {
    runQueryRef.current = runQuery;
  }, [runQuery]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const runKeybinding = keymap.of([
      {
        key: "Ctrl-Enter",
        mac: "Cmd-Enter",
        run: () => {
          runQueryRef.current();
          return true;
        },
      },
    ]);

    // Custom highlight styles that work on both light and dark backgrounds
    const darkHighlight = HighlightStyle.define([
      { tag: tags.keyword, color: "#c678dd" },
      { tag: tags.operatorKeyword, color: "#c678dd" },
      { tag: tags.modifier, color: "#c678dd" },
      { tag: tags.typeName, color: "#e5c07b" },
      { tag: tags.standard(tags.typeName), color: "#e5c07b" },
      { tag: tags.string, color: "#98c379" },
      { tag: tags.number, color: "#d19a66" },
      { tag: tags.bool, color: "#d19a66" },
      { tag: tags.null, color: "#d19a66", fontStyle: "italic" },
      { tag: tags.comment, color: "#7f848e", fontStyle: "italic" },
      { tag: tags.lineComment, color: "#7f848e", fontStyle: "italic" },
      { tag: tags.blockComment, color: "#7f848e", fontStyle: "italic" },
      { tag: tags.name, color: "#e06c75" },
      { tag: tags.variableName, color: "#e06c75" },
      { tag: tags.propertyName, color: "#61afef" },
      { tag: tags.punctuation, color: "#abb2bf" },
      { tag: tags.paren, color: "#abb2bf" },
      { tag: tags.squareBracket, color: "#abb2bf" },
      { tag: tags.brace, color: "#abb2bf" },
      { tag: tags.operator, color: "#56b6c2" },
      { tag: tags.special(tags.string), color: "#56b6c2" },
      { tag: tags.separator, color: "#abb2bf" },
    ]);

    const lightHighlight = HighlightStyle.define([
      { tag: tags.keyword, color: "#7c3aed" },
      { tag: tags.operatorKeyword, color: "#7c3aed" },
      { tag: tags.modifier, color: "#7c3aed" },
      { tag: tags.typeName, color: "#b45309" },
      { tag: tags.standard(tags.typeName), color: "#b45309" },
      { tag: tags.string, color: "#16a34a" },
      { tag: tags.number, color: "#c2410c" },
      { tag: tags.bool, color: "#c2410c" },
      { tag: tags.null, color: "#c2410c", fontStyle: "italic" },
      { tag: tags.comment, color: "#9ca3af", fontStyle: "italic" },
      { tag: tags.lineComment, color: "#9ca3af", fontStyle: "italic" },
      { tag: tags.blockComment, color: "#9ca3af", fontStyle: "italic" },
      { tag: tags.name, color: "#dc2626" },
      { tag: tags.variableName, color: "#dc2626" },
      { tag: tags.propertyName, color: "#2563eb" },
      { tag: tags.punctuation, color: "#6b7280" },
      { tag: tags.paren, color: "#6b7280" },
      { tag: tags.squareBracket, color: "#6b7280" },
      { tag: tags.brace, color: "#6b7280" },
      { tag: tags.operator, color: "#0891b2" },
      { tag: tags.special(tags.string), color: "#0891b2" },
      { tag: tags.separator, color: "#6b7280" },
    ]);

    const darkEditorTheme = EditorView.theme(
      {
        "&": {
          backgroundColor: "hsl(var(--muted) / 0.3)",
          color: "#abb2bf",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          color: "hsl(var(--muted-foreground) / 0.4)",
          border: "none",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "hsl(var(--muted) / 0.5)",
        },
        ".cm-activeLine": {
          backgroundColor: "hsl(var(--muted) / 0.3)",
        },
        ".cm-cursor": {
          borderLeftColor: "hsl(var(--foreground))",
        },
        ".cm-selectionBackground": {
          backgroundColor: "hsl(var(--primary) / 0.2) !important",
        },
        "&.cm-focused .cm-selectionBackground": {
          backgroundColor: "hsl(var(--primary) / 0.25) !important",
        },
        ".cm-matchingBracket": {
          backgroundColor: "hsl(var(--primary) / 0.3)",
          outline: "1px solid hsl(var(--primary) / 0.5)",
        },
      },
      { dark: true }
    );

    const lightEditorTheme = EditorView.theme(
      {
        "&": {
          backgroundColor: "hsl(var(--background))",
          color: "#383a42",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          color: "hsl(var(--muted-foreground) / 0.4)",
          border: "none",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "hsl(var(--muted) / 0.5)",
        },
        ".cm-activeLine": {
          backgroundColor: "hsl(var(--muted) / 0.3)",
        },
        ".cm-cursor": {
          borderLeftColor: "hsl(var(--foreground))",
        },
        ".cm-selectionBackground": {
          backgroundColor: "hsl(var(--primary) / 0.15) !important",
        },
        "&.cm-focused .cm-selectionBackground": {
          backgroundColor: "hsl(var(--primary) / 0.2) !important",
        },
        ".cm-matchingBracket": {
          backgroundColor: "hsl(var(--primary) / 0.2)",
          outline: "1px solid hsl(var(--primary) / 0.4)",
        },
      },
      { dark: false }
    );

    const extensions = [
      history(),
      sql({ dialect: dialect === "sqlite" ? SQLite : PostgreSQL }),
      autocompletion(),
      isDark
        ? syntaxHighlighting(darkHighlight)
        : syntaxHighlighting(lightHighlight),
      keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
      runKeybinding,
      EditorView.lineWrapping,
      EditorView.theme({
        "&": {
          minHeight: "150px",
          fontSize: "13px",
          fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
        },
        ".cm-content": { padding: "8px 0" },
        ".cm-scroller": { overflow: "auto" },
        ".cm-focused": { outline: "none" },
      }),
      isDark ? darkEditorTheme : lightEditorTheme,
    ];

    const state = EditorState.create({
      doc: initialValue ?? DEFAULT_QUERY,
      extensions,
    });

    const view = new EditorView({ state, parent: container });
    editorViewRef.current = view;

    return () => {
      onContentChange?.(view.state.doc.toString());
      view.destroy();
      editorViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, dialect]);

  const execMs = result?.execMs;
  const isMultiResult = result?.results && result.results.length > 0;
  const rowCount =
    !isMultiResult && result && !result.error && result.rows !== undefined
      ? result.rows.length
      : null;

  // ── Resizable panels + collapsible AI bar ─────────────────────────────────

  const [editorHeight, setEditorHeight] = useState(200);
  const [aiBarOpen, setAiBarOpen] = useState(true);
  const editorResizing = useRef(false);
  const resultsResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEditorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    editorResizing.current = true;
    const startY = e.clientY;
    const startH = editorHeight;

    const onMove = (ev: MouseEvent) => {
      if (!editorResizing.current) return;
      setEditorHeight(Math.max(80, Math.min(600, startH + (ev.clientY - startY))));
    };
    const onUp = () => {
      editorResizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [editorHeight]);

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {/* Editor — resizable */}
      <div
        className="border-b overflow-hidden shrink-0"
        style={{ height: `${editorHeight}px` }}
      >
        <div
          ref={editorContainerRef}
          className="h-full overflow-auto"
        />
      </div>

      {/* Resize handle: editor ↔ middle section */}
      <div
        onMouseDown={handleEditorResize}
        className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group"
        title="Drag to resize editor"
      >
        <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
      </div>

      {/* Run button bar + AI toggle */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/10 shrink-0">
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={runQuery}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {loading ? "Running…" : "Run Query"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
            ? "⌘"
            : "Ctrl"}
          +Enter
        </span>
        <div className="flex-1" />
        {execMs !== null && execMs !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">{execMs}ms</span>
        )}
        {isMultiResult && (
          <span className="text-xs text-muted-foreground">
            {result.results!.length} stmt{result.results!.length === 1 ? "" : "s"}
          </span>
        )}
        {rowCount !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {rowCount} row{rowCount === 1 ? "" : "s"}
          </span>
        )}

      </div>

      {/* AI assistant section — clickable header + collapsible content */}
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
        {aiSession && aiSession.entries.length > 0 && (
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
          <AiQueryBar
            schema={schema ?? []}
            dialect={dialect}
            onSqlGenerated={setEditorContent}
            aiEnabled={aiEnabled}
            aiSession={aiSession}
            onAiSessionChange={onAiSessionChange}
            getEditorContent={() => editorViewRef.current?.state.doc.toString() ?? ""}
            lastQuerySummary={lastQuerySummary}
          />
        </div>
      </div>

      {/* Results — fills remaining space */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {result?.results && result.results.length > 0 ? (
          <MultiResultsView results={result.results} />
        ) : (
          <ResultsView result={result} />
        )}
      </div>
    </div>
  );
}
