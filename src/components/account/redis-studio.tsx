"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Copy,
  Database,
  Eye,
  EyeOff,
  Globe,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthGate } from "@/components/layout/auth-gate";
import {
  getRedisDetail,
  executeCommand,
  executePipeline,
  type RedisDetail,
} from "@/lib/redis";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

type RedisKeyType = "string" | "hash" | "list" | "set" | "zset" | "stream" | "unknown";

interface RedisKey {
  name: string;
  type: RedisKeyType;
  ttl: number; // -1 = no expiry, -2 = does not exist, >=0 = seconds
}

interface HashEntry {
  field: string;
  value: string;
}

interface ZsetEntry {
  member: string;
  score: string;
}

interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

interface KeyValue {
  type: RedisKeyType;
  ttl: number;
  value:
    | string
    | null
    | HashEntry[]
    | string[]
    | ZsetEntry[]
    | StreamEntry[];
}

interface HistoryEntry {
  command: string;
  result: string;
  error: boolean;
  ts: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTtl(ttl: number): string {
  if (ttl < 0) return "No expiry";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
}

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return "(nil)";
  if (typeof result === "string") return result;
  if (typeof result === "number") return String(result);
  return JSON.stringify(result, null, 2);
}

function parseCommand(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

// ── Type Badge ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<RedisKeyType, string> = {
  string:
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  hash: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  list: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  set: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  zset: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30",
  stream:
    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  unknown:
    "bg-muted text-muted-foreground border-border",
};

