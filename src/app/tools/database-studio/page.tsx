import Link from "next/link";
import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "database-studio",
  title: "Database Studio - PostgreSQL Browser & SQL Client",
  description:
    "Connect to any PostgreSQL database from the browser — run queries, browse schemas, inspect tables, and manage data. Works with managed databases or your own via a secure tunnel.",
  keywords: [
    "database studio",
    "postgresql client",
    "postgres gui",
    "sql editor",
    "schema browser",
    "pgadmin alternative",
    "database browser",
    "sql query tool",
    "postgres web client",
    "database management",
  ],
});

export default function DatabaseStudioPage() {
  const jsonLd = toolJsonLd("database-studio");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <ToolLayout slug="database-studio">
        {/* Hero mockup */}
        <div className="rounded-xl border bg-muted/20 overflow-hidden mb-8">
          <div className="flex h-64 sm:h-80">
            {/* Sidebar */}
            <div className="w-44 border-r bg-muted/30 p-3 shrink-0 hidden sm:block">
              <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Schema
              </div>
              <div className="space-y-1">
                {["users", "orders", "products", "sessions", "audit_log"].map(
                  (table, i) => (
                    <div
                      key={table}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${i === 0 ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground"}`}
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                      {table}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Query bar */}
              <div className="border-b px-4 py-2.5 bg-muted/10">
                <div className="rounded border bg-background px-3 py-1.5 text-xs font-mono text-muted-foreground">
                  SELECT id, email, created_at FROM users ORDER BY created_at
                  DESC LIMIT 25;
                </div>
              </div>

              {/* Results table */}
              <div className="flex-1 overflow-auto p-3">
                <div className="rounded border overflow-hidden text-xs">
                  {/* Header */}
                  <div className="grid grid-cols-3 bg-muted/50 font-medium text-muted-foreground border-b">
                    <div className="px-3 py-2">id</div>
                    <div className="px-3 py-2">email</div>
                    <div className="px-3 py-2">created_at</div>
                  </div>
                  {/* Rows */}
                  {[
                    ["1", "alice@example.com", "2024-01-15"],
                    ["2", "bob@example.com", "2024-01-14"],
                    ["3", "carol@example.com", "2024-01-13"],
                    ["4", "dave@example.com", "2024-01-12"],
                  ].map(([id, email, date]) => (
                    <div
                      key={id}
                      className="grid grid-cols-3 border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="px-3 py-2 font-mono text-muted-foreground">
                        {id}
                      </div>
                      <div className="px-3 py-2 text-foreground">{email}</div>
                      <div className="px-3 py-2 text-muted-foreground">
                        {date}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  4 rows returned in 3ms
                </p>
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
                Managed Database
              </span>
            </div>
            <h2 className="text-base font-semibold mb-1">
              Hosted PostgreSQL on Neon
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Create a hosted PostgreSQL database on Neon — ready in seconds.
              Includes the full studio, AI assistant, and cloud sync.
            </p>
            <Link
              href="/account/databases"
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background text-xs font-medium px-4 py-2 hover:bg-foreground/90 transition-colors"
            >
              Create Database
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
              Connect any PostgreSQL database to the studio via a secure tunnel
              from your local environment. Your data stays on your machine.
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
            <ToolInfo.H2>What is the Database Studio?</ToolInfo.H2>
            <ToolInfo.P>
              The Database Studio is a browser-based SQL client for PostgreSQL.
              It lets you connect to any Postgres database, explore schemas,
              run queries, and inspect data — without installing a desktop
              application like pgAdmin, TablePlus, or DBeaver.
            </ToolInfo.P>
            <ToolInfo.P>
              It works with any PostgreSQL database: a local development
              instance, a cloud-hosted database on Neon, RDS, Supabase,
              PlanetScale, or a private staging environment reached via a
              secure tunnel.
            </ToolInfo.P>

            <ToolInfo.H2>How it works</ToolInfo.H2>
            <ToolInfo.P>
              There are two connection modes. With a{" "}
              <ToolInfo.Strong>managed database</ToolInfo.Strong>, you create a
              Neon PostgreSQL instance directly from your account — credentials
              are configured automatically and the studio connects immediately.
              With a <ToolInfo.Strong>tunnel connection</ToolInfo.Strong>, you
              run the <ToolInfo.Code>1tt</ToolInfo.Code> CLI on your machine,
              which opens a WebSocket proxy to the studio. Queries are relayed
              through the tunnel and executed locally — no data leaves your
              environment.
            </ToolInfo.P>

            <ToolInfo.H2>How to use this tool</ToolInfo.H2>
            <ToolInfo.UL>
              <li>
                <ToolInfo.Strong>Create a managed database</ToolInfo.Strong> —
                go to your account, create a Neon database, and open the studio
                in one click
              </li>
              <li>
                <ToolInfo.Strong>Connect via tunnel</ToolInfo.Strong> — generate
                a tunnel token, install the{" "}
                <ToolInfo.Code>1tt</ToolInfo.Code> CLI, and run{" "}
                <ToolInfo.Code>1tt tunnel --token ... --db postgres://...</ToolInfo.Code>
              </li>
              <li>
                <ToolInfo.Strong>Browse the schema</ToolInfo.Strong> — explore
                tables, columns, indexes, and foreign keys in the sidebar
              </li>
              <li>
                <ToolInfo.Strong>Run SQL queries</ToolInfo.Strong> — write and
                execute queries with syntax highlighting and result pagination
              </li>
              <li>
                <ToolInfo.Strong>Inspect and edit rows</ToolInfo.Strong> — view,
                insert, update, and delete records directly from the table view
              </li>
            </ToolInfo.UL>

            <ToolInfo.H2>Common use cases</ToolInfo.H2>
            <ToolInfo.UL>
              <li>
                Querying a local development database without installing a GUI
                client
              </li>
              <li>
                Exploring a staging or production database schema while
                onboarding to a new codebase
              </li>
              <li>
                Running <ToolInfo.Code>SELECT</ToolInfo.Code> queries to debug
                data issues or verify migrations
              </li>
              <li>
                Browsing a Neon or Supabase database from any device without
                extra tooling
              </li>
              <li>
                Teaching SQL interactively — spin up a fresh database and
                explore it in real time
              </li>
            </ToolInfo.UL>
          </ToolInfo>
        </div>
      </ToolLayout>
    </>
  );
}
