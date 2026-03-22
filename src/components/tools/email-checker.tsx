"use client";

import { useState, useRef, useCallback } from "react";
import {
  Search, Loader2, AlertCircle, CheckCircle2, AlertTriangle, XCircle, Info,
  Clock, X, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { Turnstile, type TurnstileRef } from "@/components/ui/turnstile";
import { useLookupHistory } from "@/lib/sync";
import { SyncToggle } from "@/components/ui/sync-toggle";
import { ToolLayout } from "@/components/layout/tool-layout";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailCheckResult {
  domain: string;
  score: number;
  checks: EmailCheck[];
  checkedAt: string;
  cached: boolean;
}

interface EmailCheck {
  name: string;
  status: "pass" | "warn" | "fail" | "info";
  title: string;
  details: string;
  data?: Record<string, unknown>;
}

// ── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size = 96;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? "text-green-500" :
    score >= 50 ? "text-amber-500" :
    "text-red-500";

  const bgColor =
    score >= 80 ? "stroke-green-500/15" :
    score >= 50 ? "stroke-amber-500/15" :
    "stroke-red-500/15";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={bgColor}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-700 ease-out`}
          style={{ stroke: "currentColor" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

// ── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: EmailCheck["status"] }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "fail":
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

// ── Check card ───────────────────────────────────────────────────────────────

function CheckCard({ check }: { check: EmailCheck }) {
  const [expanded, setExpanded] = useState(check.status === "fail" || check.status === "warn");

  const borderColor = {
    pass: "border-green-500/20",
    warn: "border-amber-500/20",
    fail: "border-red-500/20",
    info: "border-blue-500/10",
  }[check.status];

  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden bg-card`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <StatusIcon status={check.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
              {check.name}
            </span>
          </div>
          <p className="text-sm mt-0.5 truncate">{check.title}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-border">
          <p className="text-sm text-muted-foreground pt-3 leading-relaxed">
            {check.details}
          </p>
          {check.data && <CheckData data={check.data} name={check.name} />}
        </div>
      )}
    </div>
  );
}

// ── Check data display ───────────────────────────────────────────────────────

