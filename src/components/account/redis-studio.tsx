"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Eye,
  EyeOff,
  Globe,
  GripHorizontal,
  Link2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Terminal,
  X,
} from "lucide-react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthGate } from "@/components/layout/auth-gate";
import { useBillingStatus } from "@/lib/billing";
import { AiQueryBar } from "@/components/account/database-studio/ai-query-bar";
import type { AiSession } from "@/components/account/database-studio/types";
import {
  getRedisDetail,
  getRedisInfo,
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
import { cn } from "@/lib/utils";
import { BullMQView, SidekiqView, CeleryView, KeyNamespaceView, StreamGroupsView } from "@/components/account/redis-views";

// ── Types ────────────────────────────────────────────────────────────────────

type RedisKeyType =
  | "string"
  | "hash"
  | "list"
  | "set"
  | "zset"
  | "stream"
  | "unknown";

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

type RedisTabType = "query" | "metrics" | "monitor" | "bullmq" | "sidekiq" | "celery" | "namespaces" | "streams";

interface RedisTab {
  id: string;
  type: RedisTabType;
  title: string;
}

// Parsed Redis INFO section
interface InfoSection {
  name: string;
  entries: { key: string; value: string }[];
}

// Monitor snapshot
interface MonitorSnapshot {
  ts: number;
  keys: number;
  usedMemory: number;
  connectedClients: number;
  opsPerSec: number;
  hitRate: number;
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

function parseInfoResponse(raw: string): InfoSection[] {
  const sections: InfoSection[] = [];
  let currentSection: InfoSection | null = null;

  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("# ")) {
      if (currentSection) sections.push(currentSection);
      currentSection = { name: line.slice(2).trim(), entries: [] };
    } else if (line.includes(":") && currentSection) {
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key) currentSection.entries.push({ key, value });
    }
  }
  if (currentSection) sections.push(currentSection);
  return sections;
}

