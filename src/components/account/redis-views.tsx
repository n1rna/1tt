"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import {
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { executeCommand, executePipeline } from "@/lib/redis";
import { cn } from "@/lib/utils";

// ── Shared helpers ────────────────────────────────────────────────────────────

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function truncate(s: string, max = 200): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function fmtTs(ts: number | string | null | undefined): string {
  if (ts === null || ts === undefined || ts === "") return "—";
  const n = typeof ts === "string" ? parseFloat(ts) : ts;
  if (isNaN(n) || n === 0) return "—";
  // epoch ms vs epoch seconds heuristic
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toLocaleString();
}

function fmtScore(score: string): string {
  const n = parseFloat(score);
  if (isNaN(n)) return score;
  if (n > 1e12) return new Date(n).toLocaleString();
  if (n > 1e9) return new Date(n * 1000).toLocaleString();
  return score;
}

function parseScanKeys(result: unknown): string[] {
  if (!Array.isArray(result)) return [];
  const inner = result[1];
  if (!Array.isArray(inner)) return [];
  return inner as string[];
}

function parseZrangeWithScores(result: unknown): { member: string; score: string }[] {
  const flat = Array.isArray(result) ? (result as string[]) : [];
  const out: { member: string; score: string }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    out.push({ member: flat[i], score: flat[i + 1] });
  }
  return out;
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded border bg-muted/20 px-3 py-2.5 text-center">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={cn("text-sm font-semibold font-mono", color)}>
        {value === "" || value === null || value === undefined ? "—" : String(value)}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  colorClass,
}: {
  status: string;
  colorClass: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0",
        colorClass
      )}
    >
      {status}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
      {children}
    </p>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div
      className={cn(
        "grid bg-muted/50 px-3 py-1.5 font-medium text-[11px] text-muted-foreground"
      )}
      style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
    >
      {cols.map((c) => (
        <span key={c}>{c}</span>
      ))}
    </div>
  );
}

function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 justify-center text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ label = "No data" }: { label?: string }) {
  return (
    <p className="text-xs text-muted-foreground italic py-4 text-center">
      {label}
    </p>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <p className="text-xs text-destructive py-4 text-center">{message}</p>
  );
}

function RefreshBar({
  label,
  loading,
  onRefresh,
}: {
  label: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={onRefresh}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        Refresh
      </Button>
    </div>
  );
}