function CheckData({ data, name }: { data: Record<string, unknown>; name: string }) {
  if (name === "MX" && Array.isArray(data.records)) {
    const records = data.records as { host: string; priority: number; ips: string[] }[];
    if (records.length === 0) return null;
    return (
      <div className="rounded-md border overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Priority</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Host</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">IPs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((r) => (
              <tr key={r.host}>
                <td className="px-3 py-1.5 font-mono">{r.priority}</td>
                <td className="px-3 py-1.5 font-mono">{r.host}</td>
                <td className="px-3 py-1.5 font-mono">{r.ips?.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (name === "SPF" && typeof data.record === "string") {
    return (
      <pre className="text-xs font-mono bg-muted/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
        {data.record as string}
      </pre>
    );
  }

  if (name === "DKIM") {
    const found = (data.foundSelectors as string[]) || [];
    const tried = (data.triedSelectors as string[]) || [];
    return (
      <div className="space-y-1.5">
        {found.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {found.map((s) => (
              <span key={s} className="text-xs font-mono bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                {s}._domainkey
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Checked selectors: {tried.join(", ")}
        </p>
      </div>
    );
  }

  if (name === "DMARC" && typeof data.record === "string") {
    return (
      <div className="space-y-1.5">
        <pre className="text-xs font-mono bg-muted/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
          {data.record as string}
        </pre>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {data.policy && <span>Policy: <span className="font-mono font-medium text-foreground">{data.policy as string}</span></span>}
          {data.rua && <span>Reports: <span className="font-mono">{data.rua as string}</span></span>}
          {data.sp && <span>Subdomain: <span className="font-mono">{data.sp as string}</span></span>}
          {data.pct && <span>Pct: <span className="font-mono">{data.pct as string}%</span></span>}
        </div>
      </div>
    );
  }

  if (name === "Reverse DNS" && Array.isArray(data.results)) {
    const results = data.results as { ip: string; ptr: string[] }[];
    if (results.length === 0) return null;
    return (
      <div className="space-y-1">
        {results.map((r) => (
          <div key={r.ip} className="flex items-start gap-2 text-xs">
            <span className="font-mono text-muted-foreground shrink-0">{r.ip}</span>
            <span className="font-mono">
              {r.ptr?.length > 0 ? r.ptr.join(", ") : <span className="text-amber-500">no PTR</span>}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (name === "MTA-STS") {
    return (
      <div className="space-y-1.5">
        {data.dnsRecord && (
          <pre className="text-xs font-mono bg-muted/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
            {data.dnsRecord as string}
          </pre>
        )}
        {data.mode && (
          <p className="text-xs text-muted-foreground">
            Mode: <span className="font-mono font-medium text-foreground">{data.mode as string}</span>
          </p>
        )}
      </div>
    );
  }

  // Generic: show record if present
  if (typeof data.record === "string") {
    return (
      <pre className="text-xs font-mono bg-muted/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
        {data.record as string}
      </pre>
    );
  }

  return null;
}

// ── Results ──────────────────────────────────────────────────────────────────

function Results({ result }: { result: EmailCheckResult }) {
  const label =
    result.score >= 80 ? "Good" :
    result.score >= 50 ? "Needs improvement" :
    "Poor";

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="flex items-center gap-6 rounded-xl border bg-card p-5">
        <ScoreRing score={result.score} />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{result.domain}</h2>
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            {result.cached && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                cached
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Checked {new Date(result.checkedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {result.checks.map((check) => (
          <CheckCard key={check.name} check={check} />
        ))}
      </div>
    </div>
  );
}

// ── Time ago ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Main component ───────────────────────────────────────────────────────────

export function EmailChecker({ children }: { children?: React.ReactNode }) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailCheckResult | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);
  const lookupHistory = useLookupHistory();
  const emailEntries = lookupHistory.entriesForTool("email");

  const doCheck = useCallback(
    async (checkDomain: string, currentToken: string | null) => {
      const trimmed = checkDomain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setResult(null);
      setDomain(trimmed);

      try {
        if (!currentToken) {
          setError("Please complete the verification challenge first.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/proxy/email-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: trimmed, turnstileToken: currentToken }),
        });

        setToken(null);
        turnstileRef.current?.reset();

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Request failed (${res.status})`
          );
        }

        const data = (await res.json()) as EmailCheckResult;
        setResult(data);
        lookupHistory.addEntry("email", trimmed, data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
        setToken(null);
        turnstileRef.current?.reset();
      } finally {
        setLoading(false);
      }
    },
    [lookupHistory]
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      doCheck(domain, token);
    },
    [domain, token, doCheck]
  );

  return (
    <ToolLayout slug="email-checker" sync={<SyncToggle {...lookupHistory.syncToggleProps} />}>
    <div className="space-y-6">
      {/* Input */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !domain.trim()}
          className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Checking...
            </>
          ) : (
            "Check"
          )}
        </button>
      </form>

      {/* Turnstile */}
      {SITE_KEY && (
        <div className="flex justify-end">
          <Turnstile
            ref={turnstileRef}
            siteKey={SITE_KEY}
            size="flexible"
            onToken={setToken}
            onExpired={() => setToken(null)}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && <Results result={result} />}

      {/* Empty state */}
      {!result && !error && !loading && emailEntries.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Enter a domain to check its email configuration and deliverability.
        </div>
      )}

      {/* History */}
      {emailEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent lookups
            </h3>
          </div>
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {emailEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDomain(entry.query);
                    const cached = entry.result as EmailCheckResult | null;
                    if (cached) {
                      setResult(cached);
                      setError(null);
                    }
                  }}
                  className="flex-1 text-left min-w-0"
                >
                  <span className="text-sm font-mono truncate block">{entry.query}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDomain(entry.query);
                    doCheck(entry.query, token);
                  }}
                  disabled={loading || !token}
                  title="Re-check"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => lookupHistory.removeEntry(entry.id)}
                  title="Remove"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    {children}
    </ToolLayout>
  );
}
