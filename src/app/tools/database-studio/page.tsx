import Link from "next/link";
import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "database-studio",
  title: "Database Studio - PostgreSQL Browser & SQL Client",
  description:
    "Connect to any PostgreSQL database from the browser - run queries, browse schemas, inspect tables, and manage data. Works with managed databases or your own via a secure tunnel.",
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
                database-studio — postgresql://db.example.io:5432/prod
              </span>
            </div>

            <div className="flex flex-1 min-h-0" style={{ height: "420px" }}>
              {/* Sidebar */}
              <div className="w-48 border-r bg-muted/20 flex flex-col shrink-0">
                {/* Schema header */}
                <div className="px-3 pt-3 pb-2 border-b">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Schemas
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                    <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-mono">public</span>
                  </div>
                </div>

                {/* Tables */}
                <div className="flex-1 overflow-auto px-2 py-2 space-y-0.5">
                  {[
                    { name: "users", rows: "12.4k", active: true },
                    { name: "orders", rows: "38.1k", active: false },
                    { name: "products", rows: "847", active: false },
                    { name: "payments", rows: "29.6k", active: false },
                    { name: "sessions", rows: "5.2k", active: false },
                  ].map(({ name, rows, active }) => (
                    <div
                      key={name}
                      className={`flex items-center justify-between rounded px-2 py-1.5 text-xs ${active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <svg className="h-3 w-3 shrink-0 opacity-60" viewBox="0 0 16 16" fill="none">
                          <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                          <line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                        <span className="font-mono truncate">{name}</span>
                      </div>
                      <span className="text-[9px] bg-muted/60 rounded px-1 py-0.5 ml-1 shrink-0 tabular-nums">
                        {rows}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Column inspector */}
                <div className="border-t px-2 py-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Columns
                  </div>
                  {[
                    { col: "id", type: "int4" },
                    { col: "email", type: "varchar" },
                    { col: "role", type: "varchar" },
                    { col: "created_at", type: "timestamptz" },
                  ].map(({ col, type }) => (
                    <div key={col} className="flex items-center justify-between text-[10px] py-0.5 text-muted-foreground">
                      <span className="font-mono">{col}</span>
                      <span className="text-[9px] text-muted-foreground/60">{type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Tab bar */}
                <div className="flex items-end border-b bg-muted/10 px-3 pt-2 gap-1 shrink-0">
                  <div className="px-3 py-1.5 text-xs font-medium bg-background border border-b-background rounded-t-md -mb-px text-foreground">
                    users
                  </div>
                  <div className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    SQL Query
                  </div>
                </div>

                {/* Data grid */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/30 border-b sticky top-0">
                        {["id", "email", "name", "role", "created_at"].map((col) => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground font-mono whitespace-nowrap border-r last:border-r-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["1", "alice@acme.dev", "Alice Chen", "admin", "2025-11-03 09:14:22"],
                        ["2", "bob@startup.io", "Bob Markov", "user", "2025-11-02 16:47:05"],
                        ["3", "carol.w@corp.com", "Carol Wu", "user", "2025-11-01 11:30:18"],
                        ["4", "dave@example.org", "Dave Santos", "editor", "2025-10-31 08:22:44"],
                        ["5", "eve@acme.dev", "Eve Nakamura", "admin", "2025-10-30 14:55:09"],
                        ["6", "frank@startup.io", "Frank Kim", "user", "2025-10-29 17:03:31"],
                        ["7", "grace@corp.com", "Grace Osei", "editor", "2025-10-28 10:19:57"],
                      ].map(([id, email, name, role, ts]) => (
                        <tr key={id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5 font-mono text-muted-foreground border-r whitespace-nowrap">{id}</td>
                          <td className="px-3 py-1.5 text-foreground border-r whitespace-nowrap">{email}</td>
                          <td className="px-3 py-1.5 text-foreground border-r whitespace-nowrap">{name}</td>
                          <td className="px-3 py-1.5 border-r whitespace-nowrap">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${role === "admin" ? "bg-purple-500/15 text-purple-500" : role === "editor" ? "bg-blue-500/15 text-blue-500" : "bg-muted/60 text-muted-foreground"}`}>
                              {role}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{ts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* SQL editor strip */}
                <div className="border-t bg-muted/10 shrink-0">
                  <div className="px-3 pt-2 pb-1">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Query
                    </div>
                    <div className="rounded border bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground leading-relaxed">
                      <span className="text-blue-500 dark:text-blue-400">SELECT</span>
                      {" * "}
                      <span className="text-blue-500 dark:text-blue-400">FROM</span>
                      {" users "}
                      <span className="text-blue-500 dark:text-blue-400">WHERE</span>
                      {" role = "}
                      <span className="text-green-600 dark:text-green-400">&apos;admin&apos;</span>
                      {" "}
                      <span className="text-blue-500 dark:text-blue-400">ORDER BY</span>
                      {" created_at "}
                      <span className="text-blue-500 dark:text-blue-400">DESC</span>
                      {" "}
                      <span className="text-blue-500 dark:text-blue-400">LIMIT</span>
                      {" 50;"}
                    </div>
                  </div>
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/20">
                    <span className="text-[10px] text-muted-foreground font-mono">7 rows</span>
                    <span className="text-[10px] text-muted-foreground font-mono">4 ms</span>
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
                  Managed Database
                </span>
              </div>
              <h2 className="text-base font-semibold mb-1">
                Hosted PostgreSQL on Neon
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Create a hosted PostgreSQL database on Neon - ready in seconds.
                Includes the full studio, AI assistant, and cloud sync.
              </p>
              <Link
                href="/account/managed"
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
        </div>

        <div className="max-w-6xl mx-auto px-0 pb-6">
          <ToolInfo>
            <ToolInfo.H2>What is the Database Studio?</ToolInfo.H2>
            <ToolInfo.P>
              The Database Studio is a browser-based SQL client for PostgreSQL.
              It lets you connect to any Postgres database, explore schemas,
              run queries, and inspect data - without installing a desktop
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
              Neon PostgreSQL instance directly from your account - credentials
              are configured automatically and the studio connects immediately.
              With a <ToolInfo.Strong>tunnel connection</ToolInfo.Strong>, you
              run the <ToolInfo.Code>1tt</ToolInfo.Code> CLI on your machine,
              which opens a WebSocket proxy to the studio. Queries are relayed
              through the tunnel and executed locally - no data leaves your
              environment.
            </ToolInfo.P>

            <ToolInfo.H2>How to use this tool</ToolInfo.H2>
            <ToolInfo.UL>
              <li>
                <ToolInfo.Strong>Create a managed database</ToolInfo.Strong> -
                go to your account, create a Neon database, and open the studio
                in one click
              </li>
              <li>
                <ToolInfo.Strong>Connect via tunnel</ToolInfo.Strong> - generate
                a tunnel token, install the{" "}
                <ToolInfo.Code>1tt</ToolInfo.Code> CLI, and run{" "}
                <ToolInfo.Code>1tt tunnel --token ... --db postgres://...</ToolInfo.Code>
              </li>
              <li>
                <ToolInfo.Strong>Browse the schema</ToolInfo.Strong> - explore
                tables, columns, indexes, and foreign keys in the sidebar
              </li>
              <li>
                <ToolInfo.Strong>Run SQL queries</ToolInfo.Strong> - write and
                execute queries with syntax highlighting and result pagination
              </li>
              <li>
                <ToolInfo.Strong>Inspect and edit rows</ToolInfo.Strong> - view,
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
                Teaching SQL interactively - spin up a fresh database and
                explore it in real time
              </li>
            </ToolInfo.UL>
          </ToolInfo>
        </div>
      </ToolLayout>
    </>
  );
}