function ExpandableRow({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        className="w-full text-left flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/40 transition-colors"
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
            expanded && "rotate-90"
          )}
        />
        <span className="text-xs font-mono truncate flex-1 min-w-0">
          {label}
        </span>
      </button>
      {expanded && (
        <div className="mx-3 mb-2 rounded border overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  const formatted =
    value === null || value === undefined
      ? "(nil)"
      : typeof value === "string"
      ? (() => {
          const parsed = safeJson(value);
          return parsed !== null
            ? JSON.stringify(parsed, null, 2)
            : value;
        })()
      : JSON.stringify(value, null, 2);
  return (
    <pre className="text-[11px] font-mono bg-muted/40 rounded p-2.5 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
      {formatted}
    </pre>
  );
}

function DetailTable({
  rows,
}: {
  rows: { field: string; value: React.ReactNode }[];
}) {
  return (
    <div className="divide-y text-xs">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[8rem,1fr] gap-2 px-3 py-1.5">
          <span className="font-medium text-muted-foreground truncate shrink-0">
            {r.field}
          </span>
          <span className="font-mono text-foreground break-all min-w-0">
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Queue tab pills ───────────────────────────────────────────────────────────

function QueuePills({
  queues,
  selected,
  onSelect,
}: {
  queues: string[];
  selected: string | null;
  onSelect: (q: string) => void;
}) {
  if (queues.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b bg-muted/10 shrink-0">
      {queues.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className={cn(
            "text-xs px-2.5 py-1 rounded border transition-colors font-mono",
            selected === q
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BullMQ View
// ─────────────────────────────────────────────────────────────────────────────

type BullState = "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";

const BULL_STATES: BullState[] = [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
];

const BULL_STATE_KEY: Record<BullState, string> = {
  waiting: "wait",
  active: "active",
  completed: "completed",
  failed: "failed",
  delayed: "delayed",
  paused: "paused",
};

const BULL_STATE_COLORS: Record<BullState, string> = {
  waiting: "text-blue-600 dark:text-blue-400",
  active: "text-orange-600 dark:text-orange-400",
  completed: "text-green-600 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
  delayed: "text-yellow-600 dark:text-yellow-400",
  paused: "text-muted-foreground",
};

const BULL_STATE_CARD_COLORS: Record<BullState, string> = {
  waiting: "text-blue-600 dark:text-blue-400",
  active: "text-orange-600 dark:text-orange-400",
  completed: "text-green-600 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
  delayed: "text-yellow-600 dark:text-yellow-400",
  paused: "text-muted-foreground",
};

interface BullJob {
  id: string;
  data: Record<string, string>;
}

interface BullQueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

function BullJobDetail({
  dbId,
  queue,
  jobId,
  showRetry,
  onRetried,
}: {
  dbId: string;
  queue: string;
  jobId: string;
  showRetry?: boolean;
  onRetried?: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    executeCommand(dbId, ["HGETALL", `bull:${queue}:${jobId}`])
      .then((res) => {
        if (cancelled) return;
        const flat = Array.isArray(res.result) ? (res.result as string[]) : [];
        const map: Record<string, string> = {};
        for (let i = 0; i + 1 < flat.length; i += 2) {
          map[flat[i]] = flat[i + 1];
        }
        setFields(map);
      })
      .catch(() => {
        if (!cancelled) setFields({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbId, queue, jobId]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Remove from failed sorted set
      await executeCommand(dbId, ["ZREM", `bull:${queue}:failed`, jobId]);
      // Reset job fields
      await executePipeline(dbId, [
        ["HDEL", `bull:${queue}:${jobId}`, "failedReason"],
        ["HDEL", `bull:${queue}:${jobId}`, "stacktrace"],
        ["HDEL", `bull:${queue}:${jobId}`, "finishedOn"],
        ["HSET", `bull:${queue}:${jobId}`, "attemptsMade", "0"],
      ]);
      // Push back to wait list
      await executeCommand(dbId, ["RPUSH", `bull:${queue}:wait`, jobId]);
      setRetried(true);
      onRetried?.();
    } catch {
      // silently fail
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <LoadingState label="Loading job…" />;
  if (!fields) return <EmptyState label="No data" />;

  if (retried) {
    return (
      <div className="px-3 py-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5" />
        Job moved to waiting queue
      </div>
    );
  }

  const jsonFields = ["data", "opts", "returnvalue", "stacktrace"];
  const tsFields = ["timestamp", "processedOn", "finishedOn"];
  const rows: { field: string; value: React.ReactNode }[] = Object.entries(
    fields
  ).map(([field, value]) => {
    if (jsonFields.includes(field)) {
      const parsed = safeJson(value);
      return {
        field,
        value: (
          <JsonBlock value={parsed !== null ? parsed : value} />
        ),
      };
    }
    if (tsFields.includes(field)) {
      const n = parseFloat(value);
      return {
        field,
        value: isNaN(n) ? value : fmtTs(n),
      };
    }
    return { field, value };
  });

  return (
    <div>
      {showRetry && (
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => void handleRetry()}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Retry
          </Button>
          {fields.failedReason && (
            <span className="text-xs text-destructive truncate flex-1 min-w-0">
              {fields.failedReason}
            </span>
          )}
        </div>
      )}
      <DetailTable rows={rows} />
    </div>
  );
}

function BullJobList({
  dbId,
  queue,
  state,
  onCountChanged,
}: {
  dbId: string;
  queue: string;
  state: BullState;
  onCountChanged?: () => void;
}) {
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const stateKey = BULL_STATE_KEY[state];
  const key = `bull:${queue}:${stateKey}`;
  const isSortedSet = state === "completed" || state === "failed" || state === "delayed";

  const loadJobs = useCallback(() => {
    setLoading(true);
    setExpandedId(null);

    const cmd = isSortedSet
      ? ["ZRANGEBYSCORE", key, "-inf", "+inf", "LIMIT", "0", "50"]
      : ["LRANGE", key, "0", "49"];

    executeCommand(dbId, cmd)
      .then((res) => {
        setJobIds(Array.isArray(res.result) ? (res.result as string[]) : []);
      })
      .catch(() => {
        setJobIds([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [dbId, key, isSortedSet]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleRetryAll = async () => {
    if (jobIds.length === 0) return;
    setRetryingAll(true);
    try {
      for (const jobId of jobIds) {
        await executeCommand(dbId, ["ZREM", `bull:${queue}:failed`, jobId]);
        await executePipeline(dbId, [
          ["HDEL", `bull:${queue}:${jobId}`, "failedReason"],
          ["HDEL", `bull:${queue}:${jobId}`, "stacktrace"],
          ["HDEL", `bull:${queue}:${jobId}`, "finishedOn"],
          ["HSET", `bull:${queue}:${jobId}`, "attemptsMade", "0"],
        ]);
        await executeCommand(dbId, ["RPUSH", `bull:${queue}:wait`, jobId]);
      }
      loadJobs();
      onCountChanged?.();
    } catch {
      // silently fail
    } finally {
      setRetryingAll(false);
    }
  };

  if (loading) return <LoadingState />;
  if (jobIds.length === 0) return <EmptyState label={`No ${state} jobs`} />;

  const isFailed = state === "failed";

  return (
    <div>
      {isFailed && jobIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => void handleRetryAll()}
            disabled={retryingAll}
          >
            {retryingAll ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Retry All ({jobIds.length})
          </Button>
        </div>
      )}
      <div className="rounded border overflow-hidden divide-y">
        {jobIds.map((id) => (
          <ExpandableRow
            key={id}
            label={id}
            expanded={expandedId === id}
            onToggle={() => setExpandedId((prev) => (prev === id ? null : id))}
          >
            <BullJobDetail
              dbId={dbId}
              queue={queue}
              jobId={id}
              showRetry={isFailed}
              onRetried={() => {
                setJobIds((prev) => prev.filter((jid) => jid !== id));
                onCountChanged?.();
              }}
            />
          </ExpandableRow>
        ))}
      </div>
    </div>
  );
}

function BullQueueDashboard({
  dbId,
  queue,
}: {
  dbId: string;
  queue: string;
}) {
  const [counts, setCounts] = useState<BullQueueCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeState, setActiveState] = useState<BullState>("waiting");

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const cmds: string[][] = [
        ["LLEN", `bull:${queue}:wait`],
        ["LLEN", `bull:${queue}:active`],
        ["ZCARD", `bull:${queue}:completed`],
        ["ZCARD", `bull:${queue}:failed`],
        ["ZCARD", `bull:${queue}:delayed`],
        ["LLEN", `bull:${queue}:paused`],
      ];
      const results = await executePipeline(dbId, cmds);
      const nums = results.map((r) =>
        typeof r.result === "number" ? r.result : 0
      );
      setCounts({
        waiting: nums[0],
        active: nums[1],
        completed: nums[2],
        failed: nums[3],
        delayed: nums[4],
        paused: nums[5],
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [dbId, queue]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  if (loading && !counts) return <LoadingState />;

  return (
    <div className="p-4 space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {BULL_STATES.map((s) => (
          <StatCard
            key={s}
            label={s}
            value={counts ? counts[s] : "—"}
            color={BULL_STATE_CARD_COLORS[s]}
          />
        ))}
      </div>

      {/* State tabs */}
      <div>
        <div className="flex flex-wrap gap-1 mb-3">
          {BULL_STATES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveState(s)}
              className={cn(
                "text-xs px-2.5 py-1 rounded border transition-colors",
                activeState === s
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              <span className={cn(activeState === s ? "" : BULL_STATE_COLORS[s])}>
                {s}
              </span>
              {counts && (
                <span className="ml-1.5 font-mono">{counts[s]}</span>
              )}
            </button>
          ))}
        </div>

        <BullJobList dbId={dbId} queue={queue} state={activeState} onCountChanged={() => void loadCounts()} />
      </div>
    </div>
  );
}

export function BullMQView({ dbId }: { dbId: string }) {
  const [queues, setQueues] = useState<string[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await executeCommand(dbId, [
        "SCAN",
        "0",
        "MATCH",
        "bull:*:meta",
        "COUNT",
        "1000",
      ]);
      const keys = parseScanKeys(res.result);
      const names = keys
        .map((k) => {
          const m = k.match(/^bull:(.+):meta$/);
          return m ? m[1] : null;
        })
        .filter(Boolean) as string[];
      const unique = [...new Set(names)].sort();
      setQueues(unique);
      if (unique.length > 0 && selectedQueue === null) {
        setSelectedQueue(unique[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }, [dbId, selectedQueue]);

  useEffect(() => {
    void discover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RefreshBar label="BullMQ" loading={loading} onRefresh={discover} />

      {loading && queues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Discovering queues…" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message={error} />
        </div>
      ) : queues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState label="No BullMQ queues found (no bull:*:meta keys)" />
        </div>
      ) : (
        <>
          <QueuePills
            queues={queues}
            selected={selectedQueue}
            onSelect={setSelectedQueue}
          />
          <div className="flex-1 overflow-y-auto">
            {selectedQueue ? (
              <BullQueueDashboard dbId={dbId} queue={selectedQueue} />
            ) : (
              <EmptyState label="Select a queue" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidekiq View
// ─────────────────────────────────────────────────────────────────────────────

interface SidekiqStats {
  processed: string;
  failed: string;
  scheduled: number;
  retries: number;
  dead: number;
  enqueued: number;
}

interface SidekiqQueueEntry {
  name: string;
  length: number;
}

interface SidekiqJob {
  class?: string;
  jid?: string;
  args?: unknown[];
  queue?: string;
  created_at?: number;
  enqueued_at?: number;
  retry_count?: number;
  error_message?: string;
  error_class?: string;
  failed_at?: number;
  retried_at?: number;
  [key: string]: unknown;
}

type SidekiqSpecialTab = "scheduled" | "retry" | "dead";

function sidekiqStatusColor(tab: SidekiqSpecialTab): string {
  if (tab === "scheduled") return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
  if (tab === "retry") return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
  return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
}

function SidekiqJobRows({
  jobs,
  showScore,
  scoreLabel,
}: {
  jobs: { job: SidekiqJob; score?: string }[];
  showScore?: boolean;
  scoreLabel?: string;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (jobs.length === 0) return <EmptyState />;

  return (
    <div className="rounded border overflow-hidden divide-y text-xs">
      <div
        className={cn(
          "grid bg-muted/50 px-3 py-1.5 font-medium text-[11px] text-muted-foreground",
          showScore ? "grid-cols-[1fr,1fr,1fr,8rem]" : "grid-cols-[1fr,1fr,1fr]"
        )}
      >
        <span>Class</span>
        <span>JID</span>
        <span>Args</span>
        {showScore && <span>{scoreLabel ?? "Score"}</span>}
      </div>
      <div className="divide-y">
        {jobs.map(({ job, score }, idx) => (
          <div key={idx}>
            <button
              className="w-full text-left flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/40 transition-colors"
              onClick={() => setExpandedIdx((p) => (p === idx ? null : idx))}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                  expandedIdx === idx && "rotate-90"
                )}
              />
              <span
                className={cn(
                  "grid flex-1 min-w-0 gap-2",
                  showScore
                    ? "grid-cols-[1fr,1fr,1fr,8rem]"
                    : "grid-cols-[1fr,1fr,1fr]"
                )}
              >
                <span className="font-mono truncate">{job.class ?? "—"}</span>
                <span className="font-mono truncate text-muted-foreground">
                  {job.jid ?? "—"}
                </span>
                <span className="font-mono truncate text-muted-foreground">
                  {job.args
                    ? truncate(JSON.stringify(job.args), 80)
                    : "—"}
                </span>
                {showScore && (
                  <span className="font-mono truncate text-muted-foreground">
                    {score ? fmtScore(score) : "—"}
                  </span>
                )}
              </span>
            </button>
            {expandedIdx === idx && (
              <div className="mx-3 mb-2 rounded border overflow-hidden">
                <div className="divide-y text-xs">
                  {Object.entries(job).map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-[8rem,1fr] gap-2 px-3 py-1.5"
                    >
                      <span className="font-medium text-muted-foreground">
                        {k}
                      </span>
                      <span className="font-mono break-all min-w-0">
                        {["created_at", "enqueued_at", "failed_at", "retried_at"].includes(k)
                          ? fmtTs(v as number)
                          : typeof v === "object"
                          ? JSON.stringify(v, null, 2)
                          : String(v ?? "—")}
                      </span>
                    </div>
                  ))}
                  {score && (
                    <div className="grid grid-cols-[8rem,1fr] gap-2 px-3 py-1.5">
                      <span className="font-medium text-muted-foreground">
                        {scoreLabel ?? "score"}
                      </span>
                      <span className="font-mono break-all">{fmtScore(score)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SidekiqQueueDetail({
  dbId,
  queueName,
}: {
  dbId: string;
  queueName: string;
}) {
  const [jobs, setJobs] = useState<SidekiqJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    executeCommand(dbId, ["LRANGE", `queue:${queueName}`, "0", "49"])
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res.result) ? (res.result as string[]) : [];
        const parsed = raw.map((item) => {
          const j = safeJson(item);
          return (j ?? {}) as SidekiqJob;
        });
        setJobs(parsed);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbId, queueName]);

  if (loading) return <LoadingState />;
  return (
    <SidekiqJobRows
      jobs={jobs.map((job) => ({ job }))}
      showScore={false}
    />
  );
}

function SidekiqSpecialSet({
  dbId,
  setKey,
  tab,
}: {
  dbId: string;
  setKey: string;
  tab: SidekiqSpecialTab;
}) {
  const [entries, setEntries] = useState<{ job: SidekiqJob; score: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    executeCommand(dbId, [
      "ZRANGEBYSCORE",
      setKey,
      "-inf",
      "+inf",
      "WITHSCORES",
      "LIMIT",
      "0",
      "50",
    ])
      .then((res) => {
        if (cancelled) return;
        const pairs = parseZrangeWithScores(res.result);
        const parsed = pairs.map(({ member, score }) => ({
          job: (safeJson(member) ?? {}) as SidekiqJob,
          score,
        }));
        setEntries(parsed);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbId, setKey]);

  const scoreLabel =
    tab === "scheduled" ? "Run at" : tab === "retry" ? "Retry at" : "Died at";

  if (loading) return <LoadingState />;
  return (
    <SidekiqJobRows jobs={entries} showScore scoreLabel={scoreLabel} />
  );
}

export function SidekiqView({ dbId }: { dbId: string }) {
  const [stats, setStats] = useState<SidekiqStats | null>(null);
  const [queueEntries, setQueueEntries] = useState<SidekiqQueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queues" | SidekiqSpecialTab>(
    "queues"
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get queue names
      const queueNamesRes = await executeCommand(dbId, ["SMEMBERS", "queues"]);
      const queueNames = Array.isArray(queueNamesRes.result)
        ? (queueNamesRes.result as string[]).sort()
        : [];

      // Pipeline: processed, failed, scheduled count, retry count, dead count, queue lengths
      const pipeline: string[][] = [
        ["GET", "stat:processed"],
        ["GET", "stat:failed"],
        ["ZCARD", "schedule"],
        ["ZCARD", "retry"],
        ["ZCARD", "dead"],
        ...queueNames.map((q) => ["LLEN", `queue:${q}`]),
      ];

      const results = await executePipeline(dbId, pipeline);
      const processed = (results[0]?.result as string) ?? "0";
      const failed = (results[1]?.result as string) ?? "0";
      const scheduled = typeof results[2]?.result === "number" ? results[2].result : 0;
      const retries = typeof results[3]?.result === "number" ? results[3].result : 0;
      const dead = typeof results[4]?.result === "number" ? results[4].result : 0;

      const queueLengths: SidekiqQueueEntry[] = queueNames.map((name, i) => ({
        name,
        length:
          typeof results[5 + i]?.result === "number"
            ? (results[5 + i].result as number)
            : 0,
      }));

      const enqueued = queueLengths.reduce((s, q) => s + q.length, 0);

      setStats({ processed, failed, scheduled, retries, dead, enqueued });
      setQueueEntries(queueLengths);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Sidekiq data");
    } finally {
      setLoading(false);
    }
  }, [dbId]);

  useEffect(() => {
    void load();
  }, [load]);

  const SPECIAL_TABS: { id: SidekiqSpecialTab; key: string; label: string }[] = [
    { id: "scheduled", key: "schedule", label: "Scheduled" },
    { id: "retry", key: "retry", label: "Retry" },
    { id: "dead", key: "dead", label: "Dead" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RefreshBar label="Sidekiq" loading={loading} onRefresh={load} />

      {loading && !stats ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Loading Sidekiq data…" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message={error} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                <StatCard
                  label="Processed"
                  value={stats.processed}
                  color="text-green-600 dark:text-green-400"
                />
                <StatCard
                  label="Failed"
                  value={stats.failed}
                  color="text-red-600 dark:text-red-400"
                />
                <StatCard
                  label="Enqueued"
                  value={stats.enqueued}
                  color="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  label="Scheduled"
                  value={stats.scheduled}
                  color="text-cyan-600 dark:text-cyan-400"
                />
                <StatCard
                  label="Retries"
                  value={stats.retries}
                  color="text-yellow-600 dark:text-yellow-400"
                />
                <StatCard
                  label="Dead"
                  value={stats.dead}
                  color="text-red-600 dark:text-red-400"
                />
              </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => {
                  setActiveTab("queues");
                  setSelectedQueue(null);
                }}
                className={cn(
                  "text-xs px-2.5 py-1 rounded border transition-colors",
                  activeTab === "queues"
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                Queues
              </button>
              {SPECIAL_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    setSelectedQueue(null);
                  }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded border transition-colors",
                    activeTab === t.id
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  )}
                >
                  {t.label}
                  {stats && (
                    <span className="ml-1.5 font-mono">
                      {t.id === "scheduled"
                        ? stats.scheduled
                        : t.id === "retry"
                        ? stats.retries
                        : stats.dead}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Queues tab */}
            {activeTab === "queues" && (
              <div className="space-y-3">
                <SectionHeader>Queues</SectionHeader>
                {queueEntries.length === 0 ? (
                  <EmptyState label="No queues found (SMEMBERS queues returned empty)" />
                ) : (
                  <div className="rounded border overflow-hidden">
                    <TableHeader cols={["Queue", "Length"]} />
                    <div className="divide-y">
                      {queueEntries.map((q) => (
                        <div key={q.name}>
                          <button
                            className="w-full text-left flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/40 transition-colors"
                            onClick={() =>
                              setSelectedQueue((p) =>
                                p === q.name ? null : q.name
                              )
                            }
                          >
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                                selectedQueue === q.name && "rotate-90"
                              )}
                            />
                            <span className="flex-1 text-xs font-mono">
                              {q.name}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {q.length}
                            </span>
                          </button>
                          {selectedQueue === q.name && (
                            <div className="mx-3 mb-2">
                              <SidekiqQueueDetail
                                dbId={dbId}
                                queueName={q.name}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Special set tabs */}
            {SPECIAL_TABS.map(
              (t) =>
                activeTab === t.id && (
                  <div key={t.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <SectionHeader>{t.label}</SectionHeader>
                      <StatusBadge
                        status={t.label}
                        colorClass={sidekiqStatusColor(t.id)}
                      />
                    </div>
                    <SidekiqSpecialSet dbId={dbId} setKey={t.key} tab={t.id} />
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Celery View
// ─────────────────────────────────────────────────────────────────────────────

interface CeleryQueueEntry {
  name: string;
  length: number;
}

interface CeleryTaskResult {
  task_id: string;
  status: string;
  result?: unknown;
  traceback?: string | null;
  date_done?: string | null;
  children?: unknown[];
}

type CeleryTaskStatus = "SUCCESS" | "FAILURE" | "PENDING" | "STARTED" | "RETRY" | string;

function celeryStatusColor(status: CeleryTaskStatus): string {
  switch (status) {
    case "SUCCESS":
      return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
    case "FAILURE":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    case "PENDING":
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
    case "STARTED":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "RETRY":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

interface CeleryMessage {
  task?: string;
  id?: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  eta?: string | null;
  retries?: number;
  [key: string]: unknown;
}

function CeleryQueueDetail({
  dbId,
  queueName,
}: {
  dbId: string;
  queueName: string;
}) {
  const [messages, setMessages] = useState<CeleryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    executeCommand(dbId, ["LRANGE", queueName, "0", "49"])
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res.result) ? (res.result as string[]) : [];
        const parsed = raw.map((item) => {
          const j = safeJson(item);
          return (j ?? {}) as CeleryMessage;
        });
        setMessages(parsed);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbId, queueName]);

  if (loading) return <LoadingState />;
  if (messages.length === 0) return <EmptyState label="No messages in queue" />;

  return (
    <div className="rounded border overflow-hidden divide-y text-xs">
      <div className="grid grid-cols-[1fr,10rem,8rem,6rem] bg-muted/50 px-3 py-1.5 font-medium text-[11px] text-muted-foreground">
        <span>Task</span>
        <span>ID</span>
        <span>Args</span>
        <span>ETA</span>
      </div>
      <div className="divide-y">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <button
              className="w-full text-left flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/40 transition-colors"
              onClick={() => setExpandedIdx((p) => (p === idx ? null : idx))}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                  expandedIdx === idx && "rotate-90"
                )}
              />
              <span className="grid grid-cols-[1fr,10rem,8rem,6rem] flex-1 min-w-0 gap-2">
                <span className="font-mono truncate">{msg.task ?? "—"}</span>
                <span className="font-mono truncate text-muted-foreground">
                  {msg.id ? truncate(msg.id, 12) : "—"}
                </span>
                <span className="font-mono truncate text-muted-foreground">
                  {msg.args ? truncate(JSON.stringify(msg.args), 40) : "—"}
                </span>
                <span className="font-mono truncate text-muted-foreground">
                  {msg.eta ? new Date(msg.eta).toLocaleString() : "—"}
                </span>
              </span>
            </button>
            {expandedIdx === idx && (
              <div className="mx-3 mb-2 rounded border overflow-hidden">
                <div className="divide-y text-xs">
                  {Object.entries(msg).map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-[8rem,1fr] gap-2 px-3 py-1.5"
                    >
                      <span className="font-medium text-muted-foreground">{k}</span>
                      <span className="font-mono break-all min-w-0">
                        {typeof v === "object"
                          ? JSON.stringify(v, null, 2)
                          : String(v ?? "—")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CeleryResultsTable({
  dbId,
  resultKeys,
}: {
  dbId: string;
  resultKeys: string[];
}) {
  const [results, setResults] = useState<CeleryTaskResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (resultKeys.length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const cmds = resultKeys.slice(0, 50).map((k) => ["GET", k]);
    executePipeline(dbId, cmds)
      .then((res) => {
        if (cancelled) return;
        const parsed: CeleryTaskResult[] = res.map((r, i) => {
          const raw = typeof r.result === "string" ? r.result : null;
          const j = raw ? safeJson(raw) : null;
          if (j && typeof j === "object" && !Array.isArray(j)) {
            const taskId =
              (j as Record<string, unknown>).task_id as string |
              undefined ??
              resultKeys[i].replace("celery-task-meta-", "");
            return { ...(j as Record<string, unknown>), task_id: taskId } as CeleryTaskResult;
          }
          return {
            task_id: resultKeys[i].replace("celery-task-meta-", ""),
            status: "UNKNOWN",
          };
        });
        setResults(parsed);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbId, resultKeys]);

  if (loading) return <LoadingState />;
  if (results.length === 0) return <EmptyState label="No task results found" />;

  return (
    <div className="rounded border overflow-hidden divide-y text-xs">
      <div className="grid grid-cols-[1fr,7rem,10rem] bg-muted/50 px-3 py-1.5 font-medium text-[11px] text-muted-foreground">
        <span>Task ID</span>
        <span>Status</span>
        <span>Date Done</span>
      </div>
      <div className="divide-y">
        {results.map((r) => (
          <div key={r.task_id}>
            <button
              className="w-full text-left flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/40 transition-colors"
              onClick={() =>
                setExpandedId((p) => (p === r.task_id ? null : r.task_id))
              }
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                  expandedId === r.task_id && "rotate-90"
                )}
              />
              <span className="grid grid-cols-[1fr,7rem,10rem] flex-1 min-w-0 gap-2 items-center">
                <span className="font-mono truncate text-foreground">
                  {r.task_id}
                </span>
                <span>
                  <StatusBadge
                    status={r.status}
                    colorClass={celeryStatusColor(r.status)}
                  />
                </span>
                <span className="font-mono text-muted-foreground truncate">
                  {r.date_done ? new Date(r.date_done).toLocaleString() : "—"}
                </span>
              </span>
            </button>
            {expandedId === r.task_id && (
              <div className="mx-3 mb-2 rounded border overflow-hidden">
                <div className="divide-y text-xs">
                  <div className="grid grid-cols-[8rem,1fr] gap-2 px-3 py-1.5">
                    <span className="font-medium text-muted-foreground">result</span>
                    <span className="min-w-0">
                      <JsonBlock value={r.result} />
                    </span>
                  </div>
                  {r.traceback && (
                    <div className="grid grid-cols-[8rem,1fr] gap-2 px-3 py-1.5">
                      <span className="font-medium text-muted-foreground">traceback</span>
                      <pre className="text-[11px] font-mono text-destructive whitespace-pre-wrap break-all bg-destructive/5 rounded p-2">
                        {r.traceback}
                      </pre>
                    </div>
                  )}
                  {r.children && (r.children as unknown[]).length > 0 && (
                    <div className="grid grid-cols-[8rem,1fr] gap-2 px-3 py-1.5">
                      <span className="font-medium text-muted-foreground">children</span>
                      <span className="font-mono break-all">
                        {JSON.stringify(r.children, null, 2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CeleryView({ dbId }: { dbId: string }) {
  const [queueEntries, setQueueEntries] = useState<CeleryQueueEntry[]>([]);
  const [resultKeys, setResultKeys] = useState<string[]>([]);
  const [unackedCount, setUnackedCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queues" | "results">("queues");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Discover queues via _kombu.binding.* keys
      const bindingRes = await executeCommand(dbId, [
        "SCAN",
        "0",
        "MATCH",
        "_kombu.binding.*",
        "COUNT",
        "1000",
      ]);
      const bindingKeys = parseScanKeys(bindingRes.result);
      const queueNames = [
        ...new Set(
          bindingKeys.map((k) => k.replace("_kombu.binding.", ""))
        ),
      ].sort();

      // Discover task result keys
      const resultRes = await executeCommand(dbId, [
        "SCAN",
        "0",
        "MATCH",
        "celery-task-meta-*",
        "COUNT",
        "100",
      ]);
      const rKeys = parseScanKeys(resultRes.result);

      // Pipeline: LLEN for each queue + HLEN unacked
      const pipeline: string[][] = [
        ...queueNames.map((q) => ["LLEN", q]),
        ["HLEN", "unacked"],
      ];

      let queueLens: CeleryQueueEntry[] = [];
      let unacked = 0;

      if (pipeline.length > 0) {
        const results = await executePipeline(dbId, pipeline);
        queueLens = queueNames.map((name, i) => ({
          name,
          length:
            typeof results[i]?.result === "number"
              ? (results[i].result as number)
              : 0,
        }));
        const lastResult = results[results.length - 1];
        unacked =
          typeof lastResult?.result === "number" ? lastResult.result : 0;
      }

      setQueueEntries(queueLens);
      setResultKeys(rKeys);
      setUnackedCount(unacked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Celery data");
    } finally {
      setLoading(false);
    }
  }, [dbId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPending = queueEntries.reduce((s, q) => s + q.length, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RefreshBar label="Celery" loading={loading} onRefresh={load} />

      {loading && queueEntries.length === 0 && resultKeys.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Discovering Celery queues…" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message={error} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Queues"
                value={queueEntries.length}
                color="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                label="Pending Tasks"
                value={totalPending}
                color="text-yellow-600 dark:text-yellow-400"
              />
              <StatCard
                label="Task Results"
                value={resultKeys.length}
                color="text-green-600 dark:text-green-400"
              />
              <StatCard
                label="Unacked"
                value={unackedCount}
                color="text-orange-600 dark:text-orange-400"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setActiveTab("queues");
                  setSelectedQueue(null);
                }}
                className={cn(
                  "text-xs px-2.5 py-1 rounded border transition-colors",
                  activeTab === "queues"
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                Queues
                <span className="ml-1.5 font-mono">{queueEntries.length}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("results");
                  setSelectedQueue(null);
                }}
                className={cn(
                  "text-xs px-2.5 py-1 rounded border transition-colors",
                  activeTab === "results"
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                Task Results
                <span className="ml-1.5 font-mono">{resultKeys.length}</span>
              </button>
            </div>

            {/* Queues tab */}
            {activeTab === "queues" && (
              <div className="space-y-3">
                <SectionHeader>Queues</SectionHeader>
                {queueEntries.length === 0 ? (
                  <EmptyState label="No Celery queues found (no _kombu.binding.* keys)" />
                ) : (
                  <div className="rounded border overflow-hidden">
                    <TableHeader cols={["Queue", "Pending"]} />
                    <div className="divide-y">
                      {queueEntries.map((q) => (
                        <div key={q.name}>
                          <button
                            className="w-full text-left flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/40 transition-colors"
                            onClick={() =>
                              setSelectedQueue((p) =>
                                p === q.name ? null : q.name
                              )
                            }
                          >
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                                selectedQueue === q.name && "rotate-90"
                              )}
                            />
                            <span className="flex-1 text-xs font-mono">
                              {q.name}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {q.length}
                            </span>
                          </button>
                          {selectedQueue === q.name && (
                            <div className="mx-3 mb-2">
                              <CeleryQueueDetail
                                dbId={dbId}
                                queueName={q.name}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results tab */}
            {activeTab === "results" && (
              <div className="space-y-3">
                <SectionHeader>Task Results</SectionHeader>
                <CeleryResultsTable dbId={dbId} resultKeys={resultKeys} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Namespace Explorer
// ─────────────────────────────────────────────────────────────────────────────

interface NamespaceNode {
  name: string;
  fullPrefix: string;
  count: number;
  children: Map<string, NamespaceNode>;
  keys: string[];
}

function buildNamespaceTree(keys: string[]): NamespaceNode {
  const root: NamespaceNode = {
    name: "",
    fullPrefix: "",
    count: 0,
    children: new Map(),
    keys: [],
  };

  for (const key of keys) {
    const parts = key.split(":");
    let node = root;
    node.count++;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          fullPrefix: parts.slice(0, i + 1).join(":") + ":",
          count: 0,
          children: new Map(),
          keys: [],
        });
      }
      const child = node.children.get(part)!;
      child.count++;
      node = child;
    }

    // last segment is the leaf key at this node level
    node.keys.push(key);
  }

  return root;
}

function filterTree(root: NamespaceNode, pattern: string): NamespaceNode {
  if (!pattern) return root;
  const lower = pattern.toLowerCase();
  const filtered: NamespaceNode = {
    name: root.name,
    fullPrefix: root.fullPrefix,
    count: 0,
    children: new Map(),
    keys: root.keys.filter((k) => k.toLowerCase().includes(lower)),
  };
  filtered.count += filtered.keys.length;

  for (const [name, child] of root.children) {
    const filteredChild = filterTree(child, pattern);
    if (filteredChild.count > 0) {
      filtered.children.set(name, filteredChild);
      filtered.count += filteredChild.count;
    }
  }
  return filtered;
}

interface KeyDetailState {
  loading: boolean;
  type: string | null;
  ttl: number | null;
  value: unknown;
  error: string | null;
}

function KeyDetail({
  dbId,
  keyName,
  onDelete,
}: {
  dbId: string;
  keyName: string;
  onDelete: () => void;
}) {
  const [state, setState] = useState<KeyDetailState>({
    loading: true,
    type: null,
    ttl: null,
    value: null,
    error: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [ttlEdit, setTtlEdit] = useState("");
  const [savingTtl, setSavingTtl] = useState(false);

  const load = useCallback(async () => {
    setState({ loading: true, type: null, ttl: null, value: null, error: null });
    try {
      const [typeRes, ttlRes] = await Promise.all([
        executeCommand(dbId, ["TYPE", keyName]),
        executeCommand(dbId, ["TTL", keyName]),
      ]);
      const type = String(typeRes.result ?? "none");
      const ttl = typeof ttlRes.result === "number" ? ttlRes.result : -1;

      let value: unknown = null;
      if (type === "string") {
        const r = await executeCommand(dbId, ["GET", keyName]);
        value = r.result;
      } else if (type === "hash") {
        const r = await executeCommand(dbId, ["HGETALL", keyName]);
        const flat = Array.isArray(r.result) ? (r.result as string[]) : [];
        const map: Record<string, string> = {};
        for (let i = 0; i + 1 < flat.length; i += 2) map[flat[i]] = flat[i + 1];
        value = map;
      } else if (type === "list") {
        const r = await executeCommand(dbId, ["LRANGE", keyName, "0", "49"]);
        value = r.result;
      } else if (type === "set") {
        const r = await executeCommand(dbId, ["SMEMBERS", keyName]);
        value = r.result;
      } else if (type === "zset") {
        const r = await executeCommand(dbId, ["ZRANGE", keyName, "0", "49", "WITHSCORES"]);
        value = r.result;
      } else if (type === "stream") {
        const r = await executeCommand(dbId, ["XREVRANGE", keyName, "+", "-", "COUNT", "10"]);
        value = r.result;
      }

      setState({ loading: false, type, ttl, value, error: null });
      setTtlEdit(ttl >= 0 ? String(ttl) : "");
    } catch (err) {
      setState({
        loading: false,
        type: null,
        ttl: null,
        value: null,
        error: err instanceof Error ? err.message : "Failed to load key",
      });
    }
  }, [dbId, keyName]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await executeCommand(dbId, ["DEL", keyName]);
      setDeleted(true);
      onDelete();
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveTtl = async () => {
    const seconds = parseInt(ttlEdit, 10);
    if (isNaN(seconds)) return;
    setSavingTtl(true);
    try {
      if (seconds < 0) {
        await executeCommand(dbId, ["PERSIST", keyName]);
      } else {
        await executeCommand(dbId, ["EXPIRE", keyName, String(seconds)]);
      }
      await load();
    } catch {
      // silently fail
    } finally {
      setSavingTtl(false);
    }
  };

  if (state.loading) return <LoadingState label="Loading key…" />;
  if (deleted)
    return (
      <div className="px-3 py-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5" />
        Key deleted
      </div>
    );
  if (state.error) return <ErrorState message={state.error} />;

  const typeColors: Record<string, string> = {
    string: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    hash: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    list: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
    set: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    zset: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    stream: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    none: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-3">
      {/* Type + TTL + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {state.type && (
          <StatusBadge
            status={state.type}
            colorClass={typeColors[state.type] ?? typeColors.none}
          />
        )}
        <span className="text-xs text-muted-foreground font-mono">
          TTL:{" "}
          {state.ttl === -1
            ? "no expiry"
            : state.ttl === -2
            ? "does not exist"
            : `${state.ttl}s`}
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <input
            className="h-6 w-20 rounded border bg-background px-2 text-xs font-mono focus:outline-none"
            placeholder="TTL (s)"
            value={ttlEdit}
            onChange={(e) => setTtlEdit(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            disabled={savingTtl || ttlEdit === ""}
            onClick={() => void handleSaveTtl()}
          >
            {savingTtl ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set TTL"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
          </Button>
        </div>
      </div>
      {/* Value */}
      <JsonBlock value={state.value} />
    </div>
  );
}

function NamespaceTreeNode({
  node,
  depth,
  selectedKey,
  onSelectKey,
}: {
  node: NamespaceNode;
  depth: number;
  selectedKey: string | null;
  onSelectKey: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const indent = depth * 16;

  const sortedChildren = Array.from(node.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div>
      {/* Namespace folder row — only render for non-root */}
      {depth > 0 && (
        <button
          className="w-full text-left flex items-center gap-1 py-1 hover:bg-accent/40 transition-colors"
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => setExpanded((p) => !p)}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
              expanded && "rotate-90"
            )}
          />
          <span className="text-xs font-mono text-foreground/80 truncate flex-1 min-w-0">
            {node.name}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground mr-2 shrink-0">
            {node.count}
          </span>
        </button>
      )}

      {(depth === 0 || expanded) && (
        <>
          {sortedChildren.map((child) => (
            <NamespaceTreeNode
              key={child.fullPrefix}
              node={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelectKey={onSelectKey}
            />
          ))}
          {node.keys.map((key) => (
            <button
              key={key}
              className={cn(
                "w-full text-left flex items-center gap-1 py-1 transition-colors",
                selectedKey === key
                  ? "bg-accent text-foreground"
                  : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"
              )}
              style={{ paddingLeft: `${indent + (depth > 0 ? 16 : 4)}px` }}
              onClick={() => onSelectKey(key)}
            >
              <span className="text-[10px] text-muted-foreground shrink-0">—</span>
              <span className="text-xs font-mono truncate flex-1 min-w-0">{key}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

const MAX_SCAN_KEYS = 10_000;

export function KeyNamespaceView({ dbId }: { dbId: string }) {
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState(0);
  const [splitPct, setSplitPct] = useState(50);
  const splitRef = useRef<HTMLDivElement>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setAllKeys([]);
    setScanCount(0);
    setTruncated(false);
    setSelectedKey(null);

    const collected: string[] = [];
    try {
      let cursor = "0";
      do {
        const res = await executeCommand(dbId, ["SCAN", cursor, "COUNT", "500"]);
        if (!Array.isArray(res.result)) break;
        const [nextCursor, keys] = res.result as [string, string[]];
        cursor = String(nextCursor);
        if (Array.isArray(keys)) {
          for (const k of keys) {
            if (collected.length >= MAX_SCAN_KEYS) {
              setTruncated(true);
              cursor = "0"; // force stop
              break;
            }
            collected.push(k);
          }
        }
        setScanCount(collected.length);
      } while (cursor !== "0");

      setAllKeys([...collected]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [dbId]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const tree = buildNamespaceTree(allKeys);
  const filteredTree = filterTree(tree, filter);

  // Top 5 namespaces by count (only top-level children)
  const topNamespaces = Array.from(tree.children.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const handleKeyDeleted = () => {
    setAllKeys((prev) => prev.filter((k) => k !== selectedKey));
    setSelectedKey(null);
  };

  const handleSelectKey = (key: string) => {
    setSelectedKey(key);
    setDetailKey((n) => n + 1);
  };

  const handleSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const startX = e.clientX;
    const startPct = splitPct;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newPct = startPct + (delta / rect.width) * 100;
      setSplitPct(Math.max(20, Math.min(80, newPct)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [splitPct]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b">
        <p className="text-xs font-medium text-muted-foreground shrink-0">
          Key Namespace Explorer
        </p>
        {scanning ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Scanning… {scanCount.toLocaleString()} keys found
          </span>
        ) : allKeys.length > 0 ? (
          <span className="text-xs text-muted-foreground ml-2 font-mono">
            {allKeys.length.toLocaleString()} keys
          </span>
        ) : null}
        <div className="flex-1" />
        <input
          className="h-7 rounded border bg-background px-2 text-xs font-mono w-40 focus:outline-none"
          placeholder="Filter keys…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => void scan()}
          disabled={scanning}
        >
          {scanning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>

      {/* Truncation warning */}
      {truncated && (
        <div className="shrink-0 px-4 py-1.5 bg-yellow-500/10 border-b border-yellow-500/30 text-xs text-yellow-700 dark:text-yellow-400">
          Showing first {MAX_SCAN_KEYS.toLocaleString()} keys. Use the filter for more specific results.
        </div>
      )}

      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message={error} />
        </div>
      ) : scanning && allKeys.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Scanning keyspace…" />
        </div>
      ) : (
        <div ref={splitRef} className="flex-1 flex overflow-hidden">
          {/* Tree panel */}
          <div
            className="overflow-y-auto flex-shrink-0"
            style={{ width: selectedKey ? `${splitPct}%` : "100%" }}
          >
            {allKeys.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState label="No keys found" />
              </div>
            ) : (
              <>
                {topNamespaces.length > 0 && (
                  <div className="border-b px-3 py-2 bg-muted/20">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Top namespaces
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {topNamespaces.map((ns) => (
                        <span key={ns.fullPrefix} className="text-xs font-mono text-muted-foreground">
                          <span className="text-foreground">{ns.name}:</span>{" "}
                          {ns.count.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="px-2 py-1">
                  <NamespaceTreeNode
                    node={filteredTree}
                    depth={0}
                    selectedKey={selectedKey}
                    onSelectKey={handleSelectKey}
                  />
                </div>
              </>
            )}
          </div>

          {/* Resize handle + Detail panel */}
          {selectedKey && (
            <>
              <div
                onMouseDown={handleSplitResize}
                className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-ring transition-colors"
              />
              <div className="flex-1 overflow-y-auto min-w-0 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Key</p>
                    <p className="text-xs font-mono break-all">{selectedKey}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setSelectedKey(null)}
                    title="Close panel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <KeyDetail
                    key={detailKey}
                    dbId={dbId}
                    keyName={selectedKey}
                    onDelete={handleKeyDeleted}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Consumer Groups
// ─────────────────────────────────────────────────────────────────────────────

function parseXinfoFlat(raw: unknown): Record<string, unknown> {
  const flat = Array.isArray(raw) ? (raw as unknown[]) : [];
  const map: Record<string, unknown> = {};
  for (let i = 0; i + 1 < flat.length; i += 2) {
    map[String(flat[i])] = flat[i + 1];
  }
  return map;
}

interface StreamGroup {
  name: string;
  consumers: number;
  pending: number;
  lastDeliveredId: string;
  entriesRead: number | null;
  lag: number | null;
}

interface StreamConsumer {
  name: string;
  pending: number;
  idle: number;
}

interface StreamPending {
  id: string;
  consumer: string;
  idleMs: number;
  deliveryCount: number;
}

interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

function parseGroups(raw: unknown): StreamGroup[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((item) => {
    const g = parseXinfoFlat(item);
    return {
      name: String(g["name"] ?? ""),
      consumers: typeof g["consumers"] === "number" ? g["consumers"] : 0,
      pending: typeof g["pending"] === "number" ? g["pending"] : 0,
      lastDeliveredId: String(g["last-delivered-id"] ?? ""),
      entriesRead:
        typeof g["entries-read"] === "number" ? g["entries-read"] : null,
      lag: typeof g["lag"] === "number" ? g["lag"] : null,
    };
  });
}

function parseConsumers(raw: unknown): StreamConsumer[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((item) => {
    const c = parseXinfoFlat(item);
    return {
      name: String(c["name"] ?? ""),
      pending: typeof c["pending"] === "number" ? c["pending"] : 0,
      idle: typeof c["idle"] === "number" ? c["idle"] : 0,
    };
  });
}

function parsePending(raw: unknown): StreamPending[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((item) => {
    const arr = Array.isArray(item) ? (item as unknown[]) : [];
    return {
      id: String(arr[0] ?? ""),
      consumer: String(arr[1] ?? ""),
      idleMs: typeof arr[2] === "number" ? arr[2] : 0,
      deliveryCount: typeof arr[3] === "number" ? arr[3] : 0,
    };
  });
}

function parseStreamEntries(raw: unknown): StreamEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((item) => {
    const arr = Array.isArray(item) ? (item as unknown[]) : [];
    const id = String(arr[0] ?? "");
    const fieldArr = Array.isArray(arr[1]) ? (arr[1] as string[]) : [];
    const fields: Record<string, string> = {};
    for (let i = 0; i + 1 < fieldArr.length; i += 2) {
      fields[fieldArr[i]] = fieldArr[i + 1];
    }
    return { id, fields };
  });
}

function fmtIdle(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

function StreamGroupDetail({
  dbId,
  stream,
  group,
}: {
  dbId: string;
  stream: string;
  group: string;
}) {
  const [consumers, setConsumers] = useState<StreamConsumer[]>([]);
  const [pending, setPending] = useState<StreamPending[]>([]);
  const [loading, setLoading] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [consRes, pelRes] = await Promise.all([
        executeCommand(dbId, ["XINFO", "CONSUMERS", stream, group]),
        executeCommand(dbId, ["XPENDING", stream, group, "-", "+", "50"]),
      ]);
      setConsumers(parseConsumers(consRes.result));
      setPending(parsePending(pelRes.result));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [dbId, stream, group]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAck = async (id: string) => {
    setAckingId(id);
    try {
      await executeCommand(dbId, ["XACK", stream, group, id]);
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // silently fail
    } finally {
      setAckingId(null);
    }
  };

  if (loading) return <LoadingState label="Loading group details…" />;

  return (
    <div className="space-y-4 p-3">
      {/* Consumers */}
      <div>
        <SectionHeader>Consumers</SectionHeader>
        {consumers.length === 0 ? (
          <EmptyState label="No consumers" />
        ) : (
          <div className="rounded border overflow-hidden">
            <TableHeader cols={["Consumer", "Pending", "Idle"]} />
            <div className="divide-y">
              {consumers.map((c) => (
                <div
                  key={c.name}
                  className="grid grid-cols-3 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono truncate">{c.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {c.pending}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {fmtIdle(c.idle)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pending Entry List */}
      <div>
        <SectionHeader>Pending Entries (PEL)</SectionHeader>
        {pending.length === 0 ? (
          <EmptyState label="No pending entries" />
        ) : (
          <table className="w-full text-xs rounded border overflow-hidden">
            <thead>
              <tr className="bg-muted/50 text-[11px] font-medium text-muted-foreground">
                <th className="px-3 py-1.5 text-left">Entry ID</th>
                <th className="px-3 py-1.5 text-left">Consumer</th>
                <th className="px-3 py-1.5 text-left w-20">Idle</th>
                <th className="px-3 py-1.5 text-left w-20">Deliveries</th>
                <th className="px-3 py-1.5 text-left w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pending.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground truncate max-w-0">
                    {p.id}
                  </td>
                  <td className="px-3 py-1.5 font-mono truncate max-w-0">
                    {p.consumer}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {fmtIdle(p.idleMs)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {p.deliveryCount}
                  </td>
                  <td className="px-3 py-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                      disabled={ackingId === p.id}
                      onClick={() => void handleAck(p.id)}
                    >
                      {ackingId === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "ACK"
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StreamDashboard({
  dbId,
  stream,
}: {
  dbId: string;
  stream: string;
}) {
  const [streamLength, setStreamLength] = useState<number | null>(null);
  const [streamInfo, setStreamInfo] = useState<Record<string, unknown>>({});
  const [groups, setGroups] = useState<StreamGroup[]>([]);
  const [entries, setEntries] = useState<StreamEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lenRes, infoRes, groupsRes, entriesRes] = await Promise.all([
        executeCommand(dbId, ["XLEN", stream]),
        executeCommand(dbId, ["XINFO", "STREAM", stream]),
        executeCommand(dbId, ["XINFO", "GROUPS", stream]),
        executeCommand(dbId, ["XREVRANGE", stream, "+", "-", "COUNT", "20"]),
      ]);

      setStreamLength(
        typeof lenRes.result === "number" ? lenRes.result : null
      );
      setStreamInfo(parseXinfoFlat(infoRes.result));
      setGroups(parseGroups(groupsRes.result));
      setEntries(parseStreamEntries(entriesRes.result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }, [dbId, stream]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && groups.length === 0)
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingState label="Loading stream…" />
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center p-8">
        <ErrorState message={error} />
      </div>
    );

  const firstEntry = streamInfo["first-entry"];
  const lastEntry = streamInfo["last-entry"];
  const firstId = Array.isArray(firstEntry) ? String(firstEntry[0] ?? "—") : "—";
  const lastId = Array.isArray(lastEntry) ? String(lastEntry[0] ?? "—") : "—";

  return (
    <div className="p-4 space-y-5">
      {/* Stream info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Length"
          value={streamLength ?? "—"}
          color="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Groups"
          value={groups.length}
          color="text-purple-600 dark:text-purple-400"
        />
        <StatCard label="First Entry" value={firstId} />
        <StatCard label="Last Entry" value={lastId} />
      </div>

      {/* Consumer Groups table */}
      <div>
        <SectionHeader>Consumer Groups</SectionHeader>
        {groups.length === 0 ? (
          <EmptyState label="No consumer groups" />
        ) : (
          <div className="rounded border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-[11px] font-medium text-muted-foreground">
                  <th className="w-6 px-3 py-1.5"></th>
                  <th className="px-3 py-1.5 text-left">Group</th>
                  <th className="px-3 py-1.5 text-left w-24">Consumers</th>
                  <th className="px-3 py-1.5 text-left w-24">Pending</th>
                  <th className="px-3 py-1.5 text-left">Last Delivered ID</th>
                  <th className="px-3 py-1.5 text-left w-16">Lag</th>
                </tr>
              </thead>
              <tbody className="divide-y">
              {groups.map((g) => (
                <Fragment key={g.name}>
                <tr>
                  <td colSpan={6} className="p-0">
                  <button
                    className="w-full text-left flex items-center px-3 py-1.5 hover:bg-accent/40 transition-colors text-xs"
                    onClick={() =>
                      setExpandedGroup((p) => (p === g.name ? null : g.name))
                    }
                  >
                    <span className="w-6 shrink-0">
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform",
                          expandedGroup === g.name && "rotate-90"
                        )}
                      />
                    </span>
                    <span className="flex-1 min-w-0 font-mono truncate">{g.name}</span>
                    <span className="w-24 font-mono text-muted-foreground shrink-0">
                      {g.consumers}
                    </span>
                    <span
                      className={cn(
                        "w-24 font-mono shrink-0",
                        g.pending > 0
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {g.pending}
                    </span>
                    <span className="flex-1 min-w-0 font-mono text-muted-foreground truncate">
                      {g.lastDeliveredId || "—"}
                    </span>
                    <span className="w-16 font-mono text-muted-foreground shrink-0">
                      {g.lag !== null ? g.lag : "—"}
                    </span>
                  </button>
                  </td>
                </tr>
                {expandedGroup === g.name && (
                <tr>
                  <td colSpan={6} className="p-0 border-t bg-muted/10">
                    <StreamGroupDetail
                      dbId={dbId}
                      stream={stream}
                      group={g.name}
                    />
                  </td>
                </tr>
                )}
                </Fragment>
              ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent entries */}
      <div>
        <SectionHeader>Recent Entries (last 20)</SectionHeader>
        {entries.length === 0 ? (
          <EmptyState label="No entries" />
        ) : (
          <div className="rounded border overflow-hidden divide-y">
            {entries.map((e) => (
              <div key={e.id} className="px-3 py-2">
                <p className="text-[11px] font-mono text-muted-foreground mb-1">
                  {e.id}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {Object.entries(e.fields).map(([k, v]) => (
                    <span key={k} className="text-xs">
                      <span className="text-muted-foreground font-medium">
                        {k}:{" "}
                      </span>
                      <span className="font-mono">{truncate(v, 120)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StreamGroupsView({ dbId }: { dbId: string }) {
  const [streams, setStreams] = useState<string[]>([]);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Full SCAN to find candidate keys, then pipeline TYPE
      const allKeys: string[] = [];
      let cursor = "0";
      do {
        const res = await executeCommand(dbId, ["SCAN", cursor, "COUNT", "500"]);
        if (!Array.isArray(res.result)) break;
        const [nextCursor, keys] = res.result as [string, string[]];
        cursor = String(nextCursor);
        if (Array.isArray(keys)) {
          for (const k of keys) {
            if (allKeys.length >= MAX_SCAN_KEYS) { cursor = "0"; break; }
            allKeys.push(k);
          }
        }
      } while (cursor !== "0");

      if (allKeys.length === 0) {
        setStreams([]);
        return;
      }

      // Pipeline TYPE for all keys
      const typeResults = await executePipeline(
        dbId,
        allKeys.map((k) => ["TYPE", k])
      );

      const streamKeys = allKeys.filter(
        (_, i) => typeResults[i]?.result === "stream"
      );
      streamKeys.sort();
      setStreams(streamKeys);

      if (streamKeys.length > 0 && selectedStream === null) {
        setSelectedStream(streamKeys[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }, [dbId, selectedStream]);

  useEffect(() => {
    void discover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RefreshBar label="Stream Consumer Groups" loading={loading} onRefresh={discover} />

      {loading && streams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Discovering stream keys…" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message={error} />
        </div>
      ) : streams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState label="No stream keys found" />
        </div>
      ) : (
        <>
          <QueuePills
            queues={streams}
            selected={selectedStream}
            onSelect={setSelectedStream}
          />
          <div className="flex-1 overflow-y-auto">
            {selectedStream ? (
              <StreamDashboard dbId={dbId} stream={selectedStream} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <EmptyState label="Select a stream" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
