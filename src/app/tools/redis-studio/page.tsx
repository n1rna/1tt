import Link from "next/link";
import {
  Database,
  ChevronLeft,
  ChevronRight,
  Link2,
  BarChart3,
  Activity,
  Terminal,
  Boxes,
  Plus,
  X,
  BookOpen,
  Globe,
  Clock,
  GripHorizontal,
  Play,
  Sparkles,
  RotateCw,
} from "lucide-react";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "redis-studio",
  title: "Redis Studio - Browser-Based Redis Client & Key Browser",
  description:
    "Browse Redis keys, run commands, monitor performance, and manage streams and consumer groups - all from the browser. Works with managed Upstash databases or your own Redis instance via tunnel.",
  keywords: [
    "redis studio",
    "redis client",
    "redis browser",
    "redis gui",
    "redis commands",
    "upstash redis",
    "redis key browser",
    "redis monitor",
    "redis streams",
    "redis web client",
  ],
});

export default function RedisStudioPage() {
  const jsonLd = toolJsonLd("redis-studio");
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; }`}</style>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      {/* Full-screen layout — no ToolLayout wrapper */}
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <div className="border-b shrink-0">
          <div className="flex items-center gap-2 px-4 py-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Redis Studio</span>
            <div className="flex items-center gap-1 ml-auto">
              <Link
                href="/docs/redis-studio"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Docs</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Body: mockup left + info panel right */}
        <div className="flex flex-1 min-h-0">
          {/* ── Left: Static Studio Mockup ── */}
          <div
            className="hidden lg:flex lg:w-[55%] flex-col border-r overflow-hidden pointer-events-none select-none opacity-90 shrink-0"
            aria-hidden="true"
          >
            {/* Studio shell — exact replica of redis-studio.tsx structure */}
            <div className="flex h-full overflow-hidden">
              {/* Sidebar */}
              <aside className="w-64 shrink-0 border-r flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-3 py-2.5 border-b space-y-1.5 shrink-0">
                  {/* Back link */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChevronLeft className="h-3 w-3" />
                    All databases
                  </div>
                  {/* DB name + connection icon */}
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold truncate flex-1 min-w-0">
                      cache-prod
                    </span>
                    <div className="h-6 w-6 shrink-0 flex items-center justify-center">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  {/* Badges */}
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                      Redis
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      us-east-1
                    </span>
                  </div>
                </div>

                {/* Navigation */}
                <div className="shrink-0 border-b py-1">
                  {[
                    { id: "metrics", label: "Metrics", Icon: BarChart3, active: false },
                    { id: "monitor", label: "Live Monitor", Icon: Activity, active: false },
                    { id: "query", label: "New Query", Icon: Terminal, active: true },
                  ].map(({ id, label, Icon, active }) => (
                    <div
                      key={id}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                      {id === "query" && (
                        <Plus className="h-3 w-3 ml-auto shrink-0 opacity-50" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Views section */}
                <div className="flex-1 overflow-y-auto py-2">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Data
                  </p>
                  {[
                    { label: "Key Explorer", Icon: Database },
                    { label: "Stream Groups", Icon: Activity },
                  ].map(({ label, Icon }) => (
                    <div
                      key={label}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </div>
                  ))}

                  <p className="px-3 py-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Frameworks
                  </p>
                  {["BullMQ", "Sidekiq", "Celery"].map((label) => (
                    <div
                      key={label}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground"
                    >
                      <Boxes className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>
              </aside>

              {/* Main area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tab bar */}
                <div className="flex items-end border-b bg-muted/10 overflow-x-auto shrink-0 min-h-[36px]">
                  <div className="flex items-end min-w-0">
                    {/* Active tab: Query 1 */}
                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer select-none border-r border-border/50 shrink-0 max-w-[160px] bg-background border-b-2 border-b-primary text-foreground">
                      <Terminal className="h-3 w-3 shrink-0" />
                      <span className="truncate font-medium">Query 1</span>
                      <span className="shrink-0 rounded hover:bg-muted p-0.5 -mr-0.5 opacity-60">
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </div>
                    {/* Inactive tab: Metrics */}
                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer select-none border-r border-border/50 shrink-0 max-w-[160px] text-muted-foreground">
                      <BarChart3 className="h-3 w-3 shrink-0" />
                      <span className="truncate font-medium">Metrics</span>
                      <span className="shrink-0 rounded hover:bg-muted p-0.5 -mr-0.5 opacity-0">
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-8 w-8 shrink-0 ml-0.5 text-muted-foreground rounded-sm">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1" />
                </div>

                {/* QueryTab - exact replica of real layout */}
                <div className="flex flex-col h-full overflow-hidden">
                  {/* History panel (collapsed) */}
                  <div className="shrink-0 flex flex-col overflow-hidden">
                    <div className="px-3 py-1.5 bg-muted/20 border-b flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 rotate-90" />
                      <Clock className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">History</span>
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums">3</span>
                    </div>
                    <div className="overflow-y-auto border-b" style={{ maxHeight: "120px" }}>
                      {[
                        { cmd: "SCAN 0 MATCH user:* COUNT 20", time: "14:23:01" },
                        { cmd: "HGETALL user:1001", time: "14:23:08" },
                        { cmd: "TTL user:1001", time: "14:23:15" },
                      ].map((h, i) => (
                        <div key={i} className="border-b border-border/20 last:border-b-0">
                          <div className="w-full flex items-center gap-2 px-3 py-1.5 text-left group">
                            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                            <span className="text-[11px] font-mono text-foreground truncate flex-1 min-w-0">{h.cmd}</span>
                            <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">{h.time}</span>
                            <RotateCw className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-1 shrink-0 flex items-center justify-center">
                      <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground/30" />
                    </div>
                  </div>

                  {/* Input row */}
                  <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">&gt;</span>
                    <span className="flex-1 text-xs font-mono text-muted-foreground/50">Enter a Redis command (e.g. SCAN 0 MATCH * COUNT 20)</span>
                    <div className="h-7 w-7 shrink-0 flex items-center justify-center">
                      <Play className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* AI Assistant toggle */}
                  <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b">
                    <Sparkles className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-xs font-medium text-muted-foreground/50">AI Assistant</span>
                  </div>

                  {/* Result area - scrollback */}
                  <div className="flex-1 overflow-auto p-3 space-y-3 font-mono text-xs">
                    {/* SCAN result */}
                    <div>
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground shrink-0">&gt;</span>
                        <span className="text-foreground">SCAN 0 MATCH <span className="text-green-600 dark:text-green-400">user:*</span> COUNT 20</span>
                      </div>
                      <div className="mt-1 ml-4 text-muted-foreground leading-relaxed">
                        <div>1) <span className="text-yellow-600 dark:text-yellow-400">&quot;14&quot;</span></div>
                        <div>2) 1) <span className="text-green-600 dark:text-green-400">&quot;user:1001&quot;</span></div>
                        <div>&nbsp;&nbsp;&nbsp;2) <span className="text-green-600 dark:text-green-400">&quot;user:1002&quot;</span></div>
                        <div>&nbsp;&nbsp;&nbsp;3) <span className="text-green-600 dark:text-green-400">&quot;user:1003&quot;</span></div>
                        <div>&nbsp;&nbsp;&nbsp;4) <span className="text-green-600 dark:text-green-400">&quot;user:1004&quot;</span></div>
                      </div>
                    </div>

                    {/* HGETALL result */}
                    <div>
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground shrink-0">&gt;</span>
                        <span className="text-foreground">HGETALL <span className="text-green-600 dark:text-green-400">user:1001</span></span>
                      </div>
                      <div className="mt-1 ml-4 text-muted-foreground leading-relaxed">
                        <div>&nbsp;1) <span className="text-blue-500 dark:text-blue-400">&quot;name&quot;</span></div>
                        <div>&nbsp;2) <span className="text-yellow-600 dark:text-yellow-400">&quot;Alice Chen&quot;</span></div>
                        <div>&nbsp;3) <span className="text-blue-500 dark:text-blue-400">&quot;email&quot;</span></div>
                        <div>&nbsp;4) <span className="text-yellow-600 dark:text-yellow-400">&quot;alice@startup.io&quot;</span></div>
                        <div>&nbsp;5) <span className="text-blue-500 dark:text-blue-400">&quot;role&quot;</span></div>
                        <div>&nbsp;6) <span className="text-yellow-600 dark:text-yellow-400">&quot;admin&quot;</span></div>
                        <div>&nbsp;7) <span className="text-blue-500 dark:text-blue-400">&quot;last_login&quot;</span></div>
                        <div>&nbsp;8) <span className="text-yellow-600 dark:text-yellow-400">&quot;1710864000&quot;</span></div>
                      </div>
                    </div>

                    {/* TTL result */}
                    <div>
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground shrink-0">&gt;</span>
                        <span className="text-foreground">TTL <span className="text-green-600 dark:text-green-400">user:1001</span></span>
                      </div>
                      <div className="mt-1 ml-4 text-muted-foreground">(integer) <span className="text-yellow-600 dark:text-yellow-400">3540</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Info panel ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 space-y-6 max-w-lg">
              {/* Heading */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Redis Studio
                </h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  A browser-based client for Redis. Browse keys, run commands,
                  and monitor streams — no desktop app required.
                </p>
              </div>

              {/* Action cards */}
              <div className="space-y-3">
                {/* Create Redis */}
                <div className="rounded-xl border bg-card p-5 hover:border-foreground/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Managed Redis
                    </span>
                  </div>
                  <h2 className="text-base font-semibold mb-1">
                    Hosted Redis on Upstash
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Create a hosted Redis database on Upstash — serverless,
                    pay-per-request. Includes key browser, query editor, live
                    monitor, and stream groups.
                  </p>
                  <Link
                    href="/account/managed"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background text-xs font-medium px-4 py-2 hover:bg-foreground/90 transition-colors"
                  >
                    Create Redis
                  </Link>
                </div>

                {/* Use a Tunnel */}
                <div className="rounded-xl border bg-card p-5 hover:border-foreground/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Connect Your Own
                    </span>
                  </div>
                  <h2 className="text-base font-semibold mb-1">
                    Use a Tunnel
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Connect any Redis instance to the studio via a secure
                    tunnel. Works with local Docker containers, remote servers,
                    or cloud providers.
                  </p>
                  <Link
                    href="/guides/database-tunnel"
                    className="inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium px-4 py-2 hover:bg-muted/50 transition-colors"
                  >
                    Learn How
                  </Link>
                </div>
              </div>

              {/* ToolInfo sections */}
              <ToolInfo>
                <ToolInfo.H2>What is the Redis Studio?</ToolInfo.H2>
                <ToolInfo.P>
                  The Redis Studio is a browser-based client for Redis. It lets
                  you browse keys, inspect values, run commands, and monitor
                  activity without installing a desktop tool like RedisInsight
                  or Another Redis Desktop Manager (ARDM).
                </ToolInfo.P>
                <ToolInfo.P>
                  It works with any Redis instance: a local{" "}
                  <ToolInfo.Code>redis-server</ToolInfo.Code>, a Docker
                  container, a cloud-hosted database on Upstash or ElastiCache,
                  or a private Redis reached via a secure tunnel.
                </ToolInfo.P>

                <ToolInfo.H2>Redis data types supported</ToolInfo.H2>
                <ToolInfo.UL>
                  <li>
                    <ToolInfo.Code>string</ToolInfo.Code> — scalar values,
                    counters, cached HTML, JSON blobs
                  </li>
                  <li>
                    <ToolInfo.Code>hash</ToolInfo.Code> — field/value maps for
                    sessions, user objects, settings
                  </li>
                  <li>
                    <ToolInfo.Code>list</ToolInfo.Code> — ordered sequences for
                    queues, logs, timelines
                  </li>
                  <li>
                    <ToolInfo.Code>set</ToolInfo.Code> — unordered unique values
                    for tags, online users, membership
                  </li>
                  <li>
                    <ToolInfo.Code>zset</ToolInfo.Code> (sorted set) — scored
                    members for leaderboards, rate windows, priority queues
                  </li>
                  <li>
                    <ToolInfo.Code>stream</ToolInfo.Code> — append-only log with
                    consumer groups for event sourcing and message queues
                  </li>
                </ToolInfo.UL>

                <ToolInfo.H2>How to use this tool</ToolInfo.H2>
                <ToolInfo.UL>
                  <li>
                    <ToolInfo.Strong>Create a managed database</ToolInfo.Strong>{" "}
                    — provision an Upstash Redis instance from your account and
                    open the studio immediately
                  </li>
                  <li>
                    <ToolInfo.Strong>Connect via tunnel</ToolInfo.Strong> — run
                    the <ToolInfo.Code>1tt</ToolInfo.Code> CLI with a tunnel
                    token to connect any Redis instance to the browser studio
                  </li>
                  <li>
                    <ToolInfo.Strong>Browse keys</ToolInfo.Strong> — filter by
                    pattern, type, or prefix; inspect TTL and memory usage
                  </li>
                  <li>
                    <ToolInfo.Strong>Run commands</ToolInfo.Strong> — execute
                    raw Redis commands and see results inline
                  </li>
                  <li>
                    <ToolInfo.Strong>Monitor streams</ToolInfo.Strong> — browse
                    stream entries and manage consumer group offsets
                  </li>
                </ToolInfo.UL>

                <ToolInfo.H2>Common use cases</ToolInfo.H2>
                <ToolInfo.UL>
                  <li>
                    Inspecting cached values to debug stale data or TTL issues
                  </li>
                  <li>
                    Browsing session hashes to verify authentication state
                    without writing debug scripts
                  </li>
                  <li>
                    Monitoring queue depth in a{" "}
                    <ToolInfo.Code>list</ToolInfo.Code> or{" "}
                    <ToolInfo.Code>stream</ToolInfo.Code> during development
                  </li>
                  <li>
                    Checking rate-limit counters and their remaining TTLs
                  </li>
                  <li>
                    Exploring consumer group lag on streams to diagnose slow
                    workers
                  </li>
                  <li>
                    Managing Upstash Redis from the browser without the Upstash
                    console
                  </li>
                </ToolInfo.UL>
              </ToolInfo>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
