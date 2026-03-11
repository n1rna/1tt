"use client";

import { useState, useRef, useCallback } from "react";
import { Search, Loader2, AlertCircle, Copy, Check, ShieldCheck, ShieldAlert, ShieldX, Info, Clock, X, RefreshCw } from "lucide-react";
import { Turnstile, type TurnstileRef } from "@/components/ui/turnstile";
import { useLookupHistory } from "@/lib/sync";
import { SyncToggle } from "@/components/ui/sync-toggle";
import { ToolLayout } from "@/components/layout/tool-layout";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface SslCertificate {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  dnsNames: string[];
  isCA: boolean;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  fingerprint: string;
}

interface SslCheckResult {
  domain: string;
  certificates: SslCertificate[];
  protocol: string;
  cipher: string;
  checkedAt: string;
  cached: boolean;
  error?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy"
      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors shrink-0"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-4 py-2.5 border-b border-border last:border-0 odd:bg-muted/30">
      <span className="text-xs font-medium text-muted-foreground w-36 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm break-all">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {children}
    </h3>
  );
}

function certStatus(notAfter: string): "valid" | "expiring" | "expired" {
  const expiry = new Date(notAfter);
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (expiry < now) return "expired";
  if (expiry.getTime() - now.getTime() < thirtyDays) return "expiring";
  return "valid";
}

function ValidityBadge({ notBefore, notAfter }: { notBefore: string; notAfter: string }) {
  const status = certStatus(notAfter);
  const from = new Date(notBefore).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const until = new Date(notAfter).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const statusStyles = {
    valid: "text-green-600 dark:text-green-400",
    expiring: "text-amber-600 dark:text-amber-400",
    expired: "text-destructive",
  };

  const Icon = status === "valid" ? ShieldCheck : status === "expiring" ? ShieldAlert : ShieldX;

  return (
    <div className="flex items-start gap-4 px-4 py-2.5 border-b border-border last:border-0 odd:bg-muted/30">
      <span className="text-xs font-medium text-muted-foreground w-36 shrink-0 pt-0.5">
        Validity
      </span>
      <span className="text-sm flex items-center gap-2 flex-wrap">
        <span className={`flex items-center gap-1 font-medium ${statusStyles[status]}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {status === "valid" ? "Valid" : status === "expiring" ? "Expiring soon" : "Expired"}
        </span>
        <span className="text-muted-foreground font-mono text-xs">
          {from} &mdash; {until}
        </span>
      </span>
    </div>
  );
}

function CertCard({ cert, index, total }: { cert: SslCertificate; index: number; total: number }) {
  const label =
    index === 0
      ? "Leaf certificate"
      : index === total - 1
      ? "Root CA"
      : `Intermediate CA ${index}`;

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {cert.isCA && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            CA
          </span>
        )}
      </div>

      <MetaRow label="Subject (CN)" value={<span className="font-mono">{cert.subject}</span>} />
      <MetaRow label="Issuer" value={<span className="font-mono">{cert.issuer}</span>} />
      <ValidityBadge notBefore={cert.notBefore} notAfter={cert.notAfter} />

      {cert.dnsNames && cert.dnsNames.length > 0 && (
        <div className="flex items-start gap-4 px-4 py-2.5 border-b border-border odd:bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground w-36 shrink-0 pt-0.5">
            DNS names
          </span>
          <div className="flex flex-wrap gap-1.5">
            {cert.dnsNames.map((name) => (
              <span
                key={name}
                className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <MetaRow
        label="Signature alg."
        value={<span className="font-mono">{cert.signatureAlgorithm}</span>}
      />
      <MetaRow
        label="Public key alg."
        value={<span className="font-mono">{cert.publicKeyAlgorithm}</span>}
      />
      <MetaRow
        label="Serial number"
        value={<span className="font-mono text-xs break-all">{cert.serialNumber}</span>}
      />
      <div className="flex items-start gap-4 px-4 py-2.5 border-b border-border last:border-0 odd:bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground w-36 shrink-0 pt-0.5">
          SHA-256 fingerprint
        </span>
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs font-mono text-muted-foreground truncate">
            {cert.fingerprint}
          </span>
          <CopyButton text={cert.fingerprint} />
        </span>
      </div>
    </div>
  );
}

function Results({ result }: { result: SslCheckResult }) {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-mono text-muted-foreground truncate">
          {result.domain}
        </span>
        {result.cached && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0">
            cached
          </span>
        )}
      </div>

      {/* Verification warning */}
      {result.error && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </div>
      )}

      {/* Connection info */}
      <div className="space-y-2">
        <SectionHeading>Connection</SectionHeading>
        <div className="rounded-lg border border-border overflow-hidden">
          <MetaRow label="Protocol" value={<span className="font-mono">{result.protocol}</span>} />
          <MetaRow label="Cipher suite" value={<span className="font-mono text-xs break-all">{result.cipher}</span>} />
        </div>
      </div>

      {/* Certificate chain */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionHeading>Certificate chain</SectionHeading>
          <span className="text-xs text-muted-foreground">
            {result.certificates.length} certificate{result.certificates.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-3">
          {result.certificates.map((cert, i) => (
            <CertCard
              key={cert.fingerprint || i}
              cert={cert}
              index={i}
              total={result.certificates.length}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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

export function SslChecker({ children }: { children?: React.ReactNode }) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SslCheckResult | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);
  const lookupHistory = useLookupHistory();
  const sslEntries = lookupHistory.entriesForTool("ssl");

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

        const res = await fetch("/api/proxy/ssl-check", {
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

        const data = (await res.json()) as SslCheckResult;
        setResult(data);
        lookupHistory.addEntry("ssl", trimmed, data);
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
    <ToolLayout slug="ssl-checker" toolbar={<SyncToggle {...lookupHistory.syncToggleProps} />}>
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
      {!result && !error && !loading && sslEntries.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Enter a domain to check its SSL certificate.
        </div>
      )}

      {/* History */}
      {sslEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent lookups
            </h3>
          </div>
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {sslEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDomain(entry.query);
                    const cached = entry.result as SslCheckResult | null;
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