function extractInfoMetric(
  sections: InfoSection[],
  key: string
): string | null {
  for (const section of sections) {
    const entry = section.entries.find((e) => e.key === key);
    if (entry) return entry.value;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
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
  unknown: "bg-muted text-muted-foreground border-border",
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setRevealed(false);
          setCopiedField(null);
        }
      }}
    >
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
            <label className="text-xs font-medium text-muted-foreground">
              Redis URL
            </label>
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
                  {revealed ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <CopyBtn field="redis-url" value={redisUrl} />
              </div>
            </div>
          </div>

          {/* Individual fields */}
          <div className="rounded-md border divide-y min-w-0 overflow-hidden">
            {(
              [
                ["Host", host, "host"],
                ["Port", "6379", "port"],
                ["Password", revealed ? db.password : "••••••••", "password"],
                ["REST Endpoint", db.endpoint, "endpoint"],
                ["REST Token", db.restToken, "token"],
                ["Region", db.region, "region"],
              ] as [string, string, string][]
            ).map(([label, value, key]) => (
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
                    copyValue(key === "password" ? db.password : value, key)
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
            <span className="font-mono truncate text-muted-foreground">
              {e.value}
            </span>
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
    return (
      <p className="text-xs text-muted-foreground italic">Empty sorted set</p>
    );
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
            <span className="font-mono truncate text-foreground">
              {e.member}
            </span>
            <span className="font-mono text-muted-foreground">{e.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreamViewer({ entries }: { entries: StreamEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">Empty stream</p>
    );
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
                <span className="font-mono text-muted-foreground truncate">
                  {k}
                </span>
                <span className="font-mono text-foreground truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Key Value Panel (shared by query tab SCAN results) ─────────────────────────

interface KeyPanelProps {
  dbId: string;
  keyName: string;
  onClose: () => void;
}

function KeyPanel({ dbId, keyName, onClose }: KeyPanelProps) {
  const [keyValue, setKeyValue] = useState<KeyValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [ttlEdit, setTtlEdit] = useState("");
  const [ttlEditing, setTtlEditing] = useState(false);
  const [ttlSaving, setTtlSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const loadKeyValue = useCallback(async () => {
    setLoading(true);
    setKeyValue(null);
    try {
      const typeRes = await executeCommand(dbId, ["TYPE", keyName]);
      const ttlRes = await executeCommand(dbId, ["TTL", keyName]);

      const type = (typeRes.result as RedisKeyType) ?? "unknown";
      const ttl = typeof ttlRes.result === "number" ? ttlRes.result : -1;

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
      setLoading(false);
    }
  }, [dbId, keyName]);

  useEffect(() => {
    void loadKeyValue();
  }, [loadKeyValue]);

  const handleSaveTtl = async () => {
    setTtlSaving(true);
    try {
      const seconds = parseInt(ttlEdit, 10);
      if (isNaN(seconds) || ttlEdit.trim() === "") {
        await executeCommand(dbId, ["PERSIST", keyName]);
      } else {
        await executeCommand(dbId, ["EXPIRE", keyName, String(seconds)]);
      }
      await loadKeyValue();
      setTtlEditing(false);
    } catch {
      // silently fail
    } finally {
      setTtlSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    setDeleting(true);
    try {
      await executeCommand(dbId, ["DEL", keyName]);
      setDeleted(true);
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  if (deleted) {
    return (
      <div className="rounded border p-4 text-xs text-muted-foreground italic">
        Key deleted.{" "}
        <button
          className="underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading key...
      </div>
    );
  }

  if (!keyValue) return null;

  return (
    <div className="rounded border overflow-hidden">
      {/* Key header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <TypeBadge type={keyValue.type} />
        {keyValue.ttl >= 0 && <TtlBadge ttl={keyValue.ttl} />}
        <span className="text-xs font-mono font-medium truncate flex-1 min-w-0">
          {keyName}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setRawMode((v) => !v)}
          >
            {rawMode ? "Formatted" : "Raw"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => void loadKeyValue()}
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => void handleDeleteKey()}
            disabled={deleting}
            title="Delete key"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
            title="Close panel"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* TTL row */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/10">
        <p className="text-[11px] text-muted-foreground w-8 shrink-0">TTL</p>
        {ttlEditing ? (
          <div className="flex items-center gap-1.5">
            <Input
              className="h-6 text-xs w-32 font-mono"
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
      <div className="p-3">
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
              <p className="text-xs text-muted-foreground italic">
                Unknown type
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Query Tab Result ─────────────────────────────────────────────────────────

interface ScanResult {
  cursor: string;
  keys: string[];
}

function isScanResult(result: unknown): result is [string, string[]] {
  return (
    Array.isArray(result) &&
    result.length === 2 &&
    typeof result[0] === "string" &&
    Array.isArray(result[1])
  );
}

interface QueryResultAreaProps {
  dbId: string;
  result: unknown;
  error: string | null;
  loading: boolean;
  /** Extra args from the SCAN command (e.g. MATCH, COUNT) for pagination */
  scanExtraArgs?: string[];
}

function QueryResultArea({
  dbId,
  result,
  error,
  loading,
  scanExtraArgs = [],
}: QueryResultAreaProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState(0);
  const [scanKeys, setScanKeys] = useState<string[]>([]);
  const [scanCursor, setScanCursor] = useState<string>("0");
  const [scanArgs, setScanArgs] = useState<string[]>(scanExtraArgs);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMaxItems, setScanMaxItems] = useState(5000);
  const [splitPct, setSplitPct] = useState(33);
  const splitRef = useRef<HTMLDivElement>(null);

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
      setSplitPct(Math.max(15, Math.min(70, newPct)));
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

  // Load one more page of SCAN results
  const scanLoadMore = useCallback(async () => {
    if (scanCursor === "0" && scanKeys.length > 0) return; // Done
    setScanLoading(true);
    try {
      const res = await executeCommand(dbId, ["SCAN", scanCursor, ...scanArgs]);
      if (res.error) return;
      const scanRes = res.result as [string, string[]];
      const newCursor = String(scanRes[0]);
      const newKeys = Array.isArray(scanRes[1]) ? scanRes[1] : [];
      setScanKeys((prev) => {
        const set = new Set(prev);
        for (const k of newKeys) set.add(k);
        return Array.from(set).sort();
      });
      setScanCursor(newCursor);
    } catch {
      // silently fail
    } finally {
      setScanLoading(false);
    }
  }, [dbId, scanCursor, scanArgs, scanKeys.length]);

  // Auto-paginate: scan all remaining pages
  const scanAll = useCallback(async () => {
    setScanLoading(true);
    try {
      let cursor = scanCursor;
      const collected = new Set(scanKeys);
      do {
        const res = await executeCommand(dbId, ["SCAN", cursor, ...scanArgs]);
        if (res.error) break;
        const scanRes = res.result as [string, string[]];
        cursor = String(scanRes[0]);
        if (Array.isArray(scanRes[1])) {
          for (const k of scanRes[1]) {
            if (collected.size >= scanMaxItems) { cursor = "0"; break; }
            collected.add(k);
          }
        }
        // Update UI progressively
        setScanKeys(Array.from(collected).sort());
        setScanCursor(cursor);
      } while (cursor !== "0");
    } catch {
      // silently fail
    } finally {
      setScanLoading(false);
    }
  }, [dbId, scanCursor, scanArgs, scanKeys, scanMaxItems]);

  // Reset when result changes
  useEffect(() => {
    setSelectedKey(null);
    setScanArgs(scanExtraArgs);
    if (isScanResult(result)) {
      const cursor = String((result as [string, string[]])[0]);
      const keys = (result as [string, string[]])[1] ?? [];
      setScanKeys(keys);
      setScanCursor(cursor);
    } else {
      setScanKeys([]);
      setScanCursor("0");
    }
  }, [result, scanExtraArgs]);

  const handleSelectKey = (key: string) => {
    setSelectedKey(key);
    setDetailKey((n) => n + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Running...
      </div>
    );
  }

  if (error) {
    return (
      <pre className="p-4 text-xs font-mono text-destructive whitespace-pre-wrap break-all">
        {error}
      </pre>
    );
  }

  if (result === undefined) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
        Run a command to see results
      </div>
    );
  }

  // SCAN results → split view like key explorer
  const scanDone = scanCursor === "0" && scanKeys.length > 0;
  if (isScanResult(result) || scanKeys.length > 0) {
    return (
      <div ref={splitRef} className="flex h-full overflow-hidden">
        {/* Key list (left panel) */}
        <div
          className="overflow-y-auto flex-shrink-0 flex flex-col"
          style={{ width: selectedKey ? `${splitPct}%` : "100%" }}
        >
          {/* Header with count + controls */}
          <div className="px-3 py-2 border-b bg-muted/20 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground font-medium">
                {scanKeys.length} key{scanKeys.length !== 1 ? "s" : ""}
                {scanDone ? (
                  <span className="text-green-600 dark:text-green-400 ml-1">(complete)</span>
                ) : (
                  <span className="ml-1">— cursor <span className="font-mono">{scanCursor}</span></span>
                )}
              </p>
            </div>
            {!scanDone && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => void scanLoadMore()}
                  disabled={scanLoading}
                >
                  {scanLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Load More
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => void scanAll()}
                  disabled={scanLoading}
                >
                  {scanLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Scan All
                </Button>
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[10px] text-muted-foreground/60">Max:</span>
                  <input
                    type="number"
                    value={scanMaxItems}
                    onChange={(e) => setScanMaxItems(Math.max(100, Math.min(50000, Number(e.target.value) || 5000)))}
                    className="h-6 w-16 rounded border bg-background px-1.5 text-[11px] font-mono outline-none focus:border-ring text-right"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {scanKeys.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50 py-8">
                No keys yet — click Load More or Scan All
              </div>
            ) : (
              scanKeys.map((key) => (
                <button
                  key={key}
                  className={cn(
                    "w-full text-left flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/50 transition-colors text-xs font-mono truncate",
                    selectedKey === key && "bg-accent/60 text-foreground"
                  )}
                  onClick={() => handleSelectKey(key)}
                >
                  <Database className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="truncate">{key}</span>
                </button>
              ))
            )}
          </div>
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
                <KeyPanel
                  key={detailKey}
                  dbId={dbId}
                  keyName={selectedKey}
                  onClose={() => setSelectedKey(null)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Structured result rendering
  if (Array.isArray(result)) {
    const arr = result as unknown[];

    // Stream entries: Array of [string, string[]]
    if (arr.length > 0 && Array.isArray(arr[0]) && (arr[0] as unknown[]).length === 2 && typeof (arr[0] as unknown[])[0] === "string" && Array.isArray((arr[0] as unknown[])[1])) {
      const entries = (arr as [string, string[]][]).map(([id, fieldArr]) => {
        const fields: Record<string, string> = {};
        for (let i = 0; i + 1 < fieldArr.length; i += 2) {
          fields[fieldArr[i]] = fieldArr[i + 1];
        }
        return { id, fields };
      });
      return (
        <div className="p-3">
          <p className="text-[11px] text-muted-foreground font-medium mb-2">{entries.length} stream entries</p>
          <StreamViewer entries={entries} />
        </div>
      );
    }

    // Hash-like: flat string array with even count
    if (arr.length > 0 && arr.length % 2 === 0 && arr.every((v) => typeof v === "string")) {
      const strArr = arr as string[];
      const looksLikeHash = strArr.length >= 4 && isNaN(Number(strArr[0]));
      if (looksLikeHash) {
        const entries: { field: string; value: string }[] = [];
        for (let i = 0; i + 1 < strArr.length; i += 2) {
          entries.push({ field: strArr[i], value: strArr[i + 1] });
        }
        return (
          <div className="p-3">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">{entries.length} field{entries.length !== 1 ? "s" : ""}</p>
            <HashViewer entries={entries} />
          </div>
        );
      }
    }

    // Plain string array → list view
    if (arr.length > 0 && arr.every((v) => typeof v === "string")) {
      return (
        <div className="p-3">
          <p className="text-[11px] text-muted-foreground font-medium mb-2">{arr.length} item{arr.length !== 1 ? "s" : ""}</p>
          <ListViewer items={arr as string[]} />
        </div>
      );
    }
  }

  // String result
  if (typeof result === "string") {
    return (
      <div className="p-3">
        <StringViewer value={result} />
      </div>
    );
  }

  // Number / simple result
  if (typeof result === "number") {
    return (
      <div className="p-4">
        <span className="text-sm font-mono font-semibold">{result}</span>
        <span className="text-xs text-muted-foreground ml-2">(integer)</span>
      </div>
    );
  }

  // Fallback: formatted text
  return (
    <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all text-foreground">
      {formatResult(result)}
    </pre>
  );
}

// ── Query Tab ─────────────────────────────────────────────────────────────────

interface QueryTabState {
  input: string;
  history: HistoryEntry[];
  historyIndex: number;
  result: unknown;
  error: string | null;
  running: boolean;
}

interface QueryTabProps {
  dbId: string;
  tabId: string;
  state: QueryTabState;
  onChange: (update: Partial<QueryTabState>) => void;
  disabled: boolean;
  aiEnabled: boolean;
  aiSession?: AiSession;
  onAiSessionChange?: (session: AiSession) => void;
}

function QueryTab({ dbId, tabId, state, onChange, disabled, aiEnabled, aiSession, onAiSessionChange }: QueryTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [aiBarOpen, setAiBarOpen] = useState(false);
  const [expandedTs, setExpandedTs] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyHeight, setHistoryHeight] = useState(180);
  const historyResizing = useRef(false);
  const [lastScanArgs, setLastScanArgs] = useState<string[]>([]);

  const handleHistoryResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    historyResizing.current = true;
    const startY = e.clientY;
    const startH = historyHeight;
    const onMove = (ev: MouseEvent) => {
      if (!historyResizing.current) return;
      // Dragging up = increasing height (startY - ev.clientY is positive when dragging up)
      setHistoryHeight(Math.max(60, Math.min(500, startH + (startY - ev.clientY))));
    };
    const onUp = () => {
      historyResizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [historyHeight]);

  // Auto-scroll result area when new results appear
  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [state.result, state.running]);

  const runCommand = async () => {
    const raw = state.input.trim();
    if (!raw) return;
    const parts = parseCommand(raw);
    if (parts.length === 0) return;

    // Track SCAN args for pagination in result area
    const cmd = parts[0].toUpperCase();
    if (cmd === "SCAN") {
      setLastScanArgs(parts.slice(2)); // everything after SCAN <cursor>
    } else {
      setLastScanArgs([]);
    }

    onChange({ running: true, error: null, result: undefined });

    const entry: HistoryEntry = {
      command: raw,
      result: "",
      error: false,
      ts: Date.now(),
    };

    try {
      const res = await executeCommand(dbId, parts);
      const output = res.error ? `(error) ${res.error}` : formatResult(res.result);
      entry.result = output;
      entry.error = !!res.error;
      onChange({
        running: false,
        result: res.error ? undefined : res.result,
        error: res.error ? `(error) ${res.error}` : null,
        history: [entry, ...state.history].slice(0, 50),
        historyIndex: -1,
        input: "",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      entry.result = `(error) ${msg}`;
      entry.error = true;
      onChange({
        running: false,
        result: undefined,
        error: `(error) ${msg}`,
        history: [entry, ...state.history].slice(0, 50),
        historyIndex: -1,
        input: "",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void runCommand();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(state.historyIndex + 1, state.history.length - 1);
      onChange({
        historyIndex: next,
        input: state.history[next]?.command ?? state.input,
      });
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(state.historyIndex - 1, -1);
      onChange({
        historyIndex: next,
        input: next === -1 ? "" : (state.history[next]?.command ?? ""),
      });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* History panel — collapsible + resizable — ABOVE the input */}
      {state.history.length > 0 && (
        <div className="shrink-0 flex flex-col overflow-hidden">
          <button
            className="px-3 py-1.5 bg-muted/20 border-b flex items-center gap-2 hover:bg-muted/30 transition-colors"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <ChevronRight className={cn("h-3 w-3 text-muted-foreground/50 transition-transform", historyOpen && "rotate-90")} />
            <Clock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">History</span>
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">{state.history.length}</span>
          </button>
          {historyOpen && (
            <div className="overflow-y-auto border-b" style={{ maxHeight: `${historyHeight}px` }}>
              {state.history.map((h) => (
                <div key={h.ts} className="border-b border-border/20 last:border-b-0">
                  <div
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/40 transition-colors text-left group cursor-pointer"
                    onClick={() => setExpandedTs((prev) => prev === h.ts ? null : h.ts)}
                  >
                    <ChevronRight className={cn("h-2.5 w-2.5 text-muted-foreground/40 shrink-0 transition-transform", expandedTs === h.ts && "rotate-90")} />
                    <span className="text-[11px] font-mono text-foreground truncate flex-1 min-w-0">{h.command}</span>
                    {h.error && <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />}
                    <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(h.ts).toLocaleTimeString()}
                    </span>
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange({ input: h.command });
                        setTimeout(() => {
                          const parts = parseCommand(h.command);
                          if (parts.length === 0) return;
                          onChange({ running: true, error: null, result: undefined, input: h.command });
                          executeCommand(dbId, parts).then((res) => {
                            const output = res.error ? `(error) ${res.error}` : formatResult(res.result);
                            const entry: HistoryEntry = { command: h.command, result: output, error: !!res.error, ts: Date.now() };
                            onChange({ running: false, result: res.error ? undefined : res.result, error: res.error ? `(error) ${res.error}` : null, history: [entry, ...state.history].slice(0, 50), historyIndex: -1, input: "" });
                          }).catch((err) => {
                            const msg = err instanceof Error ? err.message : "Unknown error";
                            const entry: HistoryEntry = { command: h.command, result: `(error) ${msg}`, error: true, ts: Date.now() };
                            onChange({ running: false, result: undefined, error: `(error) ${msg}`, history: [entry, ...state.history].slice(0, 50), historyIndex: -1, input: "" });
                          });
                        }, 0);
                      }}
                      title="Re-run this command"
                    >
                      <RotateCw className="h-3 w-3 text-muted-foreground/50 hover:text-foreground" />
                    </button>
                  </div>
                  {expandedTs === h.ts && (
                    <div className={cn("px-3 py-2 pl-8 text-[11px] font-mono whitespace-pre-wrap break-all bg-muted/10", h.error ? "text-destructive" : "text-foreground/60")}>
                      {h.result}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Resize handle */}
          {historyOpen && (
            <div
              onMouseDown={handleHistoryResize}
              className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group"
              title="Drag to resize"
            >
              <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
        <span className="text-xs font-mono text-muted-foreground shrink-0">{">"}</span>
        <input
          ref={inputRef}
          key={tabId}
          className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50"
          placeholder="Enter a Redis command (e.g. SCAN 0 MATCH * COUNT 20)"
          value={state.input}
          onChange={(e) => onChange({ input: e.target.value })}
          onKeyDown={handleKeyDown}
          disabled={state.running || disabled}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void runCommand()} disabled={state.running || !state.input.trim() || disabled} title="Run command">
          {state.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* AI Assistant — collapsible */}
      {aiEnabled && (
        <>
          <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b hover:bg-muted/30 transition-colors" onClick={() => setAiBarOpen((v) => !v)}>
            <Sparkles className={cn("h-3 w-3", aiBarOpen ? "text-primary" : "text-muted-foreground/50")} />
            <span className={cn("text-xs font-medium", aiBarOpen ? "text-primary" : "text-muted-foreground/50")}>AI Assistant</span>
            {aiSession && aiSession.entries.length > 0 && (
              <span className="text-[10px] text-muted-foreground/40 tabular-nums">{aiSession.entries.length} {aiSession.entries.length === 1 ? "prompt" : "prompts"}</span>
            )}
          </button>
          <div className="grid transition-[grid-template-rows] duration-200 ease-in-out shrink-0" style={{ gridTemplateRows: aiBarOpen ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              <AiQueryBar schema={[]} dialect="redis" onSqlGenerated={(cmd) => onChange({ input: cmd })} aiEnabled={aiEnabled} aiSession={aiSession} onAiSessionChange={onAiSessionChange} getEditorContent={() => state.input} lastQuerySummary={state.result !== undefined ? formatResult(state.result).slice(0, 100) : undefined} />
            </div>
          </div>
        </>
      )}

      {/* Result area */}
      <div className="flex-1 overflow-y-auto" ref={resultRef}>
        {state.result === undefined && !state.error && !state.running ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
            Run a command to see results
          </div>
        ) : (
          <QueryResultArea dbId={dbId} result={state.result} error={state.error} loading={state.running} scanExtraArgs={lastScanArgs} />
        )}
      </div>
    </div>
  );
}

// ── Metrics Tab ───────────────────────────────────────────────────────────────

interface MetricsTabProps {
  dbId: string;
}

function MetricsTab({ dbId }: MetricsTabProps) {
  const [sections, setSections] = useState<InfoSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRedisInfo(dbId);
      if (typeof res.result === "string") {
        setSections(parseInfoResponse(res.result));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [dbId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSection = (name: string) => {
    setCollapsedSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const totalKeys = sections.length
    ? (() => {
        // Sum db0..dbN keyspace entries
        const keyspace = sections.find((s) => s.name === "Keyspace");
        if (!keyspace) return extractInfoMetric(sections, "db0") ? null : "0";
        let total = 0;
        for (const entry of keyspace.entries) {
          const m = entry.value.match(/keys=(\d+)/);
          if (m) total += parseInt(m[1], 10);
        }
        return String(total);
      })()
    : null;

  const usedMemoryRaw = extractInfoMetric(sections, "used_memory");
  const connectedClientsRaw = extractInfoMetric(sections, "connected_clients");
  const uptimeRaw = extractInfoMetric(sections, "uptime_in_seconds");
  const opsRaw = extractInfoMetric(sections, "instantaneous_ops_per_sec");
  const hitsRaw = extractInfoMetric(sections, "keyspace_hits");
  const missesRaw = extractInfoMetric(sections, "keyspace_misses");

  const hitRate =
    hitsRaw !== null && missesRaw !== null
      ? (() => {
          const hits = parseInt(hitsRaw, 10);
          const misses = parseInt(missesRaw, 10);
          const total = hits + misses;
          return total === 0 ? "N/A" : `${((hits / total) * 100).toFixed(1)}%`;
        })()
      : "N/A";

  const summaryCards = [
    {
      label: "Total Keys",
      value: totalKeys ?? "—",
    },
    {
      label: "Used Memory",
      value: usedMemoryRaw
        ? formatBytes(parseInt(usedMemoryRaw, 10))
        : "—",
    },
    {
      label: "Clients",
      value: connectedClientsRaw ?? "—",
    },
    {
      label: "Uptime",
      value: uptimeRaw ? formatUptime(parseInt(uptimeRaw, 10)) : "—",
    },
    {
      label: "Ops/sec",
      value: opsRaw ?? "—",
    },
    {
      label: "Hit Rate",
      value: hitRate,
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b">
        <p className="text-xs font-medium text-muted-foreground">
          Redis INFO
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => void load()}
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

      <div className="flex-1 overflow-y-auto">
        {loading && sections.length === 0 ? (
          <div className="flex items-center gap-2 p-8 justify-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded border bg-muted/20 px-3 py-2.5 text-center"
                >
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    {card.label}
                  </p>
                  <p className="text-sm font-semibold font-mono">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {/* INFO sections */}
            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.name} className="rounded border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleSection(section.name)}
                  >
                    <span className="text-xs font-medium">{section.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {section.entries.length} entries
                      </span>
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform",
                          !collapsedSections[section.name] && "rotate-90"
                        )}
                      />
                    </div>
                  </button>
                  {!collapsedSections[section.name] && (
                    <div className="divide-y">
                      {section.entries.map((entry) => (
                        <div
                          key={entry.key}
                          className="grid grid-cols-2 px-3 py-1.5 gap-3 text-xs"
                        >
                          <span className="font-mono text-muted-foreground truncate">
                            {entry.key}
                          </span>
                          <span className="font-mono text-foreground break-all">
                            {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Monitor Tab ───────────────────────────────────────────────────────────────

interface MonitorTabProps {
  dbId: string;
}

const POLL_INTERVALS = [5, 10, 30] as const;
type PollInterval = (typeof POLL_INTERVALS)[number];

function MonitorTab({ dbId }: MonitorTabProps) {
  const [snapshots, setSnapshots] = useState<MonitorSnapshot[]>([]);
  const [running, setRunning] = useState(false);
  const [pollInterval, setPollInterval] = useState<PollInterval>(5);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const takeSnapshot = useCallback(async () => {
    try {
      const res = await getRedisInfo(dbId);
      if (typeof res.result !== "string") return;
      const secs = parseInfoResponse(res.result);

      const usedMemoryStr = extractInfoMetric(secs, "used_memory");
      const clientsStr = extractInfoMetric(secs, "connected_clients");
      const opsStr = extractInfoMetric(secs, "instantaneous_ops_per_sec");
      const hitsStr = extractInfoMetric(secs, "keyspace_hits");
      const missesStr = extractInfoMetric(secs, "keyspace_misses");

      const keyspace = secs.find((s) => s.name === "Keyspace");
      let totalKeys = 0;
      if (keyspace) {
        for (const entry of keyspace.entries) {
          const m = entry.value.match(/keys=(\d+)/);
          if (m) totalKeys += parseInt(m[1], 10);
        }
      }

      const hits = hitsStr ? parseInt(hitsStr, 10) : 0;
      const misses = missesStr ? parseInt(missesStr, 10) : 0;
      const total = hits + misses;
      const hitRate = total === 0 ? 0 : (hits / total) * 100;

      const snap: MonitorSnapshot = {
        ts: Date.now(),
        keys: totalKeys,
        usedMemory: usedMemoryStr ? parseInt(usedMemoryStr, 10) : 0,
        connectedClients: clientsStr ? parseInt(clientsStr, 10) : 0,
        opsPerSec: opsStr ? parseFloat(opsStr) : 0,
        hitRate,
      };

      setSnapshots((prev) => [snap, ...prev].slice(0, 60));
    } catch {
      // silently fail
    }
  }, [dbId]);

  const start = useCallback(() => {
    void takeSnapshot();
    intervalRef.current = setInterval(() => {
      void takeSnapshot();
    }, pollInterval * 1000);
    setRunning(true);
  }, [takeSnapshot, pollInterval]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  // Restart interval when pollInterval changes while running
  useEffect(() => {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        void takeSnapshot();
      }, pollInterval * 1000);
    }
  }, [pollInterval, running, takeSnapshot]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const latest = snapshots[0] ?? null;
  const prev = snapshots[1] ?? null;

  function delta(
    curr: number | null,
    prevVal: number | null
  ): { value: number; positive: boolean } | null {
    if (curr === null || prevVal === null) return null;
    const d = curr - prevVal;
    return { value: d, positive: d > 0 };
  }

  const statCards = latest
    ? [
        {
          label: "Keys",
          value: String(latest.keys),
          delta: delta(latest.keys, prev?.keys ?? null),
        },
        {
          label: "Memory",
          value: formatBytes(latest.usedMemory),
          delta: delta(latest.usedMemory, prev?.usedMemory ?? null),
        },
        {
          label: "Clients",
          value: String(latest.connectedClients),
          delta: delta(
            latest.connectedClients,
            prev?.connectedClients ?? null
          ),
        },
        {
          label: "Ops/sec",
          value: latest.opsPerSec.toFixed(1),
          delta: delta(latest.opsPerSec, prev?.opsPerSec ?? null),
        },
        {
          label: "Hit Rate",
          value: `${latest.hitRate.toFixed(1)}%`,
          delta: null,
        },
      ]
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b">
        <Button
          variant={running ? "outline" : "default"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={running ? stop : start}
        >
          {running ? (
            <>
              <Activity className="h-3 w-3" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              Start
            </>
          )}
        </Button>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Interval:</span>
          {POLL_INTERVALS.map((interval) => (
            <button
              key={interval}
              className={cn(
                "px-2 py-0.5 rounded text-xs transition-colors",
                pollInterval === interval
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              onClick={() => setPollInterval(interval)}
            >
              {interval}s
            </button>
          ))}
        </div>

        {snapshots.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-8">
            <Activity className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Press Start to begin monitoring
            </p>
            <p className="text-xs text-muted-foreground/60">
              Polls Redis INFO every {pollInterval}s
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Current stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded border bg-muted/20 px-3 py-2.5"
                >
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    {card.label}
                  </p>
                  <div className="flex items-end justify-between gap-1">
                    <p className="text-sm font-semibold font-mono">
                      {card.value}
                    </p>
                    {card.delta !== null && card.delta.value !== 0 && (
                      <span
                        className={cn(
                          "text-[10px] font-mono",
                          card.delta.positive
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                      >
                        {card.delta.positive ? "+" : ""}
                        {card.delta.value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Snapshots table */}
            <div className="rounded border overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/50 text-[11px] font-medium text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">Time</th>
                      <th className="px-3 py-1.5 text-right w-20">Keys</th>
                      <th className="px-3 py-1.5 text-right w-24">Memory</th>
                      <th className="px-3 py-1.5 text-right w-20">Ops/sec</th>
                      <th className="px-3 py-1.5 text-right w-20">Clients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {snapshots.map((snap) => (
                      <tr key={snap.ts}>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">
                          {new Date(snap.ts).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-right">{snap.keys}</td>
                        <td className="px-3 py-1.5 font-mono text-right">
                          {formatBytes(snap.usedMemory)}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-right">
                          {snap.opsPerSec.toFixed(1)}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-right">
                          {snap.connectedClients}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────

interface RedisTabBarProps {
  tabs: RedisTab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNewQuery: () => void;
}

function tabIcon(type: RedisTabType) {
  if (type === "metrics") return BarChart3;
  if (type === "monitor") return Activity;
  if (type === "bullmq" || type === "sidekiq" || type === "celery") return Boxes;
  if (type === "namespaces") return Database;
  if (type === "streams") return Activity;
  return Terminal;
}

function RedisTabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNewQuery,
}: RedisTabBarProps) {
  return (
    <div className="flex items-end border-b bg-muted/10 overflow-x-auto shrink-0 min-h-[36px]">
      <div className="flex items-end min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = tabIcon(tab.type);
          return (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer select-none",
                "border-r border-border/50 shrink-0 max-w-[160px] group transition-colors",
                isActive
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
              onClick={() => onSwitch(tab.id)}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium">{tab.title}</span>
              <button
                className={cn(
                  "shrink-0 rounded hover:bg-muted transition-colors p-0.5 -mr-0.5",
                  isActive
                    ? "opacity-60 hover:opacity-100"
                    : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                aria-label={`Close ${tab.title}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="flex items-center justify-center h-8 w-8 shrink-0 ml-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-sm transition-colors"
        onClick={onNewQuery}
        aria-label="New query tab"
        title="New Query"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1" />
    </div>
  );
}

// ── Main Studio Inner ─────────────────────────────────────────────────────────

let queryTabCounter = 1;

function makeQueryTabId() {
  return `query-${queryTabCounter++}`;
}

export function RedisStudioInner({ dbId: propDbId }: { dbId?: string } = {}) {
  const params = useParams();
  const dbId = propDbId ?? (params.id as string);

  const [db, setDb] = useState<RedisDetail | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [connOpen, setConnOpen] = useState(false);

  const [tabs, setTabs] = useState<RedisTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Per-tab query state, keyed by tab id
  const [queryStates, setQueryStates] = useState<
    Record<string, QueryTabState>
  >({});

  // Per-tab AI sessions
  const [aiSessions, setAiSessions] = useState<Record<string, AiSession>>({});

  const { data: billing } = useBillingStatus();
  const aiEnabled = billing != null && (billing.plan === "pro" || billing.plan === "max");

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
    return () => {
      cancelled = true;
    };
  }, [dbId]);

  const openQueryTab = useCallback(() => {
    const id = makeQueryTabId();
    const num = queryTabCounter - 1;
    const tab: RedisTab = { id, type: "query", title: `Query ${num}` };
    setTabs((prev) => [...prev, tab]);
    setQueryStates((prev) => ({
      ...prev,
      [id]: {
        input: "",
        history: [],
        historyIndex: -1,
        result: undefined,
        error: null,
        running: false,
      },
    }));
    setActiveTabId(id);
  }, []);

  const openMetricsTab = useCallback(() => {
    const existingId = "metrics";
    if (!tabs.find((t) => t.id === existingId)) {
      setTabs((prev) => [
        ...prev,
        { id: existingId, type: "metrics", title: "Metrics" },
      ]);
    }
    setActiveTabId(existingId);
  }, [tabs]);

  const openMonitorTab = useCallback(() => {
    const existingId = "monitor";
    if (!tabs.find((t) => t.id === existingId)) {
      setTabs((prev) => [
        ...prev,
        { id: existingId, type: "monitor", title: "Monitor" },
      ]);
    }
    setActiveTabId(existingId);
  }, [tabs]);

  const openViewTab = useCallback((type: "bullmq" | "sidekiq" | "celery" | "namespaces" | "streams", title: string) => {
    const existingId = type;
    if (!tabs.find((t) => t.id === existingId)) {
      setTabs((prev) => [
        ...prev,
        { id: existingId, type, title },
      ]);
    }
    setActiveTabId(existingId);
  }, [tabs]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((current) => {
        if (current === id) {
          return next[Math.min(idx, next.length - 1)]?.id ?? null;
        }
        return current;
      });
      return next;
    });
    setQueryStates((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setAiSessions((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const updateQueryState = useCallback(
    (tabId: string, update: Partial<QueryTabState>) => {
      setQueryStates((prev) => ({
        ...prev,
        [tabId]: { ...prev[tabId], ...update },
      }));
    },
    []
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const navItems = [
    {
      id: "metrics",
      icon: BarChart3,
      label: "Metrics",
      action: openMetricsTab,
    },
    {
      id: "monitor",
      icon: Activity,
      label: "Live Monitor",
      action: openMonitorTab,
    },
    {
      id: "query",
      icon: Terminal,
      label: "New Query",
      action: openQueryTab,
    },
  ] as const;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2.5 border-b space-y-1.5 shrink-0">
          <Link
            href="/account/managed"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            All databases
          </Link>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold truncate flex-1 min-w-0">
              {dbLoading ? "Loading…" : (db?.name ?? (dbId.startsWith("tunnel:") ? "External Redis" : dbId))}
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

        {/* Navigation */}
        <div className="shrink-0 border-b py-1">
          {navItems.map((item) => {
            const isActiveNav =
              item.id === "query"
                ? false // query always opens a new tab
                : activeTab?.id === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                  isActiveNav
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                onClick={item.action}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
                {item.id === "query" && (
                  <Plus className="h-3 w-3 ml-auto shrink-0 opacity-50" />
                )}
              </button>
            );
          })}
        </div>

        {/* Views section */}
        <div className="flex-1 overflow-y-auto py-2">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Data
          </p>
          {([
            { id: "namespaces" as const, label: "Key Explorer", icon: Database },
            { id: "streams" as const, label: "Stream Groups", icon: Activity },
          ]).map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                  activeTab?.id === view.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                onClick={() => openViewTab(view.id, view.label)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {view.label}
              </button>
            );
          })}

          <p className="px-3 py-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Frameworks
          </p>
          {([
            { id: "bullmq" as const, label: "BullMQ" },
            { id: "sidekiq" as const, label: "Sidekiq" },
            { id: "celery" as const, label: "Celery" },
          ]).map((view) => (
            <button
              key={view.id}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                activeTab?.id === view.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              onClick={() => openViewTab(view.id, view.label)}
            >
              <Boxes className="h-3.5 w-3.5 shrink-0" />
              {view.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <RedisTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={setActiveTabId}
          onClose={closeTab}
          onNewQuery={openQueryTab}
        />

        <div className="flex-1 overflow-hidden">
          {activeTab === null ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <Database className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Open a tab from the sidebar
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  or{" "}
                  <button
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                    onClick={openQueryTab}
                  >
                    open a new query tab
                  </button>
                </p>
              </div>
            </div>
          ) : activeTab.type === "query" ? (
            <QueryTab
              key={activeTab.id}
              dbId={dbId}
              tabId={activeTab.id}
              state={
                queryStates[activeTab.id] ?? {
                  input: "",
                  history: [],
                  historyIndex: -1,
                  result: undefined,
                  error: null,
                  running: false,
                          }
              }
              onChange={(update) => updateQueryState(activeTab.id, update)}
              disabled={dbLoading}
              aiEnabled={aiEnabled}
              aiSession={aiSessions[activeTab.id]}
              onAiSessionChange={(session) =>
                setAiSessions((prev) => ({ ...prev, [activeTab.id]: session }))
              }
            />
          ) : activeTab.type === "metrics" ? (
            <MetricsTab key={activeTab.id} dbId={dbId} />
          ) : activeTab.type === "monitor" ? (
            <MonitorTab key={activeTab.id} dbId={dbId} />
          ) : activeTab.type === "bullmq" ? (
            <BullMQView key={activeTab.id} dbId={dbId} />
          ) : activeTab.type === "sidekiq" ? (
            <SidekiqView key={activeTab.id} dbId={dbId} />
          ) : activeTab.type === "celery" ? (
            <CeleryView key={activeTab.id} dbId={dbId} />
          ) : activeTab.type === "namespaces" ? (
            <KeyNamespaceView key={activeTab.id} dbId={dbId} />
          ) : activeTab.type === "streams" ? (
            <StreamGroupsView key={activeTab.id} dbId={dbId} />
          ) : null}
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
