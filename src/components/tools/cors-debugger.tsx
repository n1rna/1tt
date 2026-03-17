"use client";

import { useState, useCallback, useRef } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Turnstile, type TurnstileRef } from "@/components/ui/turnstile";
import { ToolLayout } from "@/components/layout/tool-layout";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CorsCheckResponse {
  url: string;
  origin: string;
  method: string;
  preflight: {
    status: number | null;
    headers: Record<string, string>;
    error: string | null;
  };
  actual: {
    status: number | null;
    headers: Record<string, string>;
    error: string | null;
  };
}

type HeaderStatus = "pass" | "fail" | "warn" | "info";

interface HeaderAnalysis {
  name: string;
  label: string;
  value: string | undefined;
  status: HeaderStatus;
  explanation: string;
}

// ─── Header analysis logic ────────────────────────────────────────────────────

function analyzeHeaders(
  headers: Record<string, string>,
  origin: string,
  isActual: boolean
): HeaderAnalysis[] {
  const results: HeaderAnalysis[] = [];

  // access-control-allow-origin
  const acao = headers["access-control-allow-origin"];
  if (acao) {
    const isWildcard = acao === "*";
    const matchesOrigin = acao === origin;
    const status: HeaderStatus =
      isWildcard || matchesOrigin ? "pass" : "fail";
    const explanation = isWildcard
      ? "This server allows requests from any origin."
      : matchesOrigin
      ? `This server explicitly allows requests from ${origin}.`
      : `This server only allows requests from "${acao}". Requests from "${origin}" will be blocked.`;
    results.push({
      name: "access-control-allow-origin",
      label: "Access-Control-Allow-Origin",
      value: acao,
      status,
      explanation,
    });
  } else {
    results.push({
      name: "access-control-allow-origin",
      label: "Access-Control-Allow-Origin",
      value: undefined,
      status: "fail",
      explanation:
        "This header is missing. The browser will block cross-origin requests to this URL.",
    });
  }

  // access-control-allow-methods (preflight only)
  if (!isActual) {
    const acam = headers["access-control-allow-methods"];
    if (acam) {
      results.push({
        name: "access-control-allow-methods",
        label: "Access-Control-Allow-Methods",
        value: acam,
        status: "pass",
        explanation: `This server allows the following HTTP methods cross-origin: ${acam}.`,
      });
    } else {
      results.push({
        name: "access-control-allow-methods",
        label: "Access-Control-Allow-Methods",
        value: undefined,
        status: "warn",
        explanation:
          "Not set in preflight response. The browser may only allow simple methods (GET, POST, HEAD).",
      });
    }
  }

  // access-control-allow-headers (preflight only)
  if (!isActual) {
    const acah = headers["access-control-allow-headers"];
    if (acah) {
      results.push({
        name: "access-control-allow-headers",
        label: "Access-Control-Allow-Headers",
        value: acah,
        status: "pass",
        explanation: `Custom request headers are allowed: ${acah}.`,
      });
    } else {
      results.push({
        name: "access-control-allow-headers",
        label: "Access-Control-Allow-Headers",
        value: undefined,
        status: "warn",
        explanation:
          "Not set. Requests with custom headers (e.g. Authorization, Content-Type) may be blocked.",
      });
    }
  }

  // access-control-allow-credentials
  const acac = headers["access-control-allow-credentials"];
  if (acac) {
    const isTrue = acac.toLowerCase() === "true";
    const acao2 = headers["access-control-allow-origin"];
    const wildcardWithCredentials = isTrue && acao2 === "*";
    results.push({
      name: "access-control-allow-credentials",
      label: "Access-Control-Allow-Credentials",
      value: acac,
      status: wildcardWithCredentials
        ? "fail"
        : isTrue
        ? "pass"
        : "info",
      explanation: wildcardWithCredentials
        ? 'Invalid combination: credentials cannot be used with Access-Control-Allow-Origin: "*". The browser will block credentialed requests.'
        : isTrue
        ? "The browser will expose the response to requests made with credentials (cookies, HTTP auth)."
        : 'Set to "false". Credentialed requests (cookies, HTTP auth) will not be forwarded.',
    });
  }

  // access-control-max-age (preflight only)
  if (!isActual) {
    const acma = headers["access-control-max-age"];
    if (acma) {
      const seconds = parseInt(acma, 10);
      results.push({
        name: "access-control-max-age",
        label: "Access-Control-Max-Age",
        value: acma,
        status: "pass",
        explanation: isNaN(seconds)
          ? "Preflight result is cached. Exact duration could not be parsed."
          : `Preflight result is cached for ${seconds} second${seconds !== 1 ? "s" : ""}, reducing extra OPTIONS requests.`,
      });
    }
  }

  // access-control-expose-headers (actual response only)
  if (isActual) {
    const aceh = headers["access-control-expose-headers"];
    if (aceh) {
      results.push({
        name: "access-control-expose-headers",
        label: "Access-Control-Expose-Headers",
        value: aceh,
        status: "info",
        explanation: `These response headers are exposed to browser JavaScript: ${aceh}.`,
      });
    }
  }

  // vary
  const vary = headers["vary"];
  if (vary) {
    const includesOrigin = vary.toLowerCase().includes("origin");
    results.push({
      name: "vary",
      label: "Vary",
      value: vary,
      status: includesOrigin ? "pass" : "info",
      explanation: includesOrigin
        ? 'The server varies its response based on the Origin header — correct for CORS-aware caching.'
        : `The Vary header is set to "${vary}" but does not include "Origin". Caches may serve incorrect CORS responses.`,
    });
  }

  return results;
}

