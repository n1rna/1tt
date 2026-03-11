"use client";

import { useState, useRef, useCallback } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ImageOff,
  Info,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import { Turnstile, type TurnstileRef } from "@/components/ui/turnstile";
import { useLookupHistory } from "@/lib/sync";
import { SyncToggle } from "@/components/ui/sync-toggle";
import { ToolLayout } from "@/components/layout/tool-layout";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface OgImage {
  url: string;
  width?: string;
  height?: string;
  type?: string;
  alt?: string;
}

interface TwitterMeta {
  card?: string;
  title?: string;
  description?: string;
  image?: string;
  site?: string;
  creator?: string;
}

interface OgCheckResult {
  url: string;
  title?: string;
  description?: string;
  images: OgImage[];
  twitter?: TwitterMeta;
  favicon?: string;
  themeColor?: string;
  checkedAt: string;
  cached: boolean;
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
      title="Copy URL"
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
      <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm break-all">{value}</span>
    </div>
  );
}

function OgImageCard({ image }: { image: OgImage }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="bg-muted/40 flex items-center justify-center min-h-32 max-h-72 overflow-hidden">
        {imgError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">Image failed to load</span>
          </div>
        ) : (
          <img
            src={image.url}
            alt={image.alt ?? "OG image"}
            onError={() => setImgError(true)}
            className="w-full object-contain max-h-72"
          />
        )}
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-muted-foreground font-mono truncate flex-1">
            {image.url}
          </span>
          <CopyButton text={image.url} />
        </div>
        {(image.width || image.height || image.type || image.alt) && (
          <div className="flex flex-wrap gap-2">
            {image.width && image.height && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                {image.width} x {image.height}
              </span>
            )}
            {image.type && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                {image.type}
              </span>
            )}
            {image.alt && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-xs">
                alt: {image.alt}
              </span>
            )}
          </div>
        )}
      </div>
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

function Results({ result }: { result: OgCheckResult }) {
  const hasTwitter =
    result.twitter && Object.values(result.twitter).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {result.favicon && (
            <img
              src={result.favicon}
              alt="favicon"
              className="h-4 w-4 rounded-sm shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-sm font-mono text-muted-foreground truncate">
            {result.url}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result.cached && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              cached
            </span>
          )}
          {result.themeColor && (
            <span
              title={`Theme color: ${result.themeColor}`}
              className="h-4 w-4 rounded-full border border-border shrink-0"
              style={{ backgroundColor: result.themeColor }}
            />
          )}
        </div>
      </div>

      {/* Page info */}
      <div className="space-y-2">
        <SectionHeading>Page info</SectionHeading>
        <div className="rounded-lg border border-border overflow-hidden">
          <MetaRow
            label="Title"
            value={
              result.title ? (
                result.title
              ) : (
                <span className="text-muted-foreground italic">not set</span>
              )
            }
          />
          <MetaRow
            label="Description"
            value={
              result.description ? (
                result.description
              ) : (
                <span className="text-muted-foreground italic">not set</span>
              )
            }
          />
          {result.themeColor && (
            <MetaRow
              label="Theme color"
              value={
                <span className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-border inline-block shrink-0"
                    style={{ backgroundColor: result.themeColor }}
                  />
                  <span className="font-mono">{result.themeColor}</span>
                </span>
              }
            />
          )}
          {result.favicon && (
            <MetaRow
              label="Favicon"
              value={
                <span className="flex items-center gap-2">
                  <img
                    src={result.favicon}
                    alt="favicon"
                    className="h-4 w-4 rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="font-mono text-xs truncate">
                    {result.favicon}
                  </span>
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* OG Images */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionHeading>OG images</SectionHeading>
          <span className="text-xs text-muted-foreground">
            {result.images.length} found
          </span>
        </div>

        {result.images.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No <code className="font-mono text-xs">og:image</code> tags were
              found on this page. Social media platforms may use a generic
              preview or no image at all.
            </span>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {result.images.map((img, i) => (
              <OgImageCard key={i} image={img} />
            ))}
          </div>
        )}
      </div>

      {/* Twitter Card */}
      {hasTwitter && (
        <div className="space-y-2">
          <SectionHeading>Twitter / X card</SectionHeading>
          <div className="rounded-lg border border-border overflow-hidden">
            {result.twitter?.card && (
              <MetaRow label="Card type" value={<span className="font-mono">{result.twitter.card}</span>} />
            )}
            {result.twitter?.title && (
              <MetaRow label="Title" value={result.twitter.title} />
            )}
            {result.twitter?.description && (
              <MetaRow label="Description" value={result.twitter.description} />
            )}
            {result.twitter?.image && (
              <MetaRow
                label="Image"
                value={
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs truncate">
                      {result.twitter.image}
                    </span>
                    <CopyButton text={result.twitter.image} />
                  </span>
                }
              />
            )}
            {result.twitter?.site && (
              <MetaRow label="Site" value={<span className="font-mono">{result.twitter.site}</span>} />
            )}
            {result.twitter?.creator && (
              <MetaRow label="Creator" value={<span className="font-mono">{result.twitter.creator}</span>} />
            )}
          </div>
        </div>
      )}
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

export function OgChecker({ children }: { children?: React.ReactNode }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OgCheckResult | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);
  const lookupHistory = useLookupHistory();
  const ogEntries = lookupHistory.entriesForTool("og");

  const doCheck = useCallback(
    async (checkUrl: string, currentToken: string | null) => {
      const trimmed = checkUrl.trim();
      if (!trimmed) return;

      const normalized =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;

      setLoading(true);
      setError(null);
      setResult(null);
      setUrl(normalized);

      try {
        if (!currentToken) {
          setError("Please complete the verification challenge first.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/proxy/og-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalized, turnstileToken: currentToken }),
        });

        setToken(null);
        turnstileRef.current?.reset();

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Request failed (${res.status})`
          );
        }

        const data = (await res.json()) as OgCheckResult;
        setResult(data);
        lookupHistory.addEntry("og", normalized, data);
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
      doCheck(url, token);
    },
    [url, token, doCheck]
  );

  return (
    <ToolLayout slug="og-checker" toolbar={<SyncToggle {...lookupHistory.syncToggleProps} />}>
    <div className="space-y-6">
      {/* Input */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
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
      {!result && !error && !loading && ogEntries.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Enter a URL to inspect its Open Graph and meta tags.
        </div>
      )}

      {/* History */}
      {ogEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent lookups
            </h3>
          </div>
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {ogEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group"
              >
                <button
                  type="button"
                  onClick={() => {
                    setUrl(entry.query);
                    const cached = entry.result as OgCheckResult | null;
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
                    setUrl(entry.query);
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
