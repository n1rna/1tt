"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Globe,
  Loader2,
  Check,
  Copy,
  Sparkles,
  FileText,
  LogIn,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Zap,
} from "lucide-react";
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

// ─── Conversation phases ──────────────────────────────────────────────────────

type Phase =
  | "greeting"        // URL input visible, no messages yet
  | "url-thinking"    // Typing indicator after URL submitted
  | "url-analyzed"    // Cache result shown, crawl-depth question
  | "depth-answered"  // User picked depth, detail-level question
  | "detail-answered" // User picked detail level, ready to generate
  | "generating";     // Spinning, then redirect

// ─── Small building blocks ────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

function AgentBubble({
  children,
  visible = true,
}: {
  children: React.ReactNode;
  visible?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 transition-all duration-300",
        visible
          ? "animate-in fade-in slide-in-from-bottom-2 duration-300 opacity-100"
          : "opacity-0 pointer-events-none"
      )}
    >
      {/* Bot avatar */}
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted border border-border shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-border bg-muted/40 px-3.5 py-2.5 text-sm">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground text-background px-3.5 py-2 text-sm font-medium">
        {children}
      </div>
    </div>
  );
}

function OptionPills({
  options,
  onSelect,
  disabled,
}: {
  options: { label: string; value: string; sub?: string }[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 pl-9">
      {options.map((opt) => (
        <button
          key={opt.value}
          disabled={disabled}
          onClick={() => onSelect(opt.value)}
          className={cn(
            "flex flex-col items-start px-3 py-2 rounded-xl border text-sm transition-all",
            "border-border bg-card hover:bg-accent/60 hover:border-foreground/30",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "animate-in fade-in slide-in-from-bottom-1 duration-200"
          )}
        >
          <span className="font-medium leading-snug">{opt.label}</span>
          {opt.sub && (
            <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">{opt.sub}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const CRAWL_OPTIONS: { label: string; value: string; sub: string }[] = [
  { label: "Quick", value: "10", sub: "Up to 10 pages" },
  { label: "Standard", value: "50", sub: "Up to 50 pages" },
  { label: "Deep", value: "200", sub: "Up to 200 pages" },
];

const DETAIL_OPTIONS: { label: string; value: DetailLevel; sub: string }[] = [
  { label: "Overview", value: "overview", sub: "Key pages only" },
  { label: "Standard", value: "standard", sub: "Balanced coverage" },
  { label: "Detailed", value: "detailed", sub: "Extended descriptions" },
];

export function LlmsTxtGenerator() {
  const { data: session } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const router = useRouter();

  // Conversation phase
  const [phase, setPhase] = useState<Phase>("greeting");

  // URL input
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);

  // Choices
  const [maxPages, setMaxPages] = useState(50);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");
  const [scanDepth] = useState<ScanDepth>(0);

  // Advanced options (collapsed)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fileName, setFileName] = useState("llms");
  const [notifyEmail, setNotifyEmail] = useState("");

  // UI labels for chosen options
  const [chosenCrawlLabel, setChosenCrawlLabel] = useState("");
  const [chosenDetailLabel, setChosenDetailLabel] = useState("");

  // Error / generating
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to bottom whenever phase changes
  useEffect(() => {
    const t = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 350);
    return () => clearTimeout(t);
  }, [phase, advancedOpen]);

  // ── Cache check ──────────────────────────────────────────────────────────

  const checkCache = useCallback(async (rawUrl: string, depth: ScanDepth) => {
    if (!isValidUrl(rawUrl)) return;
    setCheckingCache(true);
    setCacheInfo(null);
    try {
      const params = new URLSearchParams({ url: rawUrl, depth: String(depth) });
      const res = await fetch(`/api/proxy/llms/cache?${params}`, { credentials: "include" });
      if (res.ok) {
        const data: CacheInfo = await res.json();
        setCacheInfo(data);
      }
    } catch {
      // silently ignore
    } finally {
      setCheckingCache(false);
    }
  }, []);

  // Debounced URL validation + cache check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!url) {
      setUrlError(null);
      setCacheInfo(null);
      return;
    }
    if (!isValidUrl(url)) {
      setUrlError("Enter a valid URL starting with http:// or https://");
      setCacheInfo(null);
      return;
    }
    setUrlError(null);
    debounceRef.current = setTimeout(() => checkCache(url, scanDepth), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url, checkCache, scanDepth]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleUrlSubmit = useCallback(() => {
    if (!isValidUrl(url)) return;
    if (!session) { setSignInOpen(true); return; }
    setPhase("url-thinking");
    // Brief typing delay, then show analysis
    setTimeout(() => setPhase("url-analyzed"), 700);
  }, [url, session]);

  const handleCrawlChoice = useCallback((val: string) => {
    const pages = parseInt(val, 10);
    setMaxPages(pages);
    const opt = CRAWL_OPTIONS.find((o) => o.value === val);
    setChosenCrawlLabel(opt ? `${opt.label} · ${opt.sub}` : val);
    setTimeout(() => setPhase("depth-answered"), 200);
  }, []);

  const handleDetailChoice = useCallback((val: string) => {
    setDetailLevel(val as DetailLevel);
    const opt = DETAIL_OPTIONS.find((o) => o.value === val);
    setChosenDetailLabel(opt ? opt.label : val);
    setTimeout(() => setPhase("detail-answered"), 200);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!session) { setSignInOpen(true); return; }
    setGenerating(true);
    setGenerateError(null);
    setPhase("generating");

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
      setPhase("detail-answered");
    }
  }, [session, url, scanDepth, maxPages, detailLevel, fileName, notifyEmail, router]);

  // ── Derived helpers ───────────────────────────────────────────────────────

  const urlValid = isValidUrl(url);

  const cacheNote =
    cacheInfo?.cached && cacheInfo.cachedAt
      ? `Found a cached crawl${cacheInfo.pagesCount ? ` with ${cacheInfo.pagesCount} pages` : ""} from ${timeAgo(cacheInfo.cachedAt)}. I'll use this to speed things up.`
      : "No cached data found — I'll do a fresh crawl.";

  const showThinking = phase === "url-thinking";
  const showAnalyzed = ["url-analyzed", "depth-answered", "detail-answered", "generating"].includes(phase);
  const showCrawlQuestion = showAnalyzed;
  const showCrawlAnswer = ["depth-answered", "detail-answered", "generating"].includes(phase);
  const showDetailQuestion = showCrawlAnswer;
  const showDetailAnswer = ["detail-answered", "generating"].includes(phase);
  const showGenerateSection = showDetailAnswer;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto space-y-3">
      {/* Sign-in dialog */}
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

      {/* Auth nudge */}
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

      {/* ── Greeting ── */}
      <AgentBubble>
        <span>I&apos;ll help you generate an <code className="text-[12px] bg-muted px-1 py-0.5 rounded">llms.txt</code> file. Paste a URL to get started.</span>
      </AgentBubble>

      {/* ── URL input (always visible until phase advances) ── */}
      <div className="pl-9 space-y-2">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Globe className="h-4 w-4" />
          </div>
          <input
            type="url"
            value={url}
            disabled={showThinking || showAnalyzed}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && urlValid && !showAnalyzed && handleUrlSubmit()}
            placeholder="https://docs.example.com"
            className={cn(
              "w-full pl-9 pr-10 py-2.5 rounded-xl border bg-card text-sm outline-none transition-colors",
              "placeholder:text-muted-foreground/50",
              "focus:ring-1 focus:ring-ring",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              urlError ? "border-destructive" : "border-border"
            )}
          />
          {checkingCache && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          {urlValid && !showAnalyzed && !checkingCache && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Check className="h-3.5 w-3.5 text-green-500" />
            </div>
          )}
        </div>

        {urlError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {urlError}
          </p>
        )}

        {/* Submit button — only visible before URL is confirmed */}
        {!showAnalyzed && (
          <button
            onClick={handleUrlSubmit}
            disabled={!urlValid || showThinking}
            className={cn(
              "flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
              "bg-foreground text-background hover:opacity-90",
              "disabled:opacity-35 disabled:cursor-not-allowed"
            )}
          >
            {showThinking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Analyze URL
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Thinking dots ── */}
      {showThinking && (
        <AgentBubble>
          <ThinkingDots />
        </AgentBubble>
      )}

      {/* ── URL analyzed ── */}
      {showAnalyzed && (
        <>
          {/* Show the URL as a user bubble */}
          <UserBubble>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
              {url}
            </span>
          </UserBubble>

          {/* Cache info message */}
          <AgentBubble>
            <span>{cacheNote}</span>
          </AgentBubble>
        </>
      )}

      {/* ── Crawl depth question ── */}
      {showCrawlQuestion && !showCrawlAnswer && (
        <AgentBubble>
          <span>How many pages should I crawl?</span>
        </AgentBubble>
      )}

      {showCrawlQuestion && !showCrawlAnswer && (
        <OptionPills
          options={CRAWL_OPTIONS}
          onSelect={handleCrawlChoice}
          disabled={showCrawlAnswer}
        />
      )}

      {/* ── Crawl depth answered ── */}
      {showCrawlAnswer && (
        <>
          <AgentBubble>
            <span>How many pages should I crawl?</span>
          </AgentBubble>
          <UserBubble>{chosenCrawlLabel}</UserBubble>
        </>
      )}

      {/* ── Detail level question ── */}
      {showDetailQuestion && !showDetailAnswer && (
        <AgentBubble>
          <span>What level of detail do you need?</span>
        </AgentBubble>
      )}

      {showDetailQuestion && !showDetailAnswer && (
        <OptionPills
          options={DETAIL_OPTIONS}
          onSelect={handleDetailChoice}
          disabled={showDetailAnswer}
        />
      )}

      {/* ── Detail level answered ── */}
      {showDetailAnswer && (
        <>
          <AgentBubble>
            <span>What level of detail do you need?</span>
          </AgentBubble>
          <UserBubble>{chosenDetailLabel}</UserBubble>
        </>
      )}

      {/* ── Generate section ── */}
      {showGenerateSection && (
        <AgentBubble>
          <div className="space-y-3">
            <p>Ready to generate. Anything else before I start?</p>

            {/* Advanced options toggle */}
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {advancedOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Advanced options
            </button>

            {advancedOpen && (
              <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
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
                      className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
                      placeholder="llms"
                    />
                    <span className="px-3 py-2 text-sm text-muted-foreground bg-muted/50 border-l border-border">
                      .txt
                    </span>
                  </div>
                </div>

                {/* Email notification */}
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
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Get notified when your file is ready.
                  </p>
                </div>
              </div>
            )}
          </div>
        </AgentBubble>
      )}

      {/* ── Generate button ── */}
      {showGenerateSection && (
        <div className="pl-9 space-y-2">
          {generateError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{generateError}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all",
              "bg-foreground text-background hover:opacity-90",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting generation...
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

      {/* ── Generating phase message ── */}
      {phase === "generating" && generating && (
        <AgentBubble>
          <span className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            Kicking off the crawl — redirecting you now...
          </span>
        </AgentBubble>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