function TypeBadge({ type }: { type: RedisKeyType }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${TYPE_COLORS[type]}`}
    >
      {type}
    </span>
  );
}

// ── Connection Info Dialog ────────────────────────────────────────────────────

function ConnectionInfoDialog({
  db,
  open,
  onOpenChange,
}: {
  db: RedisDetail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const copyValue = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  function CopyBtn({ field, value }: { field: string; value: string }) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => copyValue(value, field)}
        title={`Copy ${field}`}
      >
        {copiedField === field ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  }

  const host = db.endpoint.replace(/^https?:\/\//, "");
  const redisUrl = `redis://default:${db.password}@${host}:6379`;
  const obfuscatedUrl = `redis://default:${"•".repeat(8)}@${host}:6379`;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRevealed(false); setCopiedField(null); } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-muted-foreground" />
            Connection Details — {db.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 min-w-0 overflow-hidden">
          {/* Redis URL */}
          <div className="space-y-1.5 min-w-0">
            <label className="text-xs font-medium text-muted-foreground">Redis URL</label>
            <div className="flex items-center gap-1.5 min-w-0">
              <code className="flex-1 min-w-0 block rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all leading-relaxed select-all overflow-hidden">
                {revealed ? redisUrl : obfuscatedUrl}
              </code>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setRevealed((v) => !v)}
                  title={revealed ? "Hide password" : "Show password"}
                >
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <CopyBtn field="redis-url" value={redisUrl} />
              </div>
            </div>
          </div>

          {/* Individual fields */}
          <div className="rounded-md border divide-y min-w-0 overflow-hidden">
            {([
              ["Host", host, "host"],
              ["Port", "6379", "port"],
              ["Password", revealed ? db.password : "••••••••", "password"],
              ["REST Endpoint", db.endpoint, "endpoint"],
              ["REST Token", db.restToken, "token"],
              ["Region", db.region, "region"],
            ] as [string, string, string][]).map(([label, value, key]) => (
              <div
                key={key}
                className="flex items-center gap-3 px-3 py-2 text-xs min-w-0"
              >
                <span className="w-24 shrink-0 text-muted-foreground font-medium">
                  {label}
                </span>
                <code className="flex-1 min-w-0 font-mono text-foreground truncate select-all">
                  {value}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() =>
                    copyValue(
                      key === "password" ? db.password : value,
                      key
                    )
                  }
                  title={`Copy ${label.toLowerCase()}`}
                >
                  {copiedField === key ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── TTL Badge ─────────────────────────────────────────────────────────────────

function TtlBadge({ ttl }: { ttl: number }) {
  if (ttl < 0) return null;
  return (
    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
      TTL {formatTtl(ttl)}
    </span>
  );
}

// ── Value Viewers ──────────────────────────────────────────────────────────

function StringViewer({ value }: { value: string | null }) {
  if (value === null) {
    return <p className="text-xs text-muted-foreground italic">(nil)</p>;
  }

  let parsed: unknown = null;
  let isJson = false;
  try {
    parsed = JSON.parse(value);
    isJson = true;
  } catch {
    isJson = false;
  }

  if (isJson) {
    return (
      <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto whitespace-pre-wrap break-all">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  }

  return (
    <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto whitespace-pre-wrap break-all">
      {value}
    </pre>
  );
}

function HashViewer({ entries }: { entries: HashEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Empty hash</p>;
  }
  return (
    <div className="rounded border overflow-hidden text-xs">
      <div className="grid grid-cols-2 bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground">
        <span>Field</span>
        <span>Value</span>
      </div>
      <div className="divide-y">
        {entries.map((e) => (
          <div key={e.field} className="grid grid-cols-2 px-3 py-1.5 gap-2">
            <span className="font-mono truncate text-foreground">{e.field}</span>
            <span className="font-mono truncate text-muted-foreground">{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListViewer({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Empty list</p>;
  }
  return (
    <div className="rounded border overflow-hidden text-xs">
      <div className="grid grid-cols-[3rem,1fr] bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground">
        <span>Index</span>
        <span>Value</span>
      </div>
      <div className="divide-y">
        {items.map((v, i) => (
          <div key={i} className="grid grid-cols-[3rem,1fr] px-3 py-1.5 gap-2">
            <span className="font-mono text-muted-foreground">{i}</span>
            <span className="font-mono truncate text-foreground">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetViewer({ members }: { members: string[] }) {
  if (members.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Empty set</p>;
  }
  return (
    <div className="rounded border overflow-hidden text-xs">
      <div className="bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground">
        Member
      </div>
      <div className="divide-y">
        {members.map((m, i) => (
          <div key={i} className="px-3 py-1.5">
            <span className="font-mono text-foreground">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ZsetViewer({ entries }: { entries: ZsetEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Empty sorted set</p>;
  }
  return (
    <div className="rounded border overflow-hidden text-xs">
      <div className="grid grid-cols-2 bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground">
        <span>Member</span>
        <span>Score</span>
      </div>
      <div className="divide-y">
        {entries.map((e, i) => (
          <div key={i} className="grid grid-cols-2 px-3 py-1.5 gap-2">
            <span className="font-mono truncate text-foreground">{e.member}</span>
            <span className="font-mono text-muted-foreground">{e.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreamViewer({ entries }: { entries: StreamEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Empty stream</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.id} className="rounded border text-xs overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 font-mono font-medium text-foreground">
            {e.id}
          </div>
          <div className="divide-y">
            {Object.entries(e.fields).map(([k, v]) => (
              <div key={k} className="grid grid-cols-2 px-3 py-1.5 gap-2">
                <span className="font-mono text-muted-foreground truncate">{k}</span>
                <span className="font-mono text-foreground truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Studio Inner ─────────────────────────────────────────────────────────

function RedisStudioInner() {
  const params = useParams();
  const dbId = params.id as string;

  const [db, setDb] = useState<RedisDetail | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [connOpen, setConnOpen] = useState(false);

  // Key list state
  const [keys, setKeys] = useState<RedisKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [scanCursor, setScanCursor] = useState("0");
  const [hasMore, setHasMore] = useState(false);
  const [pattern, setPattern] = useState("*");
  const [patternInput, setPatternInput] = useState("*");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Selected key value state
  const [keyValue, setKeyValue] = useState<KeyValue | null>(null);
  const [keyValueLoading, setKeyValueLoading] = useState(false);
  const [rawMode, setRawMode] = useState(false);

  // TTL editing
  const [ttlEdit, setTtlEdit] = useState("");
  const [ttlEditing, setTtlEditing] = useState(false);
  const [ttlSaving, setTtlSaving] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  // Command console
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleRunning, setConsoleRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const consoleRef = useRef<HTMLInputElement>(null);

  // Load DB detail once
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDbLoading(true);
      try {
        const detail = await getRedisDetail(dbId);
        if (!cancelled) setDb(detail);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [dbId]);

  // Scan keys
  const scanKeys = useCallback(
    async (cursor: string, pat: string, append: boolean) => {
      setKeysLoading(true);
      try {
        const scanResult = await executeCommand(dbId, [
          "SCAN",
          cursor,
          "MATCH",
          pat,
          "COUNT",
          "100",
        ]);

        if (scanResult.error) {
          setKeysLoading(false);
          return;
        }

        const [nextCursor, keyNames] = scanResult.result as [string, string[]];

        if (keyNames.length === 0 && !append) {
          setKeys([]);
          setScanCursor(nextCursor);
          setHasMore(nextCursor !== "0");
          setKeysLoading(false);
          return;
        }

        // Fetch types in a pipeline
        const typeCommands = keyNames.map((k) => ["TYPE", k]);
        const ttlCommands = keyNames.map((k) => ["TTL", k]);

        const [typeResults, ttlResults] = await Promise.all([
          executePipeline(dbId, typeCommands),
          executePipeline(dbId, ttlCommands),
        ]);

        const newKeys: RedisKey[] = keyNames.map((name, i) => ({
          name,
          type: (typeResults[i]?.result as RedisKeyType) ?? "unknown",
          ttl: typeof ttlResults[i]?.result === "number"
            ? (ttlResults[i].result as number)
            : -1,
        }));

        setKeys((prev) => (append ? [...prev, ...newKeys] : newKeys));
        setScanCursor(nextCursor);
        setHasMore(nextCursor !== "0");
      } catch {
        // silently fail
      } finally {
        setKeysLoading(false);
      }
    },
    [dbId]
  );

  // Initial scan once DB is loaded
  useEffect(() => {
    if (!dbLoading && db) {
      void scanKeys("0", pattern, false);
    }
  }, [dbLoading, db, pattern, scanKeys]);

  // Load key value
  const loadKeyValue = useCallback(
    async (keyName: string) => {
      setKeyValueLoading(true);
      setKeyValue(null);
      try {
        const typeRes = await executeCommand(dbId, ["TYPE", keyName]);
        const ttlRes = await executeCommand(dbId, ["TTL", keyName]);

        const type = (typeRes.result as RedisKeyType) ?? "unknown";
        const ttl =
          typeof ttlRes.result === "number" ? ttlRes.result : -1;

        let value: KeyValue["value"] = null;

        if (type === "string") {
          const r = await executeCommand(dbId, ["GET", keyName]);
          value = typeof r.result === "string" ? r.result : null;
        } else if (type === "hash") {
          const r = await executeCommand(dbId, ["HGETALL", keyName]);
          const flat = r.result as string[];
          const entries: HashEntry[] = [];
          for (let i = 0; i + 1 < flat.length; i += 2) {
            entries.push({ field: flat[i], value: flat[i + 1] });
          }
          value = entries;
        } else if (type === "list") {
          const r = await executeCommand(dbId, ["LRANGE", keyName, "0", "199"]);
          value = (r.result as string[]) ?? [];
        } else if (type === "set") {
          const r = await executeCommand(dbId, ["SMEMBERS", keyName]);
          value = (r.result as string[]) ?? [];
        } else if (type === "zset") {
          const r = await executeCommand(dbId, [
            "ZRANGEBYSCORE",
            keyName,
            "-inf",
            "+inf",
            "WITHSCORES",
          ]);
          const flat = (r.result as string[]) ?? [];
          const entries: ZsetEntry[] = [];
          for (let i = 0; i + 1 < flat.length; i += 2) {
            entries.push({ member: flat[i], score: flat[i + 1] });
          }
          value = entries;
        } else if (type === "stream") {
          const r = await executeCommand(dbId, [
            "XRANGE",
            keyName,
            "-",
            "+",
            "COUNT",
            "100",
          ]);
          const raw = (r.result as Array<[string, string[]]>) ?? [];
          const entries: StreamEntry[] = raw.map(([id, fieldArr]) => {
            const fields: Record<string, string> = {};
            for (let i = 0; i + 1 < fieldArr.length; i += 2) {
              fields[fieldArr[i]] = fieldArr[i + 1];
            }
            return { id, fields };
          });
          value = entries;
        }

        setKeyValue({ type, ttl, value });
        setTtlEdit(ttl >= 0 ? String(ttl) : "");
        setTtlEditing(false);
      } catch {
        // silently fail
      } finally {
        setKeyValueLoading(false);
      }
    },
    [dbId]
  );

  useEffect(() => {
    if (selectedKey) {
      void loadKeyValue(selectedKey);
    }
  }, [selectedKey, loadKeyValue]);

  const handleSaveTtl = async () => {
    if (!selectedKey) return;
    setTtlSaving(true);
    try {
      const seconds = parseInt(ttlEdit, 10);
      if (isNaN(seconds) || ttlEdit.trim() === "") {
        await executeCommand(dbId, ["PERSIST", selectedKey]);
      } else {
        await executeCommand(dbId, ["EXPIRE", selectedKey, String(seconds)]);
      }
      await loadKeyValue(selectedKey);
      setTtlEditing(false);
    } catch {
      // silently fail
    } finally {
      setTtlSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!selectedKey) return;
    setDeleting(true);
    try {
      await executeCommand(dbId, ["DEL", selectedKey]);
      setKeys((prev) => prev.filter((k) => k.name !== selectedKey));
      setSelectedKey(null);
      setKeyValue(null);
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = () => {
    setKeys([]);
    setScanCursor("0");
    void scanKeys("0", pattern, false);
    if (selectedKey) void loadKeyValue(selectedKey);
  };

  const handlePatternSearch = () => {
    const p = patternInput.trim() || "*";
    setPattern(p);
    setKeys([]);
    setScanCursor("0");
    setSelectedKey(null);
    setKeyValue(null);
    void scanKeys("0", p, false);
  };

  const handleLoadMore = () => {
    void scanKeys(scanCursor, pattern, true);
  };

  // Console
  const runCommand = async () => {
    const raw = consoleInput.trim();
    if (!raw) return;
    const parts = parseCommand(raw);
    if (parts.length === 0) return;

    setConsoleRunning(true);
    setConsoleOutput("");

    const entry: HistoryEntry = {
      command: raw,
      result: "",
      error: false,
      ts: Date.now(),
    };

    try {
      const res = await executeCommand(dbId, parts);
      const output = res.error
        ? `(error) ${res.error}`
        : formatResult(res.result);
      entry.result = output;
      entry.error = !!res.error;
      setConsoleOutput(output);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      entry.result = `(error) ${msg}`;
      entry.error = true;
      setConsoleOutput(`(error) ${msg}`);
    } finally {
      setConsoleRunning(false);
    }

    setHistory((prev) => [entry, ...prev].slice(0, 20));
    setHistoryIndex(-1);
    setConsoleInput("");
  };

  const handleConsoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void runCommand();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      if (history[next]) setConsoleInput(history[next].command);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(historyIndex - 1, -1);
      setHistoryIndex(next);
      if (next === -1) {
        setConsoleInput("");
      } else if (history[next]) {
        setConsoleInput(history[next].command);
      }
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r flex flex-col overflow-hidden">
        {/* Sidebar header — matches database studio pattern */}
        <div className="px-3 py-2.5 border-b space-y-1.5">
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
              {dbLoading ? "Loading…" : (db?.name ?? dbId)}
            </span>
            {db && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setConnOpen(true)}
                title="Connection details"
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
              Redis
            </span>
            {db && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Globe className="h-3 w-3" />
                {db.region}
              </span>
            )}
          </div>
        </div>

        {/* Pattern search */}
        <div className="p-2 border-b flex items-center gap-1">
          <Input
            className="h-7 text-xs font-mono"
            placeholder="Pattern (e.g. user:*)"
            value={patternInput}
            onChange={(e) => setPatternInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePatternSearch();
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handlePatternSearch}
            disabled={keysLoading}
            title="Search"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleRefresh}
            disabled={keysLoading}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${keysLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Key list */}
        <div className="flex-1 overflow-y-auto">
          {keysLoading && keys.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-muted-foreground">No keys found</p>
            </div>
          ) : (
            <>
              {keys.map((key) => (
                <button
                  key={key.name}
                  className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedKey === key.name ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedKey(key.name)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TypeBadge type={key.type} />
                    {key.ttl >= 0 && (
                      <TtlBadge ttl={key.ttl} />
                    )}
                  </div>
                  <p className="text-xs font-mono truncate mt-0.5 text-foreground">
                    {key.name}
                  </p>
                </button>
              ))}
              {hasMore && (
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={handleLoadMore}
                    disabled={keysLoading}
                  >
                    {keysLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : null}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Key count footer */}
        {keys.length > 0 && (
          <div className="border-t px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground">
              {keys.length} key{keys.length !== 1 ? "s" : ""} loaded
            </p>
          </div>
        )}
      </aside>

      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Key inspector */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedKey ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
              <Database className="h-8 w-8 opacity-30" />
              <p className="text-sm">Select a key to inspect its value</p>
            </div>
          ) : keyValueLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : keyValue ? (
            <div className="space-y-4 max-w-3xl">
              {/* Key header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold font-mono break-all">
                      {selectedKey}
                    </h2>
                    <TypeBadge type={keyValue.type} />
                    {keyValue.ttl >= 0 && <TtlBadge ttl={keyValue.ttl} />}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 gap-1.5"
                    onClick={() => setRawMode((v) => !v)}
                  >
                    {rawMode ? "Formatted" : "Raw"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => void handleDeleteKey()}
                    disabled={deleting}
                    title="Delete key"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* TTL control */}
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground w-8 shrink-0">TTL</p>
                {ttlEditing ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      className="h-6 text-xs w-28 font-mono"
                      placeholder="seconds (empty = persist)"
                      value={ttlEdit}
                      onChange={(e) => setTtlEdit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveTtl();
                        if (e.key === "Escape") setTtlEditing(false);
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => void handleSaveTtl()}
                      disabled={ttlSaving}
                    >
                      {ttlSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setTtlEditing(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    onClick={() => setTtlEditing(true)}
                  >
                    {keyValue.ttl < 0 ? "No expiry" : formatTtl(keyValue.ttl)}
                  </button>
                )}
              </div>

              {/* Value */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Value</p>
                {rawMode ? (
                  <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto whitespace-pre-wrap break-all">
                    {formatResult(keyValue.value)}
                  </pre>
                ) : (
                  <>
                    {keyValue.type === "string" && (
                      <StringViewer value={keyValue.value as string | null} />
                    )}
                    {keyValue.type === "hash" && (
                      <HashViewer entries={keyValue.value as HashEntry[]} />
                    )}
                    {keyValue.type === "list" && (
                      <ListViewer items={keyValue.value as string[]} />
                    )}
                    {keyValue.type === "set" && (
                      <SetViewer members={keyValue.value as string[]} />
                    )}
                    {keyValue.type === "zset" && (
                      <ZsetViewer entries={keyValue.value as ZsetEntry[]} />
                    )}
                    {keyValue.type === "stream" && (
                      <StreamViewer entries={keyValue.value as StreamEntry[]} />
                    )}
                    {keyValue.type === "unknown" && (
                      <p className="text-xs text-muted-foreground italic">Unknown type</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Command console */}
        <div className="border-t shrink-0">
          {/* History strip */}
          {history.length > 0 && (
            <div className="border-b max-h-36 overflow-y-auto bg-muted/30">
              {history.map((h) => (
                <div
                  key={h.ts}
                  className="px-3 py-1.5 text-xs font-mono border-b last:border-b-0"
                >
                  <span className="text-muted-foreground mr-2">{">"}</span>
                  <span
                    className="cursor-pointer hover:underline underline-offset-2"
                    onClick={() => setConsoleInput(h.command)}
                  >
                    {h.command}
                  </span>
                  <div
                    className={`mt-0.5 pl-4 whitespace-pre-wrap break-all ${
                      h.error ? "text-destructive" : "text-foreground/70"
                    }`}
                  >
                    {h.result}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current output */}
          {consoleOutput && (
            <div className="px-3 py-2 text-xs font-mono bg-muted/20 border-b">
              <span className="text-muted-foreground mr-2">{"<"}</span>
              <span className="whitespace-pre-wrap break-all">{consoleOutput}</span>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-mono text-muted-foreground shrink-0">{">"}</span>
            <input
              ref={consoleRef}
              className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50"
              placeholder="Enter a Redis command (e.g. GET mykey)"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              onKeyDown={handleConsoleKeyDown}
              disabled={consoleRunning || dbLoading}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => void runCommand()}
              disabled={consoleRunning || !consoleInput.trim() || dbLoading}
              title="Run command"
            >
              {consoleRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {db && (
        <ConnectionInfoDialog
          db={db}
          open={connOpen}
          onOpenChange={setConnOpen}
        />
      )}
    </div>
  );
}

export function RedisStudio() {
  return (
    <AuthGate>
      <RedisStudioInner />
    </AuthGate>
  );
}