function overallVerdict(
  preflightAnalysis: HeaderAnalysis[],
  actualAnalysis: HeaderAnalysis[]
): { label: string; status: HeaderStatus } {
  const allAnalysis = [...preflightAnalysis, ...actualAnalysis];
  const hasFail = allAnalysis.some((a) => a.status === "fail");
  const hasWarn = allAnalysis.some((a) => a.status === "warn");

  const acao = actualAnalysis.find(
    (a) => a.name === "access-control-allow-origin"
  );
  const corsEnabled = acao?.status === "pass";

  if (!corsEnabled || hasFail) {
    return { label: "CORS not configured or blocked", status: "fail" };
  }
  if (hasWarn) {
    return { label: "CORS partially configured", status: "warn" };
  }
  return { label: "CORS enabled", status: "pass" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HeaderStatus }) {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Pass
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
        <XCircle className="h-3 w-3" />
        Fail
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Warn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
      Info
    </span>
  );
}

function VerdictBanner({ status, label }: { status: HeaderStatus; label: string }) {
  if (status === "pass") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{label}</p>
          <p className="text-xs text-muted-foreground">Cross-origin requests from the simulated origin are permitted.</p>
        </div>
      </div>
    );
  }
  if (status === "warn") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{label}</p>
          <p className="text-xs text-muted-foreground">Some headers are missing or could cause issues with advanced requests.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
      <XCircle className="h-5 w-5 text-destructive shrink-0" />
      <div>
        <p className="text-sm font-semibold text-destructive">{label}</p>
        <p className="text-xs text-muted-foreground">The browser will block cross-origin requests to this URL.</p>
      </div>
    </div>
  );
}

function HeaderRow({ analysis }: { analysis: HeaderAnalysis }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <StatusBadge status={analysis.status} />
        <span className="text-sm font-mono flex-1 min-w-0 truncate">
          {analysis.label}
        </span>
        {analysis.value !== undefined ? (
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] hidden sm:block">
            {analysis.value}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground hidden sm:block">not set</span>
        )}
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          {analysis.value !== undefined && (
            <div className="font-mono text-xs bg-muted px-3 py-2 rounded-md break-all text-foreground">
              {analysis.value}
            </div>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {analysis.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

function HeaderSection({
  title,
  status,
  analysis,
  requestError,
}: {
  title: string;
  status: number | null;
  analysis: HeaderAnalysis[];
  requestError: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        {status !== null && (
          <span className="text-xs font-mono text-muted-foreground">
            HTTP {status}
          </span>
        )}
      </div>
      {requestError ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{requestError}</span>
        </div>
      ) : analysis.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No CORS headers present in this response.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {analysis.map((a) => (
            <HeaderRow key={a.name} analysis={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CorsDebugger({ children }: { children?: React.ReactNode }) {
  const [url, setUrl] = useState("");
  const [origin, setOrigin] = useState("https://example.com");
  const [method, setMethod] = useState("GET");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CorsCheckResponse | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);

  const handleCheck = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/cors-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: trimmed,
            origin: origin.trim() || "https://example.com",
            method: method || "GET",
            turnstileToken: token,
          }),
        });

        setToken(null);
        turnstileRef.current?.reset();

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Request failed (${res.status})`
          );
        }

        const data = (await res.json()) as CorsCheckResponse;
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        setToken(null);
        turnstileRef.current?.reset();
      } finally {
        setLoading(false);
      }
    },
    [url, origin, method, token]
  );

  const preflightAnalysis = result
    ? analyzeHeaders(result.preflight.headers, result.origin, false)
    : [];
  const actualAnalysis = result
    ? analyzeHeaders(result.actual.headers, result.origin, true)
    : [];
  const verdict =
    result && !result.actual.error
      ? overallVerdict(preflightAnalysis, actualAnalysis)
      : null;

  return (
    <ToolLayout slug="cors">
      <div className="space-y-6">
        {/* Input form */}
        <form onSubmit={handleCheck} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim() || (!token && !!SITE_KEY)}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check"
              )}
            </button>
          </div>

          {/* Advanced options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Advanced options
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Simulate origin
                </label>
                <input
                  type="url"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="https://example.com"
                  spellCheck={false}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Request method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
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

        {/* Request-level error */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* Simulated origin pill */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Simulating origin:</span>
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                {result.origin}
              </code>
              <span className="text-muted-foreground/50">&middot;</span>
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                {result.method}
              </code>
            </div>

            {/* Overall verdict */}
            {verdict && (
              <VerdictBanner status={verdict.status} label={verdict.label} />
            )}

            {/* Preflight (OPTIONS) */}
            <HeaderSection
              title="Preflight (OPTIONS) response"
              status={result.preflight.status}
              analysis={preflightAnalysis}
              requestError={result.preflight.error}
            />

            {/* Actual (GET) */}
            <HeaderSection
              title="Actual (GET) response"
              status={result.actual.status}
              analysis={actualAnalysis}
              requestError={result.actual.error}
            />
          </div>
        )}

        {/* Empty state */}
        {!result && !error && !loading && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Enter a URL to inspect its CORS headers.
          </div>
        )}
      </div>
      {children}
    </ToolLayout>
  );
}
