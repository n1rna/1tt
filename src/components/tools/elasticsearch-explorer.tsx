"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { GripHorizontal, Sparkles } from "lucide-react";
import { useBillingStatus } from "@/lib/billing";
import { AiQueryBar } from "@/components/account/database-studio/ai-query-bar";
import type { TableSchema, AiSession } from "@/components/account/database-studio/types";
import {
  Database,
  Server,
  Search,
  FileText,
  GitBranch,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  X,
  Play,
  Eye,
  EyeOff,
  Copy,
  Check,
  Activity,
  HardDrive,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSyncedState } from "@/lib/sync";
import { Globe, GlobeLock, Wifi } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { TunnelConnectDialog } from "@/components/account/tunnel-connect-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthType = "none" | "basic" | "apikey" | "bearer";

interface EsConnection {
  id: string;
  name: string;
  url: string;
  authType: AuthType;
  username?: string;
  password?: string;
  apiKey?: string;
  bearerToken?: string;
}

type ConnectionStatus = "idle" | "checking" | "ok" | "error";

interface ClusterHealth {
  cluster_name: string;
  cluster_uuid?: string;
  status: "green" | "yellow" | "red";
  number_of_nodes: number;
  number_of_data_nodes: number;
  active_primary_shards: number;
  active_shards: number;
  relocating_shards: number;
  initializing_shards: number;
  unassigned_shards: number;
  delayed_unassigned_shards?: number;
  number_of_pending_tasks?: number;
}

interface ClusterInfo {
  name: string;
  cluster_uuid: string;
  version: { number: string; build_flavor?: string; lucene_version?: string };
  tagline?: string;
}

interface ClusterStats {
  indices?: {
    count: number;
    docs: { count: number; deleted: number };
    store: { size_in_bytes: number };
    shards?: { total: number; primaries: number };
  };
  nodes?: { count: { total: number; data: number } };
}

interface NodeInfo {
  name: string;
  transport_address: string;
  host: string;
  ip: string;
  roles: string[];
  os?: { cpu?: { percent?: number }; mem?: { used_in_bytes?: number; total_in_bytes?: number } };
  jvm?: { mem?: { heap_used_in_bytes?: number; heap_max_in_bytes?: number } };
  fs?: { total?: { total_in_bytes?: number; available_in_bytes?: number } };
  process?: { cpu?: { percent?: number } };
  load_average?: number;
}

interface IndexInfo {
  index: string;
  health: string;
  status: string;
  pri: string;
  rep: string;
  "docs.count": string;
  "docs.deleted": string;
  "store.size": string;
  "pri.store.size": string;
}

interface AliasInfo {
  alias: string;
  index: string;
  filter?: string;
  routing_index?: string;
  routing_search?: string;
  is_write_index?: string;
}

interface SearchHit {
  _index: string;
  _id: string;
  _score: number;
  _source: Record<string, unknown>;
}

interface SearchResponse {
  took: number;
  hits: {
    total: { value: number; relation: string };
    hits: SearchHit[];
  };
}

// ─── ES Tab types ─────────────────────────────────────────────────────────────

type EsTab =
  | { id: string; type: "overview" }
  | { id: string; type: "nodes" }
  | { id: string; type: "index"; indexName: string }
  | { id: string; type: "search"; title: string }
  | { id: string; type: "documents" }
  | { id: string; type: "aliases" };

interface EsPersistedState {
  activeConnId: string | null;
  tabs: EsTab[];
  activeTabId: string | null;
  queryCounter: number;
  savedQueries: Record<string, string>; // tab id → query text
}

const DEFAULT_ES_STATE: EsPersistedState = {
  activeConnId: null,
  tabs: [],
  activeTabId: null,
  queryCounter: 1,
  savedQueries: {},
};

// ─── ES Fetch Helper ─────────────────────────────────────────────────────────

// Tunnel executor override — when set, all ES requests go through the tunnel
// instead of direct HTTP. Similar to the Redis setTunnelExecutor pattern.
let _esTunnelExecutor: ((method: string, path: string, body: string) => Promise<unknown>) | null = null;

export function setEsTunnelExecutor(
  fn: ((method: string, path: string, body: string) => Promise<unknown>) | null
) {
  _esTunnelExecutor = fn;
}

