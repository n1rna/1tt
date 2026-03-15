"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Globe,
  Database,
  SlidersHorizontal,
  Loader2,
  Check,
  Copy,
  Sparkles,
  FileText,
  LogIn,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Mail,
  Circle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { SignInDialog } from "@/components/layout/sign-in-dialog";
import { cn } from "@/lib/utils";
import {
  isValidUrl,
  timeAgo,
  type ScanDepth,
  type DetailLevel,
  type JobStatus,
  type CacheInfo,
  type JobResponse,
} from "@/lib/tools/llms-shared";

// ─── CopyButton (unchanged — used by job detail page) ────────────────────────

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
        "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── ProgressView (unchanged — used by job detail page) ──────────────────────

type ProgressStage = 1 | 2 | 3;

const STAGES: { label: string; icon: React.ReactNode }[] = [
  { label: "Crawling website", icon: <Globe className="h-4 w-4" /> },
  { label: "Analyzing content with AI", icon: <Sparkles className="h-4 w-4" /> },
  { label: "Generating llms.txt", icon: <FileText className="h-4 w-4" /> },
];

function jobStatusToStage(status: JobStatus): ProgressStage {
  if (status === "pending" || status === "crawling") return 1;
  if (status === "processing") return 2;
  return 3;
}

export function ProgressView({
  url,
  status,
  pagesCrawled,
}: {
  url: string;
  status: JobStatus;
  pagesCrawled: number;
}) {
  const stage = jobStatusToStage(status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 w-fit max-w-full overflow-hidden">
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{url}</span>
      </div>

      <div className="space-y-3">
        {STAGES.map((s, i) => {
          const idx = (i + 1) as ProgressStage;
          const isActive = stage === idx;
          const isDone = stage > idx;
          const isPending = stage < idx;

          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300",
                isActive
                  ? "border-primary/30 bg-primary/5"
                  : isDone
                  ? "border-green-500/20 bg-green-500/5"
                  : "border-border/50 opacity-40"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : isDone
                    ? "bg-green-500/15 text-green-500"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  s.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", isPending && "text-muted-foreground")}>
                  {s.label}
                  {isActive && idx === 1 && pagesCrawled > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {pagesCrawled} pages found
                    </span>
                  )}
                </p>
              </div>
              {isActive && !isDone && (
                <div className="flex gap-0.5 shrink-0">
                  {[0, 1, 2].map((dot) => (
                    <div
                      key={dot}
                      className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse"
                      style={{ animationDelay: `${dot * 200}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can close this page. Check back later or find this job in your history.
      </p>
    </div>
  );
}

// ─── ReasoningStep ────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "active" | "done";

export interface ReasoningStepProps {
  icon: LucideIcon;
  title: string;
  status: StepStatus;
  duration?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function ReasoningStep({
  icon: Icon,
  title,
  status,
  duration,
  defaultOpen,
  children,
}: ReasoningStepProps) {
  const [open, setOpen] = useState(defaultOpen ?? status === "active");

  // Auto-expand when active, auto-collapse when done (unless defaultOpen keeps it open)
  useEffect(() => {
    if (status === "active") setOpen(true);
    if (status === "done" && !defaultOpen) {
      const t = setTimeout(() => setOpen(false), 600);
      return () => clearTimeout(t);
    }
  }, [status, defaultOpen]);

  const isPending = status === "pending";
  const isActive = status === "active";
  const isDone = status === "done";

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300 overflow-hidden",
        isPending && "border-border/40 opacity-40",
        isActive && "border-primary/40 step-active",
        isDone && "border-border/60"
      )}
      style={
        isActive
          ? {
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent)",
            }
          : undefined
      }
    >
      {/* Header row */}
      <button
        onClick={() => !isPending && setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
          !isPending && "hover:bg-muted/30",
          isActive && "shimmer-row"
        )}
      >
        {/* Status indicator */}
        <div
          className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full shrink-0 transition-colors",
            isPending && "bg-muted text-muted-foreground/50",
            isActive && "bg-primary/15 text-primary",
            isDone && "bg-green-500/15 text-green-500"
          )}
        >
          {isDone ? (
            <Check className="h-3.5 w-3.5" />
          ) : isActive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Circle className="h-3 w-3" />
          )}
        </div>

        {/* Icon + title */}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isPending && "text-muted-foreground/40",
            isActive && "text-primary",
            isDone && "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "flex-1 text-sm font-medium",
            isPending && "text-muted-foreground/50",
            isActive && "text-foreground",
            isDone && "text-muted-foreground"
          )}
        >
          {title}
        </span>

        {/* Duration badge */}
        {isDone && duration !== undefined && (
          <span className="text-[11px] text-muted-foreground/70 font-mono tabular-nums shrink-0">
            {(duration / 1000).toFixed(1)}s
          </span>
        )}

        {/* Chevron */}
        {!isPending && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Collapsible content — CSS grid trick for smooth height */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Shimmer + pulse CSS (injected once) ─────────────────────────────────────

const SHIMMER_CSS = `
@keyframes shimmer-sweep {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
.shimmer-row {
  position: relative;
  overflow: hidden;
}
.shimmer-row::after {
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
  animation: shimmer-sweep 2.4s ease-in-out infinite;
  pointer-events: none;
}
`;

export function ShimmerStyles() {
  return <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />;
}

// ─── Domain parse helper ──────────────────────────────────────────────────────

function parseDomain(url: string): { host: string; isGithub: boolean } {
  try {
    const u = new URL(url);
    return {
      host: u.hostname.replace(/^www\./, ""),
      isGithub: u.hostname.includes("github.com"),
    };
  } catch {
    return { host: url, isGithub: false };
  }
}

// ─── Crawl scope cards ────────────────────────────────────────────────────────

interface ScopeOption {
  id: string;
  label: string;
  pages: number;
  depth: ScanDepth;
  sub: string;
  rec?: boolean;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  { id: "quick",    label: "Quick",    pages: 10,  depth: 1, sub: "10 pages · 1 level" },
  { id: "standard", label: "Standard", pages: 50,  depth: 3, sub: "50 pages · 3 levels", rec: true },
  { id: "thorough", label: "Thorough", pages: 200, depth: 5, sub: "200 pages · 5 levels" },
];

// ─── Detail level pills ───────────────────────────────────────────────────────

const DETAIL_OPTIONS: { value: DetailLevel; label: string }[] = [
  { value: "overview",  label: "Overview" },
  { value: "standard",  label: "Standard" },
  { value: "detailed",  label: "Detailed" },
];

// ─── Main component ───────────────────────────────────────────────────────────

type AgentPhase =
  | "idle"           // waiting for valid URL
  | "url-active"     // URL is valid, step 1 running
  | "cache-active"   // Step 1 done, checking cache
  | "configure"      // Both done, showing config
  | "generating";    // Submitting

export function LlmsTxtGenerator() {
  const { data: session } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const router = useRouter();

  // URL
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  // Agent phase
  const [phase, setPhase] = useState<AgentPhase>("idle");

  // Durations (ms)
  const [urlDuration, setUrlDuration] = useState<number | undefined>();
  const [cacheDuration, setCacheDuration] = useState<number | undefined>();

  // Cache
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [useCached, setUseCached] = useState<boolean | null>(null);

  // Config
  const [scope, setScope] = useState<string>("standard");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fileName, setFileName] = useState("llms");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [customMaxPages, setCustomMaxPages] = useState("");
  const [customDepth, setCustomDepth] = useState("");

  // Generate
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlTimerRef = useRef<number>(0);
  const cacheTimerRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll anchor
  useEffect(() => {
    const t = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 400);
    return () => clearTimeout(t);
  }, [phase, advancedOpen]);

  // ── Step runners ──────────────────────────────────────────────────────────

  const runUrlStep = useCallback(async (rawUrl: string) => {
    setPhase("url-active");
    urlTimerRef.current = performance.now();

    // Simulate a brief analysis (URL parse is instant; give it a beat to feel real)
    await new Promise<void>((res) => setTimeout(res, 350));

    setUrlDuration(Math.round(performance.now() - urlTimerRef.current));
    setPhase("cache-active");
    cacheTimerRef.current = performance.now();

    // Real cache API call
    try {
      const params = new URLSearchParams({ url: rawUrl, depth: "3" });
      const res = await fetch(`/api/proxy/llms/cache?${params}`, { credentials: "include" });
      if (res.ok) {
        const data: CacheInfo = await res.json();
        setCacheInfo(data);
        // If there's a cache hit, default to using it
        if (data.cached) setUseCached(true);
      }
    } catch {
      // silently ignore
    }

    setCacheDuration(Math.round(performance.now() - cacheTimerRef.current));
    setPhase("configure");
  }, []);

  // Debounced URL validation — trigger agent when URL becomes valid
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!url) {
      setUrlError(null);
      setCacheInfo(null);
      setPhase("idle");
      return;
    }

    if (!isValidUrl(url)) {
      setUrlError("Enter a valid URL starting with http:// or https://");
      setCacheInfo(null);
      setPhase("idle");
      return;
    }

    // Valid URL — reset state and debounce the run
    setUrlError(null);
    if (phase === "idle" || phase === "url-active" || phase === "cache-active") {
      debounceRef.current = setTimeout(() => {
        if (!session) {
          // Show sign-in immediately, but don't run agent steps yet
          return;
        }
        setPhase("idle");
        setUrlDuration(undefined);
        setCacheDuration(undefined);
        setCacheInfo(null);
        setUseCached(null);
        setGenerateError(null);
        runUrlStep(url);
      }, 600);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, session]);

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!session) { setSignInOpen(true); return; }

    setGenerating(true);
    setGenerateError(null);
    setPhase("generating");

    const selectedScope = SCOPE_OPTIONS.find((s) => s.id === scope) ?? SCOPE_OPTIONS[1];
    const maxPages = customMaxPages ? parseInt(customMaxPages, 10) : selectedScope.pages;
    const scanDepth: ScanDepth = customDepth
      ? (parseInt(customDepth, 10) as ScanDepth)
      : selectedScope.depth;

    try {
      const res = await fetch("/api/proxy/llms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url,
          scanDepth,
          maxPages,
          detailLevel,
          fileName: `${fileName.trim() || "llms"}.txt`,
          ...(notifyEmail.trim() ? { notifyEmail: notifyEmail.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data: JobResponse = await res.json();
      router.push(`/tools/llms-txt/${data.id}`);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to start generation");
      setGenerating(false);
      setPhase("configure");
    }
  }, [session, url, scope, customMaxPages, customDepth, detailLevel, fileName, notifyEmail, router]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const urlValid = isValidUrl(url);
  const { host, isGithub } = urlValid ? parseDomain(url) : { host: "", isGithub: false };
  const hasCacheHit = cacheInfo?.cached === true;

  const step1Status: StepStatus =
    phase === "idle" ? "pending" :
    phase === "url-active" ? "active" :
    "done";

  const step2Status: StepStatus =
    phase === "idle" || phase === "url-active" ? "pending" :
    phase === "cache-active" ? "active" :
    "done";

  const step3Status: StepStatus =
    phase === "configure" || phase === "generating" ? "done" : "pending";
  // Step 3 is "configure" — it stays active/open while in "configure" phase
  const configStatus: StepStatus =
    phase === "idle" || phase === "url-active" || phase === "cache-active" ? "pending" :
    phase === "generating" ? "done" :
    "active";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <ShimmerStyles />
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

      {/* ── Auth nudge ── */}
      {!session && (
        <button
          onClick={() => setSignInOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/50 hover:bg-accent/50 transition-colors text-left"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 shrink-0">
            <LogIn className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sign in to generate llms.txt files</p>
            <p className="text-xs text-muted-foreground">
              Create a free account to crawl sites and generate AI context files.
            </p>
          </div>
        </button>
      )}

      {/* ── URL input ── */}
      <div className="space-y-2">
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Globe className="h-4 w-4" />
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.example.com"
            disabled={phase === "url-active" || phase === "cache-active" || phase === "generating"}
            className={cn(
              "w-full pl-10 pr-10 py-3 rounded-xl border bg-card text-sm outline-none transition-colors",
              "placeholder:text-muted-foreground/50",
              "focus:ring-1 focus:ring-ring",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              urlError ? "border-destructive" : urlValid ? "border-primary/40" : "border-border"
            )}
          />
          {/* Right indicator */}
          {(phase === "url-active" || phase === "cache-active") && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          {urlValid && phase === "idle" && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Check className="h-3.5 w-3.5 text-green-500" />
            </div>
          )}
        </div>

        {urlError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {urlError}
          </p>
        )}
      </div>

      {/* ── Step 1: Analyzing URL ── */}
      {phase !== "idle" && (
        <ReasoningStep
          icon={Globe}
          title="Analyzing URL"
          status={step1Status}
          duration={urlDuration}
        >
          {step1Status === "active" ? (
            <p className="text-xs text-muted-foreground">
              Checking{" "}
              <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">{url}</code>
              …
            </p>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-500 shrink-0" />
              <span>
                Parsed:{" "}
                <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded text-foreground">
                  {host}
                </code>{" "}
                &mdash; {isGithub ? "GitHub repository" : "website"}
              </span>
            </div>
          )}
        </ReasoningStep>
      )}

      {/* ── Step 2: Checking cache ── */}
      {(phase === "cache-active" || phase === "configure" || phase === "generating") && (
        <ReasoningStep
          icon={Database}
          title="Checking cache"
          status={step2Status}
          duration={cacheDuration}
        >
          {step2Status === "active" ? (
            <p className="text-xs text-muted-foreground">Looking for cached crawl data…</p>
          ) : hasCacheHit && cacheInfo ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-green-500 shrink-0" />
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Cache hit
                </span>
                <span className="text-muted-foreground">
                  —{cacheInfo.pagesCount ? ` ${cacheInfo.pagesCount} pages` : ""}{" "}
                  {cacheInfo.cachedAt ? `from ${timeAgo(cacheInfo.cachedAt)}` : ""}
                </span>
              </div>

              {/* Use cached / crawl fresh toggle */}
              {phase !== "generating" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setUseCached(true)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      useCached === true
                        ? "border-primary/50 bg-primary/8 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground hover:bg-accent/50"
                    )}
                  >
                    {useCached === true && <Check className="h-3 w-3" />}
                    Use cached data
                  </button>
                  <button
                    onClick={() => setUseCached(false)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      useCached === false
                        ? "border-primary/50 bg-primary/8 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground hover:bg-accent/50"
                    )}
                  >
                    {useCached === false && <Check className="h-3 w-3" />}
                    Crawl fresh
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Circle className="h-3 w-3 shrink-0" />
              <span>No cached data found — will crawl fresh</span>
            </div>
          )}
        </ReasoningStep>
      )}

      {/* ── Step 3: Configure generation ── */}
      {(phase === "configure" || phase === "generating") && (
        <ReasoningStep
          icon={SlidersHorizontal}
          title="Configure generation"
          status={configStatus}
          defaultOpen={phase === "configure"}
        >
          <div className="space-y-5 pt-1">

            {/* Crawl scope */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Crawl scope
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setScope(opt.id)}
                    disabled={phase === "generating"}
                    className={cn(
                      "relative flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      scope === opt.id
                        ? "border-primary/60 bg-primary/6 ring-1 ring-primary/20"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                    )}
                  >
                    {opt.rec && (
                      <span className="absolute -top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                        recommended
                      </span>
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      {scope === opt.id && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-tight">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Output detail */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Output detail
              </p>
              <div className="flex gap-2">
                {DETAIL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDetailLevel(opt.value)}
                    disabled={phase === "generating"}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      detailLevel === opt.value
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced options */}
            <div className="border-t border-border/60 pt-3">
              <button
                onClick={() => setAdvancedOpen((v) => !v)}
                disabled={phase === "generating"}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    advancedOpen && "rotate-90"
                  )}
                />
                Advanced options
              </button>

              {/* Collapsible advanced */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: advancedOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 pt-3">

                    {/* File name */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        File name
                      </label>
                      <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                        <input
                          type="text"
                          value={fileName}
                          onChange={(e) =>
                            setFileName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
                          }
                          disabled={phase === "generating"}
                          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none disabled:opacity-50"
                          placeholder="llms"
                        />
                        <span className="px-3 py-2 text-sm text-muted-foreground bg-muted/50 border-l border-border">
                          .txt
                        </span>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Email notification
                        <span className="font-normal normal-case tracking-normal">(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={notifyEmail}
                        onChange={(e) => setNotifyEmail(e.target.value)}
                        disabled={phase === "generating"}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 disabled:opacity-50"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Get notified when your file is ready.
                      </p>
                    </div>

                    {/* Custom scan depth */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          Scan depth override
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={customDepth}
                          onChange={(e) => setCustomDepth(e.target.value)}
                          disabled={phase === "generating"}
                          placeholder={String(SCOPE_OPTIONS.find((s) => s.id === scope)?.depth ?? 3)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          Max pages override
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={customMaxPages}
                          onChange={(e) => setCustomMaxPages(e.target.value)}
                          disabled={phase === "generating"}
                          placeholder={String(SCOPE_OPTIONS.find((s) => s.id === scope)?.pages ?? 50)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 disabled:opacity-50"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>
        </ReasoningStep>
      )}

      {/* ── Generate button ── */}
      {(phase === "configure" || phase === "generating") && (
        <div className="space-y-2">
          {generateError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{generateError}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !session}
            className={cn(
              "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all",
              "bg-foreground text-background hover:opacity-90",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting generation…
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                Generate llms.txt
              </>
            )}
          </button>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
