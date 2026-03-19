import Link from "next/link";
import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "redis-studio",
  title: "Redis Studio - Browser-Based Redis Client & Key Browser",
  description:
    "Browse Redis keys, run commands, monitor performance, and manage streams and consumer groups — all from the browser. Works with managed Upstash databases or your own Redis instance via tunnel.",
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
        {/* Hero mockup */}
        <div className="rounded-xl border bg-muted/20 overflow-hidden mb-8">
          <div className="flex h-64 sm:h-80">
            {/* Key list sidebar */}
            <div className="w-48 border-r bg-muted/30 p-3 shrink-0 hidden sm:block">
              <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Keys
              </div>
              <div className="mb-2">
                <div className="rounded border bg-background px-2 py-1 text-xs text-muted-foreground font-mono">
                  *
                </div>
              </div>
              <div className="space-y-0.5">
                {[
                  { key: "session:usr:1a2b", type: "hash" },
                  { key: "queue:jobs", type: "list" },
                  { key: "rate:192.168.1.1", type: "string" },
                  { key: "leaderboard", type: "zset" },
                  { key: "online:users", type: "set" },
                ].map(({ key, type }, i) => (
                  <div
                    key={key}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${i === 0 ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground"}`}
                  >
                    <span
                      className={`shrink-0 rounded px-1 text-[9px] font-semibold uppercase ${
                        type === "hash"
                          ? "bg-blue-500/15 text-blue-500"
                          : type === "list"
                            ? "bg-orange-500/15 text-orange-500"
                            : type === "string"
                              ? "bg-green-500/15 text-green-500"
                              : type === "zset"
                                ? "bg-purple-500/15 text-purple-500"
                                : "bg-pink-500/15 text-pink-500"
                      }`}
                    >
                      {type}
                    </span>
                    <span className="truncate font-mono">{key}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Main panel */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Key detail / command area */}
              <div className="border-b px-4 py-2.5 bg-muted/10 flex items-center gap-2">
                <span className="rounded px-1 text-[9px] font-semibold uppercase bg-blue-500/15 text-blue-500 shrink-0">
                  hash
                </span>
                <span className="text-xs font-mono text-foreground truncate">
                  session:usr:1a2b
                </span>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  TTL: 3 540s
                </span>
              </div>

              {/* Hash fields */}
              <div className="flex-1 overflow-auto p-3 space-y-1">
                <div className="rounded border overflow-hidden text-xs">
                  <div className="grid grid-cols-2 bg-muted/50 font-medium text-muted-foreground border-b">
                    <div className="px-3 py-2">Field</div>
                    <div className="px-3 py-2">Value</div>
                  </div>
                  {[
                    ["user_id", "usr_1a2b3c4d"],
                    ["email", "alice@example.com"],
                    ["role", "admin"],
                    ["last_seen", "1710864000"],
                  ].map(([field, value]) => (
                    <div
                      key={field}
                      className="grid grid-cols-2 border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="px-3 py-2 font-mono text-muted-foreground">
                        {field}
                      </div>
                      <div className="px-3 py-2 font-mono text-foreground">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Command input */}
                <div className="flex gap-2 items-center mt-3">
                  <div className="flex-1 rounded border bg-background px-3 py-1.5 text-xs font-mono text-muted-foreground">
                    HGET session:usr:1a2b role
                  </div>
                  <button className="rounded bg-foreground text-background text-xs px-3 py-1.5 font-medium">
                    Run
                  </button>
                </div>
                <div className="rounded bg-muted/50 px-3 py-1.5 text-xs font-mono text-green-600 dark:text-green-400">
                  &quot;admin&quot;
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-2">
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
              href="/account/databases"
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
                <ToolInfo.Code>string</ToolInfo.Code> — scalar values, counters,
                cached HTML, JSON blobs
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
                <ToolInfo.Code>set</ToolInfo.Code> — unordered unique values for
                tags, online users, membership
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
                <ToolInfo.Strong>Create a managed database</ToolInfo.Strong> —
                provision an Upstash Redis instance from your account and open
                the studio immediately
              </li>
              <li>
                <ToolInfo.Strong>Connect via tunnel</ToolInfo.Strong> — run the{" "}
                <ToolInfo.Code>1tt</ToolInfo.Code> CLI with a tunnel token to
                connect any Redis instance to the browser studio
              </li>
              <li>
                <ToolInfo.Strong>Browse keys</ToolInfo.Strong> — filter by
                pattern, type, or prefix; inspect TTL and memory usage
              </li>
              <li>
                <ToolInfo.Strong>Run commands</ToolInfo.Strong> — execute raw
                Redis commands and see results inline
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
