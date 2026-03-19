"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Database, Wifi, WifiOff, Loader2, Play, Clock, ChevronRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/layout/auth-gate";
import { queryTunnel, getTunnelStatus } from "@/lib/tunnel";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  command: string;
  result: string;
  error: boolean;
  ts: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return "(nil)";
  if (typeof result === "string") return result;
  if (typeof result === "number") return `(integer) ${result}`;
  return JSON.stringify(result, null, 2);
}

function parseCommand(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (const ch of raw) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; } else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true; quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) { parts.push(current); current = ""; }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ── Main Component ───────────────────────────────────────────────────────────

function RedisTunnelStudioInner({ token }: { token: string }) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<unknown>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Check tunnel connection
  useEffect(() => {
    (async () => {
      try {
        const status = await getTunnelStatus(token);
        setConnected(status.connected);
      } catch {
        setConnected(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const runCommand = useCallback(async () => {
    const raw = input.trim();
    if (!raw || running) return;
    const parts = parseCommand(raw);
    if (parts.length === 0) return;

    setRunning(true);
    setError(null);
    setResult(undefined);

    try {
      const res = await queryTunnel(token, { command: parts });
      const output = res.result !== undefined ? res.result : res;
      setResult(output);
      setHistory((prev) => [{
        command: raw,
        result: formatResult(output),
        error: false,
        ts: Date.now(),
      }, ...prev].slice(0, 50));
      setInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setHistory((prev) => [{
        command: raw,
        result: `(error) ${msg}`,
        error: true,
        ts: Date.now(),
      }, ...prev].slice(0, 50));
      setInput("");
    } finally {
      setRunning(false);
      setHistoryIndex(-1);
    }
  }, [input, running, token]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void runCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      if (history[next]) setInput(history[next].command);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setInput(next === -1 ? "" : (history[next]?.command ?? ""));
    }
  };

  // Scroll result into view
  useEffect(() => {
    resultRef.current?.scrollTo(0, 0);
  }, [result, error]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting to tunnel…
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <WifiOff className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium">Tunnel not connected</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Make sure the CLI is running with this tunnel token.
          </p>
        </div>
        <Link href="/account/databases" className="text-sm text-primary hover:underline underline-offset-2">
          Back to databases
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sidebar header */}
      <div className="px-3 py-2.5 border-b space-y-1.5 shrink-0">
        <Link
          href="/account/databases"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          All databases
        </Link>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold truncate flex-1 min-w-0">
            External Redis
          </span>
          <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" />
        </div>
        <p className="text-[10px] text-muted-foreground/60 truncate font-mono">
          tunnel:{token.slice(0, 12)}…
        </p>
      </div>

      {/* History (collapsed by default) */}
      {history.length > 0 && (
        <div className="shrink-0 flex flex-col overflow-hidden">
          <button
            className="px-3 py-1.5 bg-muted/20 border-b flex items-center gap-2 hover:bg-muted/30 transition-colors"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <ChevronRight className={cn("h-3 w-3 text-muted-foreground/50 transition-transform", historyOpen && "rotate-90")} />
            <Clock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">History</span>
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">{history.length}</span>
          </button>
          {historyOpen && (
            <div className="overflow-y-auto border-b" style={{ maxHeight: "180px" }}>
              {history.map((h) => (
                <div key={h.ts} className="border-b border-border/20 last:border-b-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/40 transition-colors text-left group cursor-pointer">
                    <span className="text-[11px] font-mono text-foreground truncate flex-1 min-w-0">{h.command}</span>
                    {h.error && <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />}
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                      onClick={() => { setInput(h.command); void runCommand(); }}
                      title="Re-run"
                    >
                      <RotateCw className="h-3 w-3 text-muted-foreground/50" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Command input */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
        <span className="text-xs font-mono text-muted-foreground shrink-0">{">"}</span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50"
          placeholder="Enter a Redis command (e.g. GET mykey, SCAN 0 MATCH user:*)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          spellCheck={false}
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void runCommand()} disabled={running || !input.trim()}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Result */}
      <div className="flex-1 overflow-y-auto" ref={resultRef}>
        {result === undefined && !error && !running ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
            Run a Redis command to see results
          </div>
        ) : error ? (
          <pre className="p-4 text-xs font-mono text-destructive whitespace-pre-wrap break-all">{error}</pre>
        ) : running ? (
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running...
          </div>
        ) : (
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all text-foreground">
            {formatResult(result)}
          </pre>
        )}
      </div>
    </div>
  );
}

export function RedisTunnelStudio({ token }: { token: string }) {
  return (
    <AuthGate>
      <RedisTunnelStudioInner token={token} />
    </AuthGate>
  );
}