async function esFetch(
  conn: EsConnection,
  path: string,
  options?: RequestInit
): Promise<unknown> {
  // If tunnel executor is set, route through the tunnel
  if (_esTunnelExecutor) {
    const method = (options?.method ?? "GET").toUpperCase();
    const body = typeof options?.body === "string" ? options.body : "";
    return _esTunnelExecutor(method, path, body);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (conn.authType === "basic") {
    headers["Authorization"] = `Basic ${btoa(`${conn.username}:${conn.password}`)}`;
  } else if (conn.authType === "apikey") {
    headers["Authorization"] = `ApiKey ${conn.apiKey}`;
  } else if (conn.authType === "bearer") {
    headers["Authorization"] = `Bearer ${conn.bearerToken}`;
  }
  const url = `${conn.url.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthColor(health: string) {
  switch (health) {
    case "green": return "text-green-500";
    case "yellow": return "text-yellow-500";
    case "red": return "text-red-500";
    default: return "text-muted-foreground";
  }
}

function healthDot(health: string) {
  switch (health) {
    case "green": return "bg-green-500";
    case "yellow": return "bg-yellow-500";
    case "red": return "bg-red-500";
    default: return "bg-muted-foreground";
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatDocCount(n: number | string): string {
  const num = Number(n);
  if (isNaN(num)) return String(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

// ─── CodeMirror JSON Editor ───────────────────────────────────────────────────

function JsonEditor({
  value,
  onChange,
  onRun,
  placeholder: ph = '{\n  "query": {\n    "match_all": {}\n  }\n}',
}: {
  value: string;
  onChange: (v: string) => void;
  onRun?: () => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<import("@codemirror/view").EditorView | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;
    let cancelled = false;

    (async () => {
      const { EditorView, keymap, placeholder, lineNumbers } = await import("@codemirror/view");
      const { EditorState } = await import("@codemirror/state");
      const { json } = await import("@codemirror/lang-json");
      const { defaultKeymap, history, historyKeymap } = await import("@codemirror/commands");
      const { syntaxHighlighting, HighlightStyle } = await import("@codemirror/language");
      const { tags } = await import("@lezer/highlight");

      if (cancelled || !editorRef.current) return;

      const runKm = onRunRef.current
        ? keymap.of([{ key: "Mod-Enter", run: () => { onRunRef.current?.(); return true; } }])
        : [];

      const highlight = HighlightStyle.define([
        { tag: tags.string, color: "#c3e88d" },
        { tag: tags.number, color: "#f78c6c" },
        { tag: tags.bool, color: "#c792ea" },
        { tag: tags.null, color: "#c792ea" },
        { tag: tags.propertyName, color: "#82aaff" },
        { tag: tags.punctuation, color: "#89ddff" },
        { tag: tags.bracket, color: "#89ddff" },
      ]);

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      });

      const theme = EditorView.theme({
        "&": {
          fontSize: "13px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          height: "100%",
        },
        ".cm-content": { padding: "12px 0" },
        ".cm-line": { paddingLeft: "12px", paddingRight: "12px" },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--border)",
          color: "var(--muted-foreground)",
          padding: "0 4px",
          fontSize: "12px",
        },
        ".cm-activeLineGutter": { backgroundColor: "transparent" },
        ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.03)" },
        ".cm-cursor": { borderLeftColor: "var(--foreground)" },
        ".cm-selectionBackground": { backgroundColor: "rgba(100,160,255,0.2) !important" },
        ".cm-focused .cm-selectionBackground": { backgroundColor: "rgba(100,160,255,0.3) !important" },
        ".cm-placeholder": { color: "var(--muted-foreground)" },
      }, { dark: true });

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          json(),
          syntaxHighlighting(highlight),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          runKm,
          updateListener,
          placeholder(ph),
          theme,
          EditorView.lineWrapping,
        ],
      });

      const view = new EditorView({ state, parent: editorRef.current });
      viewRef.current = view;

      // Value may have changed while we were loading CodeMirror — sync it
      const latest = valueRef.current;
      if (latest !== value) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: latest },
        });
      }
    })();

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-auto rounded-md border bg-[#1a1a2e] text-sm"
      style={{ minHeight: 160 }}
    />
  );
}

// ─── Connection Form Dialog ────────────────────────────────────────────────────

interface ConnFormProps {
  initial?: EsConnection;
  onSave: (conn: EsConnection) => void;
  onClose: () => void;
}

function ConnectionFormDialog({ initial, onSave, onClose }: ConnFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "http://localhost:9200");
  const [authType, setAuthType] = useState<AuthType>(initial?.authType ?? "none");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [bearerToken, setBearerToken] = useState(initial?.bearerToken ?? "");
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const buildConn = (): EsConnection => ({
    id: initial?.id ?? shortId(),
    name: name.trim() || url,
    url: url.trim(),
    authType,
    username: authType === "basic" ? username : undefined,
    password: authType === "basic" ? password : undefined,
    apiKey: authType === "apikey" ? apiKey : undefined,
    bearerToken: authType === "bearer" ? bearerToken : undefined,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const conn = buildConn();
      const data = await esFetch(conn, "/") as ClusterInfo;
      setTestResult({ ok: true, msg: `Connected to "${data.name}" (v${data.version?.number})` });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!url.trim()) return;
    onSave(buildConn());
  };

  const inputClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Connection" : "Add Connection"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Connection Name
            </label>
            <input
              className={inputClass}
              placeholder="My Elasticsearch"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Cluster URL
            </label>
            <input
              className={inputClass}
              placeholder="http://localhost:9200"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Authentication
            </label>
            <select
              className={inputClass}
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
            >
              <option value="none">None</option>
              <option value="basic">Basic Auth (username / password)</option>
              <option value="apikey">API Key</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>

          {authType === "basic" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Username
                </label>
                <input
                  className={inputClass}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    className={cn(inputClass, "pr-10")}
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPass((p) => !p)}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {authType === "apikey" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                API Key (base64 encoded id:api_key)
              </label>
              <input
                className={inputClass}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="base64-encoded-api-key"
                autoComplete="off"
              />
            </div>
          )}

          {authType === "bearer" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Bearer Token
              </label>
              <input
                className={inputClass}
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="your-bearer-token"
                autoComplete="off"
              />
            </div>
          )}

          <CorsHint />

          {testResult && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md p-3 text-xs",
                testResult.ok
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}
            >
              {testResult.ok ? (
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span className="break-all">{testResult.msg}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !url.trim()}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Test Connection
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!url.trim()}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CORS Hint (inline in connection dialog) ─────────────────────────────────

function CorsHint() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
      <div className="space-y-1">
        <p>
          CORS must be enabled on the cluster for browser access.
          Add <code className="bg-muted px-1 rounded text-foreground/80">http.cors.enabled: true</code> and{" "}
          <code className="bg-muted px-1 rounded text-foreground/80">http.cors.allow-origin: &quot;*&quot;</code> to{" "}
          <code className="bg-muted px-1 rounded text-foreground/80">elasticsearch.yml</code>.
        </p>
        <p className="text-muted-foreground/60">
          Cloud-hosted clusters typically require a proxy.
        </p>
      </div>
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorBlock({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-6 flex flex-col items-center gap-3 text-center">
      <AlertCircle className="h-6 w-6 text-red-500" />
      <p className="text-sm text-red-500 break-all max-w-lg">{msg}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
      </Button>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ conn }: { conn: EsConnection }) {
  const [health, setHealth] = useState<ClusterHealth | null>(null);
  const [info, setInfo] = useState<ClusterInfo | null>(null);
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, i, s] = await Promise.all([
        esFetch(conn, "/_cluster/health") as Promise<ClusterHealth>,
        esFetch(conn, "/") as Promise<ClusterInfo>,
        esFetch(conn, "/_cluster/stats") as Promise<ClusterStats>,
      ]);
      setHealth(h);
      setInfo(i);
      setStats(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4"><ErrorBlock msg={error} onRetry={load} /></div>;
  if (!health || !info) return null;

  const totalDocs = stats?.indices?.docs?.count ?? 0;
  const totalSize = stats?.indices?.store?.size_in_bytes ?? 0;
  const indexCount = stats?.indices?.count ?? 0;

  const statCards = [
    { label: "Cluster Name", value: health.cluster_name, icon: <Database className="h-4 w-4" /> },
    { label: "ES Version", value: info.version?.number ?? "—", icon: <Server className="h-4 w-4" /> },
    { label: "Nodes", value: String(health.number_of_nodes), icon: <Server className="h-4 w-4" /> },
    { label: "Data Nodes", value: String(health.number_of_data_nodes), icon: <HardDrive className="h-4 w-4" /> },
    { label: "Indices", value: String(indexCount), icon: <FileText className="h-4 w-4" /> },
    { label: "Total Docs", value: totalDocs.toLocaleString(), icon: <FileText className="h-4 w-4" /> },
    { label: "Total Size", value: formatBytes(totalSize), icon: <HardDrive className="h-4 w-4" /> },
    { label: "Cluster UUID", value: health.cluster_uuid ?? info.cluster_uuid ?? "—", icon: <Info className="h-4 w-4" />, mono: true },
  ];

  const shardCards = [
    { label: "Active Shards", value: health.active_shards, color: "text-green-500" },
    { label: "Active Primary", value: health.active_primary_shards, color: "text-blue-500" },
    { label: "Relocating", value: health.relocating_shards, color: "text-yellow-500" },
    { label: "Initializing", value: health.initializing_shards, color: "text-orange-500" },
    { label: "Unassigned", value: health.unassigned_shards, color: health.unassigned_shards > 0 ? "text-red-500" : "text-muted-foreground" },
  ];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <span className={cn("h-3 w-3 rounded-full", healthDot(health.status))} />
          <div>
            <span className={cn("text-sm font-semibold capitalize", healthColor(health.status))}>
              {health.status.toUpperCase()}
            </span>
            <span className="text-sm text-muted-foreground ml-2">Cluster Health</span>
          </div>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className={cn("text-sm font-semibold truncate", card.mono && "font-mono text-xs")}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Shard Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {shardCards.map((card) => (
              <div key={card.label} className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={cn("text-lg font-bold", card.color)}>{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Nodes ───────────────────────────────────────────────────────────────

function NodesTab({ conn }: { conn: EsConnection }) {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await esFetch(conn, "/_nodes/stats/os,jvm,fs,process") as {
        nodes: Record<string, NodeInfo & { name: string }>;
      };
      setNodes(Object.values(data.nodes));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4"><ErrorBlock msg={error} onRetry={load} /></div>;

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{nodes.length} Node{nodes.length !== 1 ? "s" : ""}</h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh (5s)
            </label>
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left border-b">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Name</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">IP</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Roles</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Heap</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Disk</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">CPU %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nodes.map((node) => {
                const heapUsed = node.jvm?.mem?.heap_used_in_bytes ?? 0;
                const heapMax = node.jvm?.mem?.heap_max_in_bytes ?? 0;
                const diskTotal = node.fs?.total?.total_in_bytes ?? 0;
                const diskAvail = node.fs?.total?.available_in_bytes ?? 0;
                const diskUsed = diskTotal - diskAvail;
                const cpu = node.process?.cpu?.percent ?? node.os?.cpu?.percent ?? 0;
                const heapPct = heapMax > 0 ? Math.round((heapUsed / heapMax) * 100) : 0;
                const diskPct = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;

                return (
                  <tr key={node.name} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{node.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{node.ip}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(node.roles ?? []).map((r) => (
                          <span key={r} className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", heapPct > 80 ? "bg-red-500" : heapPct > 60 ? "bg-yellow-500" : "bg-green-500")}
                            style={{ width: `${heapPct}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground">
                          {formatBytes(heapUsed)} / {formatBytes(heapMax)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", diskPct > 80 ? "bg-red-500" : diskPct > 60 ? "bg-yellow-500" : "bg-blue-500")}
                            style={{ width: `${diskPct}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground">
                          {formatBytes(diskUsed)} / {formatBytes(diskTotal)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", cpu > 80 ? "bg-red-500" : cpu > 50 ? "bg-yellow-500" : "bg-green-500")}
                            style={{ width: `${cpu}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{cpu}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Index Detail ────────────────────────────────────────────────────────

function IndexDetailTab({
  conn,
  indexName,
  onDelete,
}: {
  conn: EsConnection;
  indexName: string;
  onDelete?: () => void;
}) {
  const [subTab, setSubTab] = useState<"mappings" | "settings" | "aliases" | "stats" | "shards">("mappings");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [indexStatus, setIndexStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let path = "";
      switch (subTab) {
        case "mappings": path = `/${indexName}/_mapping`; break;
        case "settings": path = `/${indexName}/_settings`; break;
        case "aliases": path = `/${indexName}/_alias`; break;
        case "stats": path = `/${indexName}/_stats`; break;
        case "shards": path = `/_cat/shards/${indexName}?format=json`; break;
      }
      const res = await esFetch(conn, path);
      setData(res as Record<string, unknown>);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [conn, indexName, subTab]);

  // Load index status for open/close button
  useEffect(() => {
    esFetch(conn, `/_cat/indices/${indexName}?format=json&h=status`)
      .then((d) => {
        const arr = d as { status: string }[];
        if (arr.length > 0) setIndexStatus(arr[0].status);
      })
      .catch(() => {});
  }, [conn, indexName]);

  useEffect(() => { load(); }, [load]);

  const doToggle = async () => {
    const action = indexStatus === "open" ? "_close" : "_open";
    setActionLoading("toggle");
    try {
      await esFetch(conn, `/${indexName}/${action}`, { method: "POST" });
      setIndexStatus(indexStatus === "open" ? "close" : "open");
    } catch (e) {
      setError(String(e));
    } finally {
      setActionLoading(null);
    }
  };

  const doDelete = async () => {
    setActionLoading("delete");
    try {
      await esFetch(conn, `/${indexName}`, { method: "DELETE" });
      setConfirmDelete(false);
      onDelete?.();
    } catch (e) {
      setError(String(e));
      setActionLoading(null);
    }
  };

  const detailTabs: { id: typeof subTab; label: string }[] = [
    { id: "mappings", label: "Mappings" },
    { id: "settings", label: "Settings" },
    { id: "aliases", label: "Aliases" },
    { id: "stats", label: "Stats" },
    { id: "shards", label: "Shards" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Index header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0 flex-wrap">
        <Database className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-mono text-sm font-medium truncate flex-1">{indexName}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={doToggle}
            disabled={!!actionLoading || indexStatus === null}
          >
            {actionLoading === "toggle" ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {indexStatus === "open" ? "Close" : "Open"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
            onClick={() => setConfirmDelete(true)}
            disabled={!!actionLoading}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 border-b shrink-0 px-4">
        {detailTabs.map((t) => (
          <button
            key={t.id}
            className={cn(
              "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
              subTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && <LoadingSpinner />}
        {error && <ErrorBlock msg={error} onRetry={load} />}
        {!loading && !error && data && (
          <div className="rounded-lg border bg-muted/30 overflow-auto">
            {subTab === "shards" && Array.isArray(data) ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left border-b">
                    {["shard", "prirep", "state", "docs", "store", "node"].map((h) => (
                      <th key={h} className="px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data as Record<string, string>[]).map((s, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-4 py-2 text-xs">{s.shard}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          s.prirep === "p" ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
                        )}>
                          {s.prirep === "p" ? "primary" : "replica"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">{s.state}</td>
                      <td className="px-4 py-2 text-xs">{s.docs ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{s.store ?? "—"}</td>
                      <td className="px-4 py-2 text-xs font-mono">{s.node ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Index</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <code className="text-foreground bg-muted px-1 rounded">{indexName}</code>? This
              action cannot be undone and all documents will be lost.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={doDelete}
                disabled={actionLoading === "delete"}
              >
                {actionLoading === "delete" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Tab: Search ──────────────────────────────────────────────────────────────

function SearchTab({ conn, initialIndex }: { conn: EsConnection; initialIndex?: string }) {
  const [indices, setIndices] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex ?? "*");
  const [query, setQuery] = useState('{\n  "query": {\n    "match_all": {}\n  }\n}');
  const [from, setFrom] = useState(0);
  const [size, setSize] = useState(10);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "raw">("table");
  const [copied, setCopied] = useState(false);
  const [allColumns, setAllColumns] = useState<{ name: string; type: string }[]>([]);

  const { data: billing } = useBillingStatus();
  const aiEnabled = billing != null && (billing.plan === "pro" || billing.plan === "max");
  const [aiSession, setAiSession] = useState<AiSession | undefined>();

  // Build a TableSchema from mapping fields so AiQueryBar can work with it
  const esSchema = useMemo<TableSchema[]>(() => {
    if (allColumns.length === 0) return [];
    return [{
      schema: "",
      name: selectedIndex || "*",
      type: "index",
      columns: allColumns.map(f => ({
        name: f.name,
        type: f.type,
        nullable: true,
        default: null,
        isPrimary: false,
        isUnique: false,
      })),
      indexes: [],
      rowEstimate: 0,
    }];
  }, [allColumns, selectedIndex]);

  useEffect(() => {
    esFetch(conn, "/_cat/indices?format=json&h=index")
      .then((d) => {
        const names = (d as { index: string }[]).map((i) => i.index).sort();
        setIndices(names);
      })
      .catch(() => {});
  }, [conn]);

  const extractMappingFields = useCallback((mappingData: Record<string, unknown>): { name: string; type: string }[] => {
    const seen = new Map<string, string>();
    for (const idx of Object.values(mappingData)) {
      const idxObj = idx as Record<string, unknown>;
      const mappings = idxObj?.mappings as Record<string, unknown> | undefined;
      const props = mappings?.properties as Record<string, { type?: string }> | undefined;
      if (props) {
        for (const [key, val] of Object.entries(props)) {
          if (!seen.has(key)) seen.set(key, val?.type ?? "");
        }
      }
    }
    return Array.from(seen.entries())
      .map(([name, type]) => ({ name, type }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const runQuery = useCallback(async (opts?: { isPageChange?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(query);
      } catch {
        throw new Error("Invalid JSON in query body");
      }
      body.from = from;
      body.size = size;
      const path = `/${selectedIndex}/_search`;

      if (!opts?.isPageChange && selectedIndex && selectedIndex !== "*") {
        try {
          const mapping = await esFetch(conn, `/${selectedIndex}/_mapping`) as Record<string, unknown>;
          const mappingFields = extractMappingFields(mapping);
          if (mappingFields.length > 0) setAllColumns(mappingFields);
        } catch {
          // non-critical
        }
      } else if (!opts?.isPageChange) {
        setAllColumns([]);
      }

      const data = await esFetch(conn, path, {
        method: "POST",
        body: JSON.stringify(body),
      }) as SearchResponse;
      setResults(data);

      const hits = data?.hits?.hits ?? [];
      if (hits.length > 0) {
        const newKeys = Array.from(new Set(hits.flatMap((h) => Object.keys(h._source))));
        setAllColumns((prev) => {
          const existingNames = new Set(prev.map((c) => c.name));
          const added = newKeys
            .filter((k) => !existingNames.has(k))
            .map((k) => ({ name: k, type: "" }));
          return added.length > 0 ? [...prev, ...added] : prev;
        });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [conn, query, selectedIndex, from, size, extractMappingFields]);

  const prevFrom = useRef(from);
  useEffect(() => {
    if (prevFrom.current !== from && results) {
      prevFrom.current = from;
      runQuery({ isPageChange: true });
    }
  }, [from, results, runQuery]);

  const copyResults = () => {
    if (!results) return;
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hits = results?.hits?.hits ?? [];
  const total = results?.hits?.total?.value ?? 0;
  const columns = allColumns;

  // Resizable editor + collapsible AI bar state
  const [editorHeight, setEditorHeight] = useState(200);
  const [aiBarOpen, setAiBarOpen] = useState(true);
  const editorResizing = useRef(false);

  const handleEditorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    editorResizing.current = true;
    const startY = e.clientY;
    const startH = editorHeight;
    const onMove = (ev: MouseEvent) => {
      if (!editorResizing.current) return;
      setEditorHeight(Math.max(80, Math.min(600, startH + (ev.clientY - startY))));
    };
    const onUp = () => {
      editorResizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [editorHeight]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Index</label>
          <select
            className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(e.target.value)}
          >
            <option value="*">* (all indices)</option>
            {indices.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="number"
            min={0}
            className="w-16 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Size</label>
          <input
            type="number"
            min={1}
            max={10000}
            className="w-16 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Editor — resizable */}
      <div
        className="border-b overflow-hidden shrink-0"
        style={{ height: `${editorHeight}px` }}
      >
        <div className="h-full overflow-auto">
          <JsonEditor value={query} onChange={setQuery} onRun={() => runQuery()} />
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleEditorResize}
        className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group"
        title="Drag to resize editor"
      >
        <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
      </div>

      {/* Run bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/10 shrink-0">
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => runQuery()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {loading ? "Running…" : "Run Query"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter
        </span>
        <div className="flex-1" />
        {results?.took != null && (
          <span className="text-xs text-muted-foreground tabular-nums">{results.took}ms</span>
        )}
        {hits.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{total.toLocaleString()} hits</span>
        )}
        <div className="flex items-center gap-2">
          {results && (
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button
                className={cn(
                  "px-3 py-1",
                  viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                )}
                onClick={() => setViewMode("table")}
              >
                Table
              </button>
              <button
                className={cn(
                  "px-3 py-1 border-l",
                  viewMode === "raw" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                )}
                onClick={() => setViewMode("raw")}
              >
                JSON
              </button>
            </div>
          )}
          {results && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={copyResults}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* AI Assistant header — collapsible toggle */}
      <button
        onClick={() => setAiBarOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 border-b shrink-0 text-left transition-colors",
          aiBarOpen ? "bg-primary/5 hover:bg-primary/10" : "bg-muted/10 hover:bg-muted/20"
        )}
      >
        <Sparkles className={cn("h-3 w-3 shrink-0", aiBarOpen ? "text-primary" : "text-muted-foreground/50")} />
        <span className={cn("text-xs font-medium", aiBarOpen ? "text-primary" : "text-muted-foreground/50")}>
          AI Assistant
        </span>
        {aiSession && aiSession.entries.length > 0 && (
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            {aiSession.entries.length} {aiSession.entries.length === 1 ? "prompt" : "prompts"}
          </span>
        )}
        <div className="flex-1" />
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            aiBarOpen ? "text-primary/60 rotate-180" : "text-muted-foreground/40"
          )}
        />
      </button>

      {/* AI bar — collapsible */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out shrink-0"
        style={{ gridTemplateRows: aiBarOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <AiQueryBar
            schema={esSchema}
            dialect="elasticsearch"
            onSqlGenerated={(json) => setQuery(json)}
            aiEnabled={aiEnabled}
            aiSession={aiSession}
            onAiSessionChange={setAiSession}
            getEditorContent={() => query}
            lastQuerySummary={
              results
                ? `${results.hits?.total?.value ?? 0} hits in ${results.took ?? 0}ms`
                : undefined
            }
          />
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {error ? (
          <div className="flex items-start gap-2 m-3 rounded-md bg-red-500/10 text-red-500 px-3 py-2 text-xs">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        ) : results ? (
          viewMode === "raw" ? (
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed">
              {JSON.stringify(results, null, 2)}
            </pre>
          ) : hits.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              No results
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-xs font-mono min-w-max">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap border-r border-border/30">_id</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap border-r border-border/30">_index</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap border-r border-border/30">_score</th>
                    {columns.map((col) => (
                      <th key={col.name} className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap border-r border-border/30">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hits.map((hit, ri) => (
                    <tr
                      key={hit._id}
                      className={cn(
                        "hover:bg-muted/30 border-b border-border/20",
                        ri % 2 === 1 && "bg-muted/10"
                      )}
                    >
                      <td className="px-3 py-1.5 border-r border-border/20 whitespace-nowrap max-w-xs text-muted-foreground truncate">
                        {hit._id}
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/20 whitespace-nowrap max-w-xs text-muted-foreground">
                        {hit._index}
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/20 whitespace-nowrap max-w-xs text-muted-foreground">
                        {hit._score != null ? hit._score.toFixed(3) : (
                          <span className="italic text-muted-foreground/50 text-[10px] bg-muted/40 px-1 rounded">NULL</span>
                        )}
                      </td>
                      {columns.map((col) => {
                        const val = hit._source[col.name];
                        const isNull = val === null || val === undefined;
                        const display = isNull
                          ? ""
                          : typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val);
                        return (
                          <td
                            key={col.name}
                            className="px-3 py-1.5 border-r border-border/20 whitespace-nowrap max-w-xs"
                            title={display}
                          >
                            {isNull ? (
                              <span className="italic text-muted-foreground/50 text-[10px] bg-muted/40 px-1 rounded">NULL</span>
                            ) : (
                              <span className="truncate block max-w-xs">{display}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Run a query to see results
          </div>
        )}

        {results && hits.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground shrink-0">
            <span>
              Showing {from + 1}–{Math.min(from + hits.length, total)} of {total.toLocaleString()}
              {results.hits.total.relation === "gte" && " (limited)"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={from === 0}
                onClick={() => setFrom(Math.max(0, from - size))}
              >
                <ChevronLeft className="h-3 w-3 mr-1" />Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={from + size >= total}
                onClick={() => setFrom(from + size)}
              >
                Next<ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Documents ───────────────────────────────────────────────────────────

// Generate a sample value for an ES mapping field type
function sampleValueForType(type: string): unknown {
  switch (type) {
    case "text":
    case "keyword":
    case "wildcard":
    case "constant_keyword":
      return "example";
    case "long":
    case "integer":
    case "short":
    case "byte":
      return 0;
    case "double":
    case "float":
    case "half_float":
    case "scaled_float":
      return 0.0;
    case "boolean":
      return true;
    case "date":
    case "date_nanos":
      return new Date().toISOString();
    case "ip":
      return "127.0.0.1";
    case "geo_point":
      return { lat: 0.0, lon: 0.0 };
    case "geo_shape":
      return { type: "point", coordinates: [0.0, 0.0] };
    case "binary":
      return "base64data";
    case "nested":
    case "object":
      return {};
    default:
      return null;
  }
}

// Build a sample document from ES mapping properties (top-level only)
function buildSampleFromMapping(mappingData: Record<string, unknown>): Record<string, unknown> | null {
  // mappingData is { indexName: { mappings: { properties: { ... } } } }
  for (const idx of Object.values(mappingData)) {
    const idxObj = idx as Record<string, unknown>;
    const mappings = idxObj?.mappings as Record<string, unknown> | undefined;
    const props = mappings?.properties as Record<string, unknown> | undefined;
    if (props) {
      const sample: Record<string, unknown> = {};
      for (const [key, def] of Object.entries(props)) {
        const fieldDef = def as Record<string, unknown>;
        const type = fieldDef.type as string | undefined;
        // For nested objects with their own properties, recurse one level
        if (fieldDef.properties && !type) {
          const nested: Record<string, unknown> = {};
          const nestedProps = fieldDef.properties as Record<string, unknown>;
          for (const [nk, nd] of Object.entries(nestedProps)) {
            const nDef = nd as Record<string, unknown>;
            const nType = nDef.type as string | undefined;
            nested[nk] = nType ? sampleValueForType(nType) : null;
          }
          sample[key] = nested;
        } else if (type) {
          sample[key] = sampleValueForType(type);
        } else {
          sample[key] = null;
        }
      }
      return sample;
    }
  }
  return null;
}

function DocumentsTab({ conn }: { conn: EsConnection }) {
  const [mode, setMode] = useState<"create" | "update">("create");
  const [indices, setIndices] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState("");
  const [docId, setDocId] = useState("");
  const [body, setBody] = useState('{\n  \n}');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load indices list
  useEffect(() => {
    let cancelled = false;
    esFetch(conn, "/_cat/indices?format=json&h=index")
      .then((d) => {
        if (cancelled) return;
        const names = (d as { index: string }[]).map((i) => i.index).sort();
        setIndices(names);
        if (names.length > 0) setSelectedIndex((prev) => prev || names[0]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conn]);

  // Load sample from mapping whenever selectedIndex changes
  useEffect(() => {
    if (!selectedIndex) return;
    let cancelled = false;
    esFetch(conn, `/${selectedIndex}/_mapping`)
      .then((mapping) => {
        if (cancelled) return;
        const sample = buildSampleFromMapping(mapping as Record<string, unknown>);
        if (sample && Object.keys(sample).length > 0) {
          setBody(JSON.stringify(sample, null, 2));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conn, selectedIndex]);

  // Reset state when switching modes
  const switchMode = (m: "create" | "update") => {
    setMode(m);
    setResult(null);
    setError(null);
  };

  const doSubmit = async () => {
    if (!selectedIndex) return;
    if (mode === "update" && !docId.trim()) {
      setError("Document ID is required for updates");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error("Invalid JSON body");
      }
      const path = docId.trim()
        ? `/${selectedIndex}/_doc/${encodeURIComponent(docId.trim())}`
        : `/${selectedIndex}/_doc`;
      const method = docId.trim() ? "PUT" : "POST";
      const data = await esFetch(conn, path, { method, body: JSON.stringify(parsed) });
      setResult(data as Record<string, unknown>);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  const modes = [
    { id: "create" as const, label: "Create" },
    { id: "update" as const, label: "Update" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mode tabs */}
      <div className="flex gap-1 px-3 border-b shrink-0">
        {modes.map((m) => (
          <button
            key={m.id}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              mode === m.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => switchMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-xl space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Index</label>
            <select
              className={inputClass}
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(e.target.value)}
            >
              {indices.map((i) => <option key={i} value={i}>{i}</option>)}
              {indices.length === 0 && <option value="">No indices</option>}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Document ID
              {mode === "create" && (
                <span className="text-muted-foreground/60 font-normal ml-1">(optional — auto-generated if empty)</span>
              )}
            </label>
            <input
              className={inputClass}
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              placeholder={mode === "create" ? "optional-id" : "document-id"}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Document Body (JSON)
            </label>
            <div style={{ height: 220 }}>
              <JsonEditor value={body} onChange={setBody} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={doSubmit}
              disabled={loading || !selectedIndex || (mode === "update" && !docId.trim())}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {mode === "create" ? "Create Document" : "Update Document"}
            </Button>
            {mode === "create" && (
              <span className="text-xs text-muted-foreground">
                Uses POST (auto-ID) or PUT (with ID)
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 text-red-500 px-3 py-2 text-xs">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Document {mode === "create" ? "created" : "updated"} successfully
                </span>
              </div>
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-40 leading-relaxed">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Aliases ─────────────────────────────────────────────────────────────

function AliasesTab({ conn }: { conn: EsConnection }) {
  const [aliases, setAliases] = useState<AliasInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [newIndex, setNewIndex] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ alias: string; index: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [indices, setIndices] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [aliasData, indexData] = await Promise.all([
        esFetch(conn, "/_cat/aliases?format=json") as Promise<AliasInfo[]>,
        esFetch(conn, "/_cat/indices?format=json&h=index") as Promise<{ index: string }[]>,
      ]);
      setAliases(aliasData);
      setIndices(indexData.map((i) => i.index).sort());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => { load(); }, [load]);

  const doCreate = async () => {
    if (!newAlias.trim() || !newIndex.trim()) {
      setCreateError("Alias name and index are required");
      return;
    }
    setCreateError(null);
    setActionLoading(true);
    try {
      await esFetch(conn, "/_aliases", {
        method: "POST",
        body: JSON.stringify({
          actions: [{ add: { index: newIndex.trim(), alias: newAlias.trim() } }],
        }),
      });
      setCreateOpen(false);
      setNewAlias("");
      await load();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const doDelete = async (alias: string, index: string) => {
    setActionLoading(true);
    try {
      await esFetch(conn, "/_aliases", {
        method: "POST",
        body: JSON.stringify({
          actions: [{ remove: { index, alias } }],
        }),
      });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4"><ErrorBlock msg={error} onRetry={load} /></div>;

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{aliases.length} Alias{aliases.length !== 1 ? "es" : ""}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Alias
            </Button>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left border-b">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Alias</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Index</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Write Index</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Filter</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aliases.map((a, i) => (
                <tr key={`${a.alias}-${a.index}-${i}`} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium">{a.alias}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.index}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {a.is_write_index === "true" ? (
                      <span className="text-green-500">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {a.filter || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => setConfirmDelete({ alias: a.alias, index: a.index })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {aliases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No aliases found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create Alias</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Alias Name</label>
                <input
                  className={inputClass}
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="my-alias"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Target Index</label>
                <select
                  className={cn(inputClass)}
                  value={newIndex}
                  onChange={(e) => setNewIndex(e.target.value)}
                >
                  <option value="">Select index…</option>
                  {indices.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              {createError && <p className="text-xs text-red-500 break-all">{createError}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={doCreate} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {confirmDelete && (
          <Dialog open onOpenChange={() => setConfirmDelete(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete Alias</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Remove alias <code className="text-foreground bg-muted px-1 rounded">{confirmDelete.alias}</code>{" "}
                from index <code className="text-foreground bg-muted px-1 rounded">{confirmDelete.index}</code>?
              </p>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => doDelete(confirmDelete.alias, confirmDelete.index)}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ─── Create Index Dialog ──────────────────────────────────────────────────────

function CreateIndexDialog({
  conn,
  onCreated,
  onClose,
}: {
  conn: EsConnection;
  onCreated: (name: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newShards, setNewShards] = useState("1");
  const [newReplicas, setNewReplicas] = useState("1");
  const [createError, setCreateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  const doCreate = async () => {
    setCreateError(null);
    if (!newName.trim()) { setCreateError("Index name is required"); return; }
    setLoading(true);
    try {
      await esFetch(conn, `/${newName.trim()}`, {
        method: "PUT",
        body: JSON.stringify({
          settings: {
            number_of_shards: parseInt(newShards, 10),
            number_of_replicas: parseInt(newReplicas, 10),
          },
        }),
      });
      onCreated(newName.trim());
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Index</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Index Name
            </label>
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="my-index"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Primary Shards
              </label>
              <input
                className={inputClass}
                type="number"
                min={1}
                value={newShards}
                onChange={(e) => setNewShards(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Replicas
              </label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={newReplicas}
                onChange={(e) => setNewReplicas(e.target.value)}
              />
            </div>
          </div>
          {createError && (
            <p className="text-xs text-red-500 break-all">{createError}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={doCreate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Create Index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function tabLabel(tab: EsTab): string {
  switch (tab.type) {
    case "overview": return "Overview";
    case "nodes": return "Nodes";
    case "index": return tab.indexName;
    case "search": return tab.title;
    case "documents": return "Documents";
    case "aliases": return "Aliases";
  }
}

function TabIcon({ tab }: { tab: EsTab }) {
  switch (tab.type) {
    case "overview": return <Activity className="h-3 w-3 shrink-0" />;
    case "nodes": return <Server className="h-3 w-3 shrink-0" />;
    case "index": return <Database className="h-3 w-3 shrink-0" />;
    case "search": return <Search className="h-3 w-3 shrink-0" />;
    case "documents": return <FileText className="h-3 w-3 shrink-0" />;
    case "aliases": return <GitBranch className="h-3 w-3 shrink-0" />;
  }
}

function EsTabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNewQuery,
}: {
  tabs: EsTab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNewQuery: () => void;
}) {
  return (
    <div className="flex items-end border-b bg-muted/10 overflow-x-auto shrink-0 min-h-[36px]">
      <div className="flex items-end min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
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
              <TabIcon tab={tab} />
              <span className="truncate font-medium">{tabLabel(tab)}</span>
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
                aria-label={`Close ${tabLabel(tab)}`}
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface EsSidebarProps {
  conn: EsConnection;
  onOpenOverview: () => void;
  onOpenNodes: () => void;
  onOpenAliases: () => void;
  onOpenIndex: (name: string) => void;
  onNewQuery: () => void;
  onOpenDocuments: () => void;
  activeTabType: string | null;
  activeIndexName: string | null;
  indices: IndexInfo[];
  indicesLoading: boolean;
  indicesError: string | null;
  onRefreshIndices: () => void;
  onCreateIndex: () => void;
}

function EsSidebar({
  conn,
  onOpenOverview,
  onOpenNodes,
  onOpenAliases,
  onOpenIndex,
  onNewQuery,
  onOpenDocuments,
  activeTabType,
  activeIndexName,
  indices,
  indicesLoading,
  indicesError,
  onRefreshIndices,
  onCreateIndex,
}: EsSidebarProps) {
  const [search, setSearch] = useState("");
  const [hideSystem, setHideSystem] = useState(true);

  const filtered = indices.filter((idx) => {
    if (hideSystem && idx.index.startsWith(".")) return false;
    if (search && !idx.index.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const systemCount = indices.filter((i) => i.index.startsWith(".")).length;

  const clusterNavItems = [
    { id: "overview", label: "Overview", icon: <Activity className="h-3.5 w-3.5" />, action: onOpenOverview },
    { id: "nodes", label: "Nodes", icon: <Server className="h-3.5 w-3.5" />, action: onOpenNodes },
    { id: "aliases", label: "Aliases", icon: <GitBranch className="h-3.5 w-3.5" />, action: onOpenAliases },
    { id: "documents", label: "Documents", icon: <FileText className="h-3.5 w-3.5" />, action: onOpenDocuments },
  ] as const;

  return (
    <aside className="w-64 shrink-0 border-r flex flex-col overflow-hidden bg-muted/20">
      {/* Cluster nav */}
      <div className="border-b shrink-0 px-1.5 py-1">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Cluster
        </p>
        {clusterNavItems.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors",
              activeTabType === item.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Indices section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-1.5 pt-2 pb-1 shrink-0">
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Indices
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={onRefreshIndices}
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh indices"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
              <button
                onClick={onCreateIndex}
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Create new index"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter indices…"
              className={cn(
                "w-full pl-7 pr-2 py-1 text-xs rounded-md border bg-background",
                "focus:outline-none focus:ring-1 focus:ring-primary/50"
              )}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-1 space-y-0.5">
          {indicesLoading && (
            <div className="space-y-1.5 px-1 pt-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-6 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {!indicesLoading && indicesError && (
            <p className="px-2 py-3 text-xs text-red-500 text-center break-all">
              {indicesError}
            </p>
          )}
          {!indicesLoading && !indicesError && filtered.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground text-center">
              {search ? "No matching indices" : "No indices found"}
            </p>
          )}
          {!indicesLoading &&
            filtered.map((idx) => (
              <button
                key={idx.index}
                onClick={() => onOpenIndex(idx.index)}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left group",
                  activeTabType === "index" && activeIndexName === idx.index
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", healthDot(idx.health))} />
                <span className="font-mono flex-1 truncate">{idx.index}</span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                  {formatDocCount(Number(idx["docs.count"]))}
                </span>
              </button>
            ))}
          {!indicesLoading && !indicesError && systemCount > 0 && (
            <button
              onClick={() => setHideSystem((h) => !h)}
              className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {hideSystem ? (
                <>{systemCount} system indices hidden</>
              ) : (
                <>Hide system indices</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t p-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs h-8"
          onClick={onNewQuery}
        >
          <Search className="h-3.5 w-3.5" />
          New Query
        </Button>
      </div>
    </aside>
  );
}

// ─── Sync Menu ────────────────────────────────────────────────────────────────

interface SyncControls {
  syncMode: "local" | "cloud";
  setSyncMode: (mode: "local" | "cloud") => void;
  pushToCloud: () => Promise<void>;
  isSyncing: boolean;
  isLoggedIn: boolean;
}

function EsSyncMenu({ connSync, stateSync }: { connSync: SyncControls; stateSync: SyncControls }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const anyCloud = connSync.syncMode === "cloud" || stateSync.syncMode === "cloud";
  const anySyncing = connSync.isSyncing || stateSync.isSyncing;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen((p) => !p)}
        disabled={!connSync.isLoggedIn}
        title={!connSync.isLoggedIn ? "Sign in to sync" : "Cloud sync settings"}
      >
        {anySyncing ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !connSync.isLoggedIn ? (
          <GlobeLock className="h-4 w-4 text-muted-foreground/50" />
        ) : anyCloud ? (
          <Globe className="h-4 w-4 text-primary" />
        ) : (
          <GlobeLock className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-lg border bg-popover shadow-lg p-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 py-1">
            Cloud Sync
          </p>
          <SyncRow
            label="Connections"
            description="Saved cluster connections"
            syncMode={connSync.syncMode}
            isSyncing={connSync.isSyncing}
            onToggle={() => connSync.setSyncMode(connSync.syncMode === "cloud" ? "local" : "cloud")}
          />
          <SyncRow
            label="Explorer State"
            description="Tabs, queries, active connection"
            syncMode={stateSync.syncMode}
            isSyncing={stateSync.isSyncing}
            onToggle={() => stateSync.setSyncMode(stateSync.syncMode === "cloud" ? "local" : "cloud")}
          />
          {(connSync.syncMode === "cloud" || stateSync.syncMode === "cloud") && (
            <div className="border-t pt-1.5 mt-1.5">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => {
                  if (connSync.syncMode === "cloud") connSync.pushToCloud();
                  if (stateSync.syncMode === "cloud") stateSync.pushToCloud();
                }}
                disabled={anySyncing}
              >
                <RefreshCw className={cn("h-3 w-3", anySyncing && "animate-spin")} />
                Push all to cloud
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SyncRow({
  label,
  description,
  syncMode,
  isSyncing,
  onToggle,
}: {
  label: string;
  description: string;
  syncMode: "local" | "cloud";
  isSyncing: boolean;
  onToggle: () => void;
}) {
  const isCloud = syncMode === "cloud";
  return (
    <button
      className={cn(
        "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-left transition-colors",
        isCloud ? "bg-primary/5" : "hover:bg-muted/50",
      )}
      onClick={onToggle}
    >
      <div className={cn(
        "h-4 w-7 rounded-full relative transition-colors shrink-0",
        isCloud ? "bg-primary" : "bg-muted-foreground/20",
      )}>
        <div className={cn(
          "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all shadow-sm",
          isCloud ? "left-3.5" : "left-0.5",
        )} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{description}</p>
      </div>
      {isSyncing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
    </button>
  );
}

// ─── Connections Dialog ───────────────────────────────────────────────────────

function ConnectionsDialog({
  connections,
  activeConnId,
  connStatusMap,
  connVersionMap,
  onSwitch,
  onEdit,
  onDelete,
  onAdd,
  onClose,
}: {
  connections: EsConnection[];
  activeConnId: string | null;
  connStatusMap: Record<string, ConnectionStatus>;
  connVersionMap: Record<string, string>;
  onSwitch: (id: string) => void;
  onEdit: (conn: EsConnection) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connections</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
          {connections.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No connections yet
            </p>
          )}
          {connections.map((c) => {
            const st = connStatusMap[c.id] ?? "idle";
            const ver = connVersionMap[c.id] ?? "";
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                  c.id === activeConnId
                    ? "bg-muted ring-1 ring-primary/20"
                    : "hover:bg-muted/50"
                )}
                onClick={() => onSwitch(c.id)}
              >
                <span className="shrink-0 flex items-center">
                  {st === "checking" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : st === "ok" ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
                  ) : st === "error" ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 inline-block" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {ver ? `v${ver} · ` : ""}{c.url}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => { e.stopPropagation(); onEdit(c); }}
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-red-500 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4" />
            Add Connection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── No-connection empty state ────────────────────────────────────────────────

function NoConnectionState({ onAdd }: { onAdd: () => void }) {
  const { data: session } = useSession();
  const [tunnelOpen, setTunnelOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-4 text-center p-8">
      <div className="rounded-full bg-muted p-4">
        <Database className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="text-base font-semibold">No connections configured</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add an Elasticsearch cluster to get started
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onAdd} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Connection
        </Button>
        {session?.user && (
          <>
            <Button variant="outline" size="sm" onClick={() => setTunnelOpen(true)}>
              <Wifi className="h-4 w-4 mr-1.5" />
              Connect via Tunnel
            </Button>
            <TunnelConnectDialog open={tunnelOpen} onOpenChange={setTunnelOpen} />
          </>
        )}
      </div>
      {!session?.user && (
        <p className="text-xs text-muted-foreground/60">
          <Link href="/account" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Sign in
          </Link>{" "}
          to connect your own cluster via a secure tunnel
        </p>
      )}
    </div>
  );
}

// ─── No-tab empty state ───────────────────────────────────────────────────────

function NoTabState({ onNewQuery }: { onNewQuery: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <Activity className="h-10 w-10 text-muted-foreground/30" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Select an item from the sidebar
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          or{" "}
          <button
            onClick={onNewQuery}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            open a new query
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ElasticsearchExplorer({ tunnelMode }: { tunnelMode?: boolean } = {}) {
  // Synced connections
  const connSync = useSyncedState<EsConnection[]>("1tt:es-connections", []);
  const connections = tunnelMode
    ? [{ id: "tunnel", name: "Tunnel", url: "", authType: "none" as AuthType }]
    : connSync.data;
  const setConnections = connSync.setData;

  // Synced explorer state (tabs, active connection, query counter, saved queries)
  const stateSync = useSyncedState<EsPersistedState>("1tt:es-state", DEFAULT_ES_STATE);
  const esState = stateSync.data;
  const setEsState = stateSync.setData;

  const activeConnId = tunnelMode ? "tunnel" : esState.activeConnId;
  const setActiveConnId = useCallback((id: string | null) => {
    if (tunnelMode) return;
    setEsState((prev) => ({ ...prev, activeConnId: id }));
  }, [setEsState, tunnelMode]);

  const tabs = esState.tabs;
  const setTabs = useCallback((updater: EsTab[] | ((prev: EsTab[]) => EsTab[])) => {
    setEsState((prev) => ({
      ...prev,
      tabs: typeof updater === "function" ? updater(prev.tabs) : updater,
    }));
  }, [setEsState]);

  const activeTabId = esState.activeTabId;
  const setActiveTabId = useCallback((updater: string | null | ((prev: string | null) => string | null)) => {
    setEsState((prev) => ({
      ...prev,
      activeTabId: typeof updater === "function" ? updater(prev.activeTabId) : updater,
    }));
  }, [setEsState]);

  const [formOpen, setFormOpen] = useState(false);
  const [editConn, setEditConn] = useState<EsConnection | undefined>(undefined);
  const [connStatus, setConnStatus] = useState<Record<string, ConnectionStatus>>({});
  const [connVersion, setConnVersion] = useState<Record<string, string>>({});
  const [confirmDeleteConn, setConfirmDeleteConn] = useState<string | null>(null);
  const [createIndexOpen, setCreateIndexOpen] = useState(false);

  // Indices sidebar state (owned here so sidebar and tab actions can share)
  const [indices, setIndices] = useState<IndexInfo[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [indicesError, setIndicesError] = useState<string | null>(null);

  // Set initial active connection when connections load and none is selected
  useEffect(() => {
    if (connections.length > 0 && !activeConnId) {
      setActiveConnId(connections[0].id);
    }
  }, [connections, activeConnId, setActiveConnId]);

  const activeConn = connections.find((c) => c.id === activeConnId) ?? null;

  // Load indices when connection changes
  const loadIndices = useCallback(async (conn: EsConnection) => {
    setIndicesLoading(true);
    setIndicesError(null);
    try {
      const data = await esFetch(
        conn,
        "/_cat/indices?format=json&bytes=b&h=index,health,status,pri,rep,docs.count,docs.deleted,store.size,pri.store.size"
      ) as IndexInfo[];
      setIndices(data);
    } catch (e) {
      setIndicesError(String(e));
    } finally {
      setIndicesLoading(false);
    }
  }, []);

  const checkConnStatus = useCallback(async (conn: EsConnection) => {
    setConnStatus((prev) => ({ ...prev, [conn.id]: "checking" }));
    try {
      const data = await esFetch(conn, "/") as ClusterInfo;
      setConnStatus((prev) => ({ ...prev, [conn.id]: "ok" }));
      setConnVersion((prev) => ({ ...prev, [conn.id]: data.version?.number ?? "" }));
    } catch {
      setConnStatus((prev) => ({ ...prev, [conn.id]: "error" }));
    }
  }, []);

  // Track whether this is the first render so we preserve persisted tabs
  const isInitialMount = useRef(true);

  // When active connection changes, check status, load indices
  useEffect(() => {
    if (!activeConn) {
      setIndices([]);
      return;
    }
    checkConnStatus(activeConn);
    loadIndices(activeConn);

    if (isInitialMount.current) {
      // On first mount, keep persisted tabs; if none, open overview
      isInitialMount.current = false;
      if (tabs.length === 0) {
        const overviewTab: EsTab = { id: "tab:overview", type: "overview" };
        setTabs([overviewTab]);
        setActiveTabId(overviewTab.id);
      }
    } else {
      // User switched connections — reset to overview
      const overviewTab: EsTab = { id: "tab:overview", type: "overview" };
      setTabs([overviewTab]);
      setActiveTabId(overviewTab.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnId]);

  const handleSaveConn = (conn: EsConnection) => {
    setConnections((prev) => {
      const exists = prev.find((c) => c.id === conn.id);
      return exists ? prev.map((c) => (c.id === conn.id ? conn : c)) : [...prev, conn];
    });
    setActiveConnId(conn.id);
    setFormOpen(false);
    setEditConn(undefined);
  };

  const handleDeleteConn = (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
    if (activeConnId === id) {
      const remaining = connections.filter((c) => c.id !== id);
      setActiveConnId(remaining.length > 0 ? remaining[0].id : null);
    }
    setConfirmDeleteConn(null);
  };

  // Tab management
  const openTab = useCallback((tab: EsTab) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === tab.id);
      if (existing) return prev;
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((cur) => {
        if (cur !== id) return cur;
        return next[Math.min(idx, next.length - 1)]?.id ?? null;
      });
      return next;
    });
  }, []);

  const openOverview = useCallback(() => {
    openTab({ id: "tab:overview", type: "overview" });
  }, [openTab]);

  const openNodes = useCallback(() => {
    openTab({ id: "tab:nodes", type: "nodes" });
  }, [openTab]);

  const openAliases = useCallback(() => {
    openTab({ id: "tab:aliases", type: "aliases" });
  }, [openTab]);

  const openDocuments = useCallback(() => {
    openTab({ id: "tab:documents", type: "documents" });
  }, [openTab]);

  const openIndex = useCallback((indexName: string) => {
    openTab({ id: `tab:index:${indexName}`, type: "index", indexName });
  }, [openTab]);

  const openNewQuery = useCallback(() => {
    setEsState((prev) => {
      const n = prev.queryCounter;
      const newTab: EsTab = { id: `tab:query:${n}`, type: "search", title: `Query ${n}` };
      return {
        ...prev,
        queryCounter: n + 1,
        tabs: prev.tabs.find((t) => t.id === newTab.id) ? prev.tabs : [...prev.tabs, newTab],
        activeTabId: newTab.id,
      };
    });
  }, [setEsState]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTabType = activeTab?.type ?? null;
  const activeIndexName = activeTab?.type === "index" ? activeTab.indexName : null;

  const [showConnDialog, setShowConnDialog] = useState(false);
  const [showTunnelDialog, setShowTunnelDialog] = useState(false);
  const { data: session } = useSession();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="border-b shrink-0">
        <div className="flex items-center gap-2 px-4 py-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Elasticsearch Explorer</span>
          <div className="flex items-center gap-2 ml-auto">
            {!tunnelMode && session?.user && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => setShowTunnelDialog(true)}
                >
                  <Wifi className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tunnel</span>
                </Button>
                <TunnelConnectDialog open={showTunnelDialog} onOpenChange={setShowTunnelDialog} />
              </>
            )}
            <Link
              href="/docs/elasticsearch"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Docs</span>
            </Link>
            {!tunnelMode && <EsSyncMenu connSync={connSync} stateSync={stateSync} />}
            {!tunnelMode && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => setShowConnDialog(true)}
              >
                <Server className="h-3.5 w-3.5" />
                {activeConn ? activeConn.name : "Connections"}
                {activeConn && (
                  <span className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    connStatus[activeConn.id] === "ok" ? "bg-green-500"
                      : connStatus[activeConn.id] === "error" ? "bg-red-500"
                      : connStatus[activeConn.id] === "checking" ? "bg-yellow-500 animate-pulse"
                      : "bg-muted-foreground/40"
                  )} />
                )}
              </Button>
            )}
            {tunnelMode && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <Wifi className="h-3.5 w-3.5" />
                <span className="font-medium">Tunnel Connected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connections dialog */}
      {showConnDialog && (
        <ConnectionsDialog
          connections={connections}
          activeConnId={activeConnId}
          connStatusMap={connStatus}
          connVersionMap={connVersion}
          onSwitch={(id) => { setActiveConnId(id); setShowConnDialog(false); }}
          onEdit={(c) => { setEditConn(c); setFormOpen(true); setShowConnDialog(false); }}
          onDelete={(id) => { setConfirmDeleteConn(id); setShowConnDialog(false); }}
          onAdd={() => { setEditConn(undefined); setFormOpen(true); setShowConnDialog(false); }}
          onClose={() => setShowConnDialog(false)}
        />
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {!activeConn ? (
        <NoConnectionState onAdd={() => setFormOpen(true)} />
      ) : (
        <>
          {/* Sidebar */}
          <EsSidebar
            conn={activeConn}
            onOpenOverview={openOverview}
            onOpenNodes={openNodes}
            onOpenAliases={openAliases}
            onOpenIndex={openIndex}
            onNewQuery={openNewQuery}
            onOpenDocuments={openDocuments}
            activeTabType={activeTabType}
            activeIndexName={activeIndexName}
            indices={indices}
            indicesLoading={indicesLoading}
            indicesError={indicesError}
            onRefreshIndices={() => loadIndices(activeConn)}
            onCreateIndex={() => setCreateIndexOpen(true)}
          />

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <EsTabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSwitch={setActiveTabId}
              onClose={closeTab}
              onNewQuery={openNewQuery}
            />

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === null ? (
                <NoTabState onNewQuery={openNewQuery} />
              ) : activeTab.type === "overview" ? (
                <OverviewTab key={activeConn.id} conn={activeConn} />
              ) : activeTab.type === "nodes" ? (
                <NodesTab key={activeConn.id} conn={activeConn} />
              ) : activeTab.type === "index" ? (
                <IndexDetailTab
                  key={activeTab.id}
                  conn={activeConn}
                  indexName={activeTab.indexName}
                  onDelete={() => {
                    closeTab(activeTab.id);
                    loadIndices(activeConn);
                  }}
                />
              ) : activeTab.type === "search" ? (
                <SearchTab key={activeTab.id} conn={activeConn} />
              ) : activeTab.type === "documents" ? (
                <DocumentsTab key={activeConn.id} conn={activeConn} />
              ) : activeTab.type === "aliases" ? (
                <AliasesTab key={activeConn.id} conn={activeConn} />
              ) : null}
            </div>
          </div>
        </>
      )}
      </div>

      {/* Dialogs */}
      {formOpen && (
        <ConnectionFormDialog
          initial={editConn}
          onSave={handleSaveConn}
          onClose={() => {
            setFormOpen(false);
            setEditConn(undefined);
          }}
        />
      )}

      {createIndexOpen && activeConn && (
        <CreateIndexDialog
          conn={activeConn}
          onCreated={(name) => {
            setCreateIndexOpen(false);
            loadIndices(activeConn);
            openIndex(name);
          }}
          onClose={() => setCreateIndexOpen(false)}
        />
      )}

      {confirmDeleteConn && (
        <Dialog open onOpenChange={() => setConfirmDeleteConn(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Connection</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Remove connection{" "}
              <strong className="text-foreground">
                {connections.find((c) => c.id === confirmDeleteConn)?.name}
              </strong>
              ? This only removes the saved config — no data is deleted.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteConn(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteConn(confirmDeleteConn)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
