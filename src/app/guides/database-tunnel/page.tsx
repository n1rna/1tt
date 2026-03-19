import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "database-tunnel";

export const metadata = guideMetadata({
  slug,
  title: "Connect Any Database via Tunnel",
  description:
    "Use the 1tt CLI to create a secure tunnel from your local PostgreSQL or Redis to the web-based studio — no port forwarding or VPN needed.",
  keywords: [
    "database tunnel",
    "1tt cli",
    "local database",
    "postgres tunnel",
    "redis tunnel",
    "websocket tunnel",
    "database proxy",
    "pgadmin alternative",
    "redis gui local",
    "connect local database browser",
    "secure database connection",
  ],
});

export default function DatabaseTunnelGuide() {
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
        <Guide.H2>Why tunneling?</Guide.H2>
        <Guide.P>
          Sometimes your database isn&apos;t publicly accessible. It might be
          running in Docker on <Guide.Code>localhost</Guide.Code>, on a private
          VPN, behind a firewall, or in a staging environment with no inbound
          ports. Traditional database GUIs require a direct TCP connection —
          which means you&apos;re stuck with a desktop app or complex SSH tunnel
          configuration.
        </Guide.P>
        <Guide.P>
          The <Guide.Code>1tt</Guide.Code> CLI creates a secure WebSocket tunnel
          from your machine to the web studio. You run one command locally; the
          browser studio connects through it. No firewall rules, no port
          forwarding, no VPN required.
        </Guide.P>

        <Guide.H2>How it works</Guide.H2>
        <Guide.P>
          The tunnel operates in three steps:
        </Guide.P>
        <Guide.OL>
          <li>
            The <Guide.Code>1tt tunnel</Guide.Code> process starts on your
            machine and opens a persistent WebSocket connection to{" "}
            <Guide.Code>wss://1tt.dev</Guide.Code>.
          </li>
          <li>
            When you open the Database or Redis Studio in the browser, it sends
            SQL or Redis commands over that WebSocket to the{" "}
            <Guide.Code>1tt</Guide.Code> process.
          </li>
          <li>
            The CLI executes those commands against your local database, then
            streams the results back through the WebSocket to the browser.
          </li>
        </Guide.OL>
        <Guide.Callout>
          Your data never passes through the 1tt.dev server. The backend only
          forwards opaque WebSocket frames — it cannot read query results or
          database contents. All traffic between your machine and the browser is
          encrypted via TLS.
        </Guide.Callout>

        <Guide.H2>Quick start</Guide.H2>
        <Guide.P>
          Follow these steps to connect any local database to the studio:
        </Guide.P>
        <Guide.OL>
          <li>
            Go to{" "}
            <Guide.Code>1tt.dev/account/databases</Guide.Code> and click{" "}
            <Guide.Strong>Connect External</Guide.Strong>.
          </li>
          <li>
            Click <Guide.Strong>Generate token</Guide.Strong>. Copy the tunnel
            token shown — it is valid for 24 hours and can only be used once.
          </li>
          <li>
            Install the CLI on your machine:
            <div className="mt-2 rounded border bg-muted/40 px-4 py-3 font-mono text-xs text-foreground break-all">
              curl -sSfL https://1tt.dev/cli/install.sh | sh
            </div>
          </li>
          <li>
            Start the tunnel, pointing it at your database URL:
            <div className="mt-2 rounded border bg-muted/40 px-4 py-3 font-mono text-xs text-foreground break-all">
              1tt tunnel --token &lt;TOKEN&gt; --db postgres://localhost:5432/mydb
            </div>
            For Redis:
            <div className="mt-2 rounded border bg-muted/40 px-4 py-3 font-mono text-xs text-foreground break-all">
              1tt tunnel --token &lt;TOKEN&gt; --db redis://localhost:6379
            </div>
          </li>
          <li>
            Switch back to the browser. The studio will detect the active
            tunnel, load your schema or key list, and you can start querying
            immediately.
          </li>
        </Guide.OL>
        <Guide.P>
          You can also combine the install and connect steps into a single
          one-liner:
        </Guide.P>
        <div className="rounded border bg-muted/40 px-4 py-3 font-mono text-xs text-foreground break-all">
          curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- tunnel --token
          &lt;TOKEN&gt; --db &lt;DATABASE_URL&gt;
        </div>

        <Guide.H2>Supported databases</Guide.H2>
        <Guide.UL>
          <li>
            <Guide.Strong>PostgreSQL</Guide.Strong> — any version, including
            local <Guide.Code>pg</Guide.Code>, Docker containers, Supabase,
            Neon, RDS, Aurora, and self-hosted instances
          </li>
          <li>
            <Guide.Strong>Redis</Guide.Strong> — any version, including local
            <Guide.Code>redis-server</Guide.Code>, Docker,{" "}
            <Guide.Code>redis-stack</Guide.Code>, Upstash, ElastiCache,
            Memorystore, and Dragonfly
          </li>
        </Guide.UL>

        <Guide.H2>Security</Guide.H2>
        <Guide.UL>
          <li>
            <Guide.Strong>One-time tokens</Guide.Strong> — each token is
            generated for a single tunnel session and expires after 24 hours.
          </li>
          <li>
            <Guide.Strong>TLS encryption</Guide.Strong> — the WebSocket
            connection between your machine and{" "}
            <Guide.Code>1tt.dev</Guide.Code> is encrypted end-to-end via TLS.
          </li>
          <li>
            <Guide.Strong>Local execution</Guide.Strong> — all queries run on
            your machine against your local database process. The 1tt.dev
            server never receives or stores query results.
          </li>
          <li>
            <Guide.Strong>No persistent storage</Guide.Strong> — no credentials,
            schemas, or query results are persisted on the server.
          </li>
        </Guide.UL>
        <Guide.Callout>
          If you are connecting to a production database, consider creating a
          read-only PostgreSQL role or a Redis user with restricted{" "}
          <Guide.Code>ACL</Guide.Code> permissions before generating a tunnel
          token.
        </Guide.Callout>

        <Guide.H2>CLI reference</Guide.H2>
        <Guide.P>
          The <Guide.Code>1tt tunnel</Guide.Code> subcommand accepts the
          following flags:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Code>--token &lt;TOKEN&gt;</Guide.Code> — the tunnel token
            generated from your account dashboard (required)
          </li>
          <li>
            <Guide.Code>--db &lt;URL&gt;</Guide.Code> — the database connection
            URL, e.g.{" "}
            <Guide.Code>postgres://user:pass@localhost:5432/dbname</Guide.Code>{" "}
            or <Guide.Code>redis://localhost:6379</Guide.Code> (required)
          </li>
          <li>
            <Guide.Code>--server &lt;URL&gt;</Guide.Code> — override the relay
            server URL (defaults to <Guide.Code>wss://1tt.dev</Guide.Code>,
            useful for self-hosted deployments)
          </li>
        </Guide.UL>

        <Guide.H3>Install methods</Guide.H3>
        <Guide.UL>
          <li>
            <Guide.Strong>Shell installer (Linux / macOS)</Guide.Strong>:{" "}
            <Guide.Code>
              curl -sSfL https://1tt.dev/cli/install.sh | sh
            </Guide.Code>
          </li>
          <li>
            <Guide.Strong>Homebrew</Guide.Strong>:{" "}
            <Guide.Code>brew install 1tt</Guide.Code>
          </li>
          <li>
            <Guide.Strong>npm</Guide.Strong>:{" "}
            <Guide.Code>npm install -g @1tt/cli</Guide.Code>
          </li>
          <li>
            <Guide.Strong>Check installed version</Guide.Strong>:{" "}
            <Guide.Code>1tt --version</Guide.Code>
          </li>
        </Guide.UL>
      </GuideLayout>
    </>
  );
}
