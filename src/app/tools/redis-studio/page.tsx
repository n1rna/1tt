import Link from "next/link";
import { ToolLayout } from "@/components/layout/tool-layout";
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
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <ToolLayout slug="redis-studio">
        {/* Split hero */}
        <div className="flex flex-col lg:flex-row gap-6 mb-10">
          {/* Left: Studio mockup (60%) */}
          <div className="lg:w-[60%] rounded-xl border bg-muted/10 overflow-hidden flex flex-col shrink-0">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b bg-muted/20 shrink-0">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">
                redis-studio — redis://upstash.io:6379
              </span>
            </div>

            <div className="flex flex-1 min-h-0" style={{ height: "420px" }}>
              {/* Sidebar */}
              <div className="w-44 border-r bg-muted/20 flex flex-col shrink-0">
                {/* Nav items */}
                <div className="px-2 pt-3 pb-2 border-b space-y-0.5">
                  {[
                    { label: "Metrics", active: false },
                    { label: "Monitor", active: false },
                    { label: "New Query", active: false },
                  ].map(({ label, active }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"}`}
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-60" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Views section */}
                <div className="px-2 pt-2.5 pb-2 flex-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    Views
                  </div>
                  <div className="space-y-0.5">
                    {[
                      { label: "Key Explorer", active: false },
                      { label: "Stream Groups", active: false },
                      { label: "BullMQ", active: false },
                      { label: "Sidekiq", active: false },
                      { label: "Celery", active: false },
                    ].map(({ label, active }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"}`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Connection info */}
                <div className="border-t px-3 py-2">
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    db0 · 24 keys
                  </div>
                </div>
              </div>

              {/* Main panel */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Tab bar */}
                <div className="flex items-end border-b bg-muted/10 px-3 pt-2 gap-1 shrink-0">
                  <div className="px-3 py-1.5 text-xs font-medium bg-background border border-b-background rounded-t-md -mb-px text-foreground">
                    Query 1
                  </div>
                  <div className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    Metrics
                  </div>
                </div>

                {/* Terminal scrollback */}
                <div className="flex-1 overflow-auto bg-[hsl(var(--background))] p-3 space-y-3 font-mono text-xs">
                  {/* Command 1 */}
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground select-none shrink-0">&gt;</span>
                      <span className="text-foreground">
                        SCAN 0 MATCH <span className="text-green-600 dark:text-green-400">user:*</span> COUNT 20
                      </span>
                    </div>
                    <div className="mt-1 ml-4 text-muted-foreground leading-relaxed">
                      <div>1) <span className="text-yellow-600 dark:text-yellow-400">&quot;14&quot;</span></div>
                      <div>{'2) 1) '}<span className="text-green-600 dark:text-green-400">&quot;user:1001&quot;</span></div>
                      <div>{'   2) '}<span className="text-green-600 dark:text-green-400">&quot;user:1002&quot;</span></div>
                      <div>{'   3) '}<span className="text-green-600 dark:text-green-400">&quot;user:1003&quot;</span></div>
                    </div>
                  </div>

                  {/* Command 2 */}
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground select-none shrink-0">&gt;</span>
                      <span className="text-foreground">
                        HGETALL <span className="text-green-600 dark:text-green-400">user:1001</span>
                      </span>
                    </div>
                    <div className="mt-1 ml-4 text-muted-foreground leading-relaxed">
                      <div> 1) <span className="text-blue-500 dark:text-blue-400">&quot;name&quot;</span></div>
                      <div> 2) <span className="text-yellow-600 dark:text-yellow-400">&quot;Alice Chen&quot;</span></div>
                      <div> 3) <span className="text-blue-500 dark:text-blue-400">&quot;email&quot;</span></div>
                      <div> 4) <span className="text-yellow-600 dark:text-yellow-400">&quot;alice@startup.io&quot;</span></div>
                      <div> 5) <span className="text-blue-500 dark:text-blue-400">&quot;role&quot;</span></div>
                      <div> 6) <span className="text-yellow-600 dark:text-yellow-400">&quot;admin&quot;</span></div>
                      <div> 7) <span className="text-blue-500 dark:text-blue-400">&quot;last_login&quot;</span></div>
                      <div> 8) <span className="text-yellow-600 dark:text-yellow-400">&quot;1710864000&quot;</span></div>
                    </div>
                  </div>

                  {/* Command 3 */}
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground select-none shrink-0">&gt;</span>
                      <span className="text-foreground">
                        TTL <span className="text-green-600 dark:text-green-400">user:1001</span>
                      </span>
                    </div>
                    <div className="mt-1 ml-4 text-muted-foreground">
                      (integer) <span className="text-yellow-600 dark:text-yellow-400">3487</span>
                    </div>
                  </div>
                </div>

                {/* Command input */}
                <div className="border-t bg-muted/10 shrink-0">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-muted-foreground font-mono text-xs select-none shrink-0">&gt;</span>
                    <div className="flex-1 rounded border bg-background px-3 py-1.5 text-xs font-mono text-muted-foreground">
                      LRANGE queue:jobs 0 9
                    </div>
                    <button className="rounded bg-foreground text-background text-xs px-3 py-1.5 font-medium shrink-0">
                      Run
                    </button>
                  </div>

                  {/* History strip */}
                  <div className="px-3 pb-2 flex items-center gap-2 overflow-x-auto">
                    <span className="text-[10px] text-muted-foreground shrink-0">History:</span>
                    {[
                      "TTL user:1001",
                      "HGETALL user:1001",
                      "SCAN 0 MATCH user:* COUNT 20",
                    ].map((cmd) => (
                      <span
                        key={cmd}
                        className="text-[10px] font-mono text-muted-foreground bg-muted/40 border rounded px-1.5 py-0.5 whitespace-nowrap shrink-0"
                      >
                        {cmd}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Action cards (40%) */}
          <div className="lg:w-[40%] flex flex-col justify-start gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Get started
              </p>
            </div>

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
                Create a hosted Redis database on Upstash - serverless,
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

            <div className="rounded-xl border bg-card p-5 hover:border-foreground/20 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Connect Your Own
                </span>
              </div>
              <h2 className="text-base font-semibold mb-1">Use a Tunnel</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Connect any Redis instance to the studio via a secure tunnel.
                Works with local Docker containers, remote servers, or cloud
                providers.
              </p>
              <Link
                href="/guides/database-tunnel"
                className="inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium px-4 py-2 hover:bg-muted/50 transition-colors"
              >
                Learn How
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-0 pb-6">
          <ToolInfo>
            <ToolInfo.H2>What is the Redis Studio?</ToolInfo.H2>
            <ToolInfo.P>
              The Redis Studio is a browser-based client for Redis. It lets
              you browse keys, inspect values, run commands, and monitor
              activity without installing a desktop tool like RedisInsight or
              Another Redis Desktop Manager (ARDM).
            </ToolInfo.P>
            <ToolInfo.P>
              It works with any Redis instance: a local{" "}
              <ToolInfo.Code>redis-server</ToolInfo.Code>, a Docker container,
              a cloud-hosted database on Upstash or ElastiCache, or a
              private Redis reached via a secure tunnel.
            </ToolInfo.P>

            <ToolInfo.H2>Redis data types supported</ToolInfo.H2>
            <ToolInfo.UL>
              <li>
                <ToolInfo.Code>string</ToolInfo.Code> - scalar values, counters,
                cached HTML, JSON blobs
              </li>
              <li>
                <ToolInfo.Code>hash</ToolInfo.Code> - field/value maps for
                sessions, user objects, settings
              </li>
              <li>
                <ToolInfo.Code>list</ToolInfo.Code> - ordered sequences for
                queues, logs, timelines
              </li>
              <li>
                <ToolInfo.Code>set</ToolInfo.Code> - unordered unique values for
                tags, online users, membership
              </li>
              <li>
                <ToolInfo.Code>zset</ToolInfo.Code> (sorted set) - scored
                members for leaderboards, rate windows, priority queues
              </li>
              <li>
                <ToolInfo.Code>stream</ToolInfo.Code> - append-only log with
                consumer groups for event sourcing and message queues
              </li>
            </ToolInfo.UL>

            <ToolInfo.H2>How to use this tool</ToolInfo.H2>
            <ToolInfo.UL>
              <li>
                <ToolInfo.Strong>Create a managed database</ToolInfo.Strong> -
                provision an Upstash Redis instance from your account and open
                the studio immediately
              </li>
              <li>
                <ToolInfo.Strong>Connect via tunnel</ToolInfo.Strong> - run the{" "}
                <ToolInfo.Code>1tt</ToolInfo.Code> CLI with a tunnel token to
                connect any Redis instance to the browser studio
              </li>
              <li>
                <ToolInfo.Strong>Browse keys</ToolInfo.Strong> - filter by
                pattern, type, or prefix; inspect TTL and memory usage
              </li>
              <li>
                <ToolInfo.Strong>Run commands</ToolInfo.Strong> - execute raw
                Redis commands and see results inline
              </li>
              <li>
                <ToolInfo.Strong>Monitor streams</ToolInfo.Strong> - browse
                stream entries and manage consumer group offsets
              </li>
            </ToolInfo.UL>

            <ToolInfo.H2>Common use cases</ToolInfo.H2>
            <ToolInfo.UL>
              <li>
                Inspecting cached values to debug stale data or TTL issues
              </li>
              <li>
                Browsing session hashes to verify authentication state without
                writing debug scripts
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
      </ToolLayout>
    </>
  );
}
