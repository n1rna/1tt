import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "redis-studio";

export const metadata = guideMetadata({
  slug,
  title: "Hosted Redis with Upstash",
  description:
    "Create hosted Redis databases in seconds — run commands, browse keys, monitor performance, and inspect BullMQ, Sidekiq, and Celery queues from the browser.",
  keywords: [
    "redis",
    "upstash",
    "redis gui",
    "redis browser",
    "key value store",
    "redis studio",
    "hosted redis",
    "redis client",
    "redis commands",
    "bullmq",
    "sidekiq",
    "celery",
    "redis streams",
    "consumer groups",
  ],
});

export default function RedisStudioGuide() {
  const jsonLd = guideJsonLd(slug);
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <GuideLayout slug={slug}>
        <Guide.H2>Redis in the browser</Guide.H2>
        <Guide.P>
          Redis is the go-to in-memory data store for caching, sessions, rate
          limiting, and real-time features. But managing it usually means SSH
          into a server, installing <Guide.Code>redis-cli</Guide.Code>, or
          running a desktop client. The 1tt.dev Redis Studio gives you a
          full-featured Redis browser that runs entirely in the browser — no
          install, no CLI, no SSH.
        </Guide.P>
        <Guide.P>
          The studio uses a tabbed interface so you can have multiple query
          tabs, metrics, monitoring, and framework views open at the same time.
        </Guide.P>
        <Guide.Callout>
          Redis databases are available on{" "}
          <Guide.Strong>Pro</Guide.Strong> and <Guide.Strong>Max</Guide.Strong>{" "}
          plans. Pro gets 1 database, Max gets up to 3.
        </Guide.Callout>

        <Guide.H2>Creating a database</Guide.H2>
        <Guide.P>
          Go to <Guide.Strong>Databases</Guide.Strong> in your account
          dashboard and click <Guide.Strong>Create Redis</Guide.Strong>. Pick a
          name and choose from 7 AWS regions — the database is provisioned in
          seconds, powered by Upstash.
        </Guide.P>
        <Guide.P>
          Each database gets its own REST endpoint, Redis URL, and
          authentication token. You can use these credentials from the studio
          or from your own applications.
        </Guide.P>

        <Guide.H2>Query tabs</Guide.H2>
        <Guide.P>
          Each query tab is an independent command workspace with its own
          history. Type a Redis command, press Enter, and see the result.
          Open as many tabs as you need.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>SCAN detection</Guide.Strong> — when a command
            returns a SCAN result, keys are shown as a clickable list that
            expands inline to show type, TTL, and value
          </li>
          <li>
            <Guide.Strong>Command history</Guide.Strong> — collapsible,
            resizable panel at the bottom with all past commands and their
            results; re-run any command with one click
          </li>
          <li>
            <Guide.Strong>Arrow Up/Down</Guide.Strong> — cycle through
            history directly from the input
          </li>
          <li>
            <Guide.Strong>AI assistant</Guide.Strong> — describe what you
            want in plain English and the AI generates the Redis command
          </li>
        </Guide.UL>

        <Guide.H2>Key Namespace Explorer</Guide.H2>
        <Guide.P>
          The Key Explorer scans your entire keyspace and organizes keys into
          a tree by splitting on <Guide.Code>:</Guide.Code> delimiters. If
          your keys follow patterns like{" "}
          <Guide.Code>user:123:profile</Guide.Code> or{" "}
          <Guide.Code>cache:products:featured</Guide.Code>, the tree groups
          them into browsable namespaces.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Tree view</Guide.Strong> — expand and collapse
            namespaces, see key counts at each level
          </li>
          <li>
            <Guide.Strong>Search filter</Guide.Strong> — narrow the tree
            to matching key patterns
          </li>
          <li>
            <Guide.Strong>Key inspection</Guide.Strong> — click any leaf
            key to see its type, TTL, and value in a detail panel
          </li>
          <li>
            <Guide.Strong>Top namespaces</Guide.Strong> — shows the 5
            largest groups by key count
          </li>
        </Guide.UL>

        <Guide.H2>Stream Consumer Groups</Guide.H2>
        <Guide.P>
          The Stream Groups view discovers all stream-type keys and shows
          their consumer groups, individual consumers, and pending messages.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Group overview</Guide.Strong> — consumer count,
            pending count, last delivered ID for each group
          </li>
          <li>
            <Guide.Strong>Consumer details</Guide.Strong> — per-consumer
            pending count and idle time
          </li>
          <li>
            <Guide.Strong>Pending entries</Guide.Strong> — the PEL
            (Pending Entry List) with entry ID, consumer, idle time, and
            delivery count
          </li>
          <li>
            <Guide.Strong>ACK button</Guide.Strong> — acknowledge pending
            messages directly from the UI
          </li>
          <li>
            <Guide.Strong>Recent entries</Guide.Strong> — the 20 most
            recent stream entries with their fields
          </li>
        </Guide.UL>

        <Guide.H2>BullMQ view</Guide.H2>
        <Guide.P>
          If you use BullMQ for job queues, the BullMQ view auto-discovers
          your queues and shows a dashboard for each one. See job counts by
          state (waiting, active, completed, failed, delayed, paused),
          inspect individual jobs, and retry failed jobs.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Job inspection</Guide.Strong> — see job data,
            options, timestamps, progress, return values, and stack traces
          </li>
          <li>
            <Guide.Strong>Retry</Guide.Strong> — retry individual failed
            jobs or all failed jobs at once, moving them back to the
            waiting queue
          </li>
        </Guide.UL>

        <Guide.H2>Sidekiq view</Guide.H2>
        <Guide.P>
          The Sidekiq view loads queue names from the{" "}
          <Guide.Code>queues</Guide.Code> set and shows processed/failed
          counts, per-queue job lists, and the scheduled, retry, and dead
          sorted sets. Each job payload is parsed and displayed with its
          class, args, and error details.
        </Guide.P>

        <Guide.H2>Celery view</Guide.H2>
        <Guide.P>
          The Celery view discovers queues from{" "}
          <Guide.Code>_kombu.binding.*</Guide.Code> keys and task results
          from <Guide.Code>celery-task-meta-*</Guide.Code> keys. Browse
          pending tasks per queue, see task results with color-coded status
          badges, and inspect Python tracebacks for failed tasks.
        </Guide.P>

        <Guide.H2>Metrics and monitoring</Guide.H2>
        <Guide.P>
          The <Guide.Strong>Metrics</Guide.Strong> tab shows a snapshot of
          your database from the Redis <Guide.Code>INFO</Guide.Code> command:
          total keys, memory usage, clients, uptime, ops/sec, and hit rate,
          plus all INFO sections in expandable detail.
        </Guide.P>
        <Guide.P>
          The <Guide.Strong>Live Monitor</Guide.Strong> tab polls INFO at
          a configurable interval (5/10/30 seconds) and tracks trends over
          time. Watch key counts, memory, and ops/sec change in real time
          with delta indicators.
        </Guide.P>

        <Guide.H2>Using your database outside 1tt.dev</Guide.H2>
        <Guide.P>
          Every database comes with a Redis URL for direct connections and a
          REST endpoint for HTTP access. Click the connection details icon
          in the sidebar to copy them.
        </Guide.P>
        <Guide.Callout>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
{`# Direct Redis connection
redis-cli -u redis://default:PASSWORD@host:6379

# REST API
curl https://your-endpoint.upstash.io/get/mykey \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
          </pre>
        </Guide.Callout>
        <Guide.P>
          Or with the <Guide.Code>@upstash/redis</Guide.Code> SDK:
        </Guide.P>
        <Guide.Callout>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
{`import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: "https://your-endpoint.upstash.io",
  token: "YOUR_TOKEN",
})

await redis.set("key", "value", { ex: 3600 })
const val = await redis.get("key")`}
          </pre>
        </Guide.Callout>
        <Guide.P>
          This works in serverless functions, edge runtimes, and any
          environment that supports HTTP — no Redis driver or TCP connection
          needed.
        </Guide.P>
      </GuideLayout>
    </>
  );
}
