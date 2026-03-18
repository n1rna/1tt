import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "redis-studio";

export const metadata = guideMetadata({
  slug,
  title: "Hosted Redis with Upstash",
  description:
    "Create hosted Redis databases in seconds and manage them from the browser — browse keys, inspect values, set TTLs, and run commands without installing anything.",
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
          Each database gets its own REST endpoint and authentication token. You
          can use these credentials from the studio or from your own
          applications via the Upstash REST API or the{" "}
          <Guide.Code>@upstash/redis</Guide.Code> TypeScript SDK.
        </Guide.P>

        <Guide.H2>Browsing keys</Guide.H2>
        <Guide.P>
          The sidebar scans your keyspace and shows each key with its type
          (string, hash, list, set, sorted set, stream) and TTL. Filter by
          pattern — <Guide.Code>user:*</Guide.Code>,{" "}
          <Guide.Code>cache:*</Guide.Code>, or any glob — to narrow the list.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Type badges</Guide.Strong> — color-coded labels so
            you can tell strings from hashes at a glance
          </li>
          <li>
            <Guide.Strong>TTL indicators</Guide.Strong> — see which keys have
            an expiry and how long is left
          </li>
          <li>
            <Guide.Strong>Lazy loading</Guide.Strong> — keys are loaded in
            batches via <Guide.Code>SCAN</Guide.Code>, so even databases with
            millions of keys stay responsive
          </li>
        </Guide.UL>

        <Guide.H2>Inspecting values</Guide.H2>
        <Guide.P>
          Click any key to view its value in a type-appropriate viewer:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Strings</Guide.Strong> — displayed as text, with
            automatic JSON formatting when the value is valid JSON
          </li>
          <li>
            <Guide.Strong>Hashes</Guide.Strong> — field-value table from{" "}
            <Guide.Code>HGETALL</Guide.Code>
          </li>
          <li>
            <Guide.Strong>Lists</Guide.Strong> — indexed list from{" "}
            <Guide.Code>LRANGE</Guide.Code>
          </li>
          <li>
            <Guide.Strong>Sets</Guide.Strong> — member list from{" "}
            <Guide.Code>SMEMBERS</Guide.Code>
          </li>
          <li>
            <Guide.Strong>Sorted sets</Guide.Strong> — member-score table
          </li>
          <li>
            <Guide.Strong>Streams</Guide.Strong> — entry IDs with their
            field-value maps
          </li>
        </Guide.UL>
        <Guide.P>
          Toggle <Guide.Strong>Raw</Guide.Strong> mode to see the underlying
          value as a JSON string regardless of type.
        </Guide.P>

        <Guide.H2>TTL management</Guide.H2>
        <Guide.P>
          Click the TTL value in the key inspector to edit it. Enter seconds to
          set an expiry, or clear the field to persist the key indefinitely.
          Changes take effect immediately via{" "}
          <Guide.Code>EXPIRE</Guide.Code> and{" "}
          <Guide.Code>PERSIST</Guide.Code> commands.
        </Guide.P>

        <Guide.H2>Command console</Guide.H2>
        <Guide.P>
          The bottom panel is a Redis command console — type any command, press
          Enter, and see the result. It supports the full Redis command set
          (except blocking commands like{" "}
          <Guide.Code>BLPOP</Guide.Code>).
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Command history</Guide.Strong> — use Arrow Up/Down to
            cycle through previous commands
          </li>
          <li>
            <Guide.Strong>Click to re-run</Guide.Strong> — click any entry in
            the history strip to load it back into the input
          </li>
          <li>
            <Guide.Strong>JSON formatting</Guide.Strong> — complex return
            values are pretty-printed
          </li>
        </Guide.UL>

        <Guide.H2>Using your database outside 1tt.dev</Guide.H2>
        <Guide.P>
          Every Redis database comes with a REST endpoint and token. Click the
          connection details icon in the sidebar to copy them. You can use these
          with the Upstash REST API directly:
        </Guide.P>
        <Guide.Callout>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
{`curl https://your-endpoint.upstash.io/get/mykey \\
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
          This works in serverless functions, edge runtimes, and any environment
          that supports HTTP — no Redis driver or TCP connection needed.
        </Guide.P>
      </GuideLayout>
    </>
  );
}
