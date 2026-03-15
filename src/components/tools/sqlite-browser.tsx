"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Database, Upload, Loader2, FileUp, X, Globe, LogIn, Server, Key, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";
import { SignInDialog } from "@/components/layout/sign-in-dialog";
import { uploadSqliteDb } from "@/lib/hosted-sqlite";
import { useBillingStatus } from "@/lib/billing";
import type { Database as SqlJsDatabase } from "sql.js";
import { StudioShell } from "@/components/account/database-studio/studio-shell";
import type {
  TableSchema,
  ColumnSchema,
  IndexSchema,
  QueryExecutor,
  QueryResult,
} from "@/components/account/database-studio/types";

// ─── SQLite schema extraction ───────────────────────────────────

function extractSchema(db: SqlJsDatabase): TableSchema[] {
  const result = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tableNames = (result[0]?.values ?? []).map((r) => String(r[0]));

  return tableNames.map((tableName) => {
    const pragmaResult = db.exec(`PRAGMA table_info("${tableName}")`);
    const columns: ColumnSchema[] = (pragmaResult[0]?.values ?? []).map((r) => ({
      name: String(r[1]),
      type: String(r[2]) || "ANY",
      nullable: !Boolean(r[3]),
      default: r[4] != null ? String(r[4]) : null,
      isPrimary: Boolean(r[5]),
      isUnique: false,
    }));

    const idxResult = db.exec(`PRAGMA index_list("${tableName}")`);
    const indexes: IndexSchema[] = (idxResult[0]?.values ?? []).map((r) => {
      const idxName = String(r[1]);
      const isUnique = Boolean(r[2]);
      const idxInfoResult = db.exec(`PRAGMA index_info("${idxName}")`);
      const idxColumns = (idxInfoResult[0]?.values ?? []).map((c) => String(c[2]));

      if (isUnique && idxColumns.length === 1) {
        const col = columns.find((c) => c.name === idxColumns[0]);
        if (col && !col.isPrimary) col.isUnique = true;
      }

      return {
        name: idxName,
        columns: idxColumns,
        isUnique,
        isPrimary: idxName.endsWith("_pkey") || idxName.startsWith("sqlite_autoindex_"),
        definition: `CREATE INDEX "${idxName}" ON "${tableName}" (${idxColumns.map((c) => `"${c}"`).join(", ")})`,
      };
    });

    const countResult = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
    const rowEstimate = Number(countResult[0]?.values[0]?.[0] ?? 0);

    return {
      schema: "main",
      name: tableName,
      type: "table",
      columns,
      indexes,
      rowEstimate,
    };
  });
}

// ─── SQLite query executor ──────────────────────────────────────

function createSqliteExecutor(db: SqlJsDatabase): QueryExecutor {
  return async (sql: string): Promise<QueryResult> => {
    try {
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let lastResult: QueryResult = { rowsAffected: 0 };

      for (const stmt of statements) {
        const upper = stmt.toUpperCase();
        if (upper === "BEGIN" || upper === "COMMIT" || upper === "ROLLBACK") {
          continue;
        }

        const results = db.exec(stmt);

        if (results.length > 0) {
          const r = results[0];
          lastResult = {
            columns: r.columns,
            rows: r.values.map((row) =>
              row.map((v) => (v == null ? null : String(v))) as string[]
            ),
            rowCount: r.values.length,
          };
        } else {
          lastResult = {
            rowsAffected: db.getRowsModified(),
          };
        }
      }

      return lastResult;
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };
}

// ─── Main component ─────────────────────────────────────────────

export function SqliteBrowser({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = !!session;

  const { data: billing } = useBillingStatus();
  // AI requires both a session and a paid plan
  const aiEnabled = isLoggedIn && billing != null && billing.plan !== "free";

  const [db, setDb] = useState<SqlJsDatabase | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDatabase = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const initSqlJs = (await import("sql.js")).default;
      const SQL = await initSqlJs({
        locateFile: () => "/sql-wasm.wasm",
      });
      const newDb = new SQL.Database(new Uint8Array(buffer));
      setDb((prev) => {
        prev?.close();
        return newDb;
      });
      setFileName(name);
    } catch (e) {
      setError(`Failed to open database: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    setDb((prev) => {
      prev?.close();
      return null;
    });
    setFileName("");
  }, []);

  const handleFileInput = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      await loadDatabase(buffer, file.name);
    },
    [loadDatabase]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileInput(file);
    },
    [handleFileInput]
  );

  const openPublishDialog = useCallback(() => {
    if (!db || !fileName) return;
    if (!isLoggedIn) {
      setSignInOpen(true);
      return;
    }
    setPublishName(fileName.replace(/\.(sqlite3?|db3?)$/i, "") || fileName);
    setPublishError(null);
    setPublishOpen(true);
  }, [db, fileName, isLoggedIn]);

  const handlePublishConfirm = useCallback(async () => {
    if (!db || !publishName.trim()) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const data = db.export();
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/x-sqlite3" });
      const file = new File([blob], fileName, { type: "application/x-sqlite3" });
      const result = await uploadSqliteDb(file, publishName.trim());
      setPublishOpen(false);
      router.push(`/account/sqlite/${result.id}`);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Publish failed");
      setPublishing(false);
    }
  }, [db, fileName, publishName, router]);

  const schema = useMemo<TableSchema[]>(() => {
    if (!db) return [];
    try {
      return extractSchema(db);
    } catch {
      return [];
    }
  }, [db]);

  const queryExecutor = useMemo<QueryExecutor | null>(() => {
    if (!db) return null;
    return createSqliteExecutor(db);
  }, [db]);

  // Hidden file input shared between all states
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".sqlite,.db,.sqlite3,.db3"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFileInput(file);
        e.target.value = "";
      }}
    />
  );

  // ─── No database loaded ─────────────────────────────────────────

  if (!db || !queryExecutor) {
    return (
      <>
        {fileInput}
        <div
          className="flex flex-col items-center justify-center gap-6 px-4 py-24"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                <Database className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">Open a SQLite Database</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Drop a <code className="px-1 py-0.5 rounded bg-muted text-xs">.sqlite</code> or{" "}
                <code className="px-1 py-0.5 rounded bg-muted text-xs">.db</code> file here, or click
                to browse.
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Upload className="h-4 w-4" />
              Choose file
            </button>
          </div>
          {children}
        </div>
      </>
    );
  }

  // ─── Database loaded ──────────────────────────────────────────

  const sidebarHeader = (
    <div className="px-3 py-2.5 border-b">
      <p className="text-[10px] text-muted-foreground">
        {schema.length} table{schema.length !== 1 ? "s" : ""} · client-side
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Lock body scroll when studio is active */}
      <style>{`body { overflow: hidden; }`}</style>
      {fileInput}

      {/* Top bar — matches Elasticsearch pattern */}
      <div className="border-b shrink-0">
        <div className="flex items-center gap-2 px-4 py-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">SQLite Browser</span>
          <span className="text-xs text-muted-foreground truncate">
            — {fileName}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={openPublishDialog}
              disabled={publishing}
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isLoggedIn ? (
                <Globe className="h-3.5 w-3.5" />
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )}
              {publishing ? "Publishing…" : "Publish"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5" />
              Open File
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground"
              onClick={handleClose}
            >
              <X className="h-3.5 w-3.5" />
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Studio */}
      <StudioShell
        queryExecutor={queryExecutor}
        dialect="sqlite"
        schema={schema}
        schemaLoading={false}
        sidebarHeader={sidebarHeader}
        aiEnabled={aiEnabled}
        className="flex-1 min-h-0"
      />

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

      {/* Publish confirmation dialog */}
      <Dialog
        open={publishOpen}
        onOpenChange={(v) => {
          if (!publishing) setPublishOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-primary" />
              Publish Database
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your database will be hosted on{" "}
              <a
                href="https://turso.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                Turso
              </a>
              , a globally distributed SQLite-compatible platform powered by{" "}
              <a
                href="https://github.com/tursodatabase/libsql"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                libSQL
              </a>
              . You&apos;ll get:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2.5 text-sm">
                <Server className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">
                    Native connection URL
                  </span>{" "}
                  <span className="text-muted-foreground">
                    — connect with official Turso/libSQL SDKs for JavaScript,
                    Python, Go, Rust, and more
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2.5 text-sm">
                <Key className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">
                    Auth token
                  </span>{" "}
                  <span className="text-muted-foreground">
                    — secure JWT-based authentication scoped to your database
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2.5 text-sm">
                <ExternalLink className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">
                    Online studio
                  </span>{" "}
                  <span className="text-muted-foreground">
                    — browse tables, edit data, and run SQL from the web
                  </span>
                </span>
              </li>
            </ul>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Database name
              </label>
              <Input
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                placeholder="my-database"
                className="text-sm"
                disabled={publishing}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              File size:{" "}
              <span className="font-medium text-foreground">
                {db
                  ? `${(db.export().length / 1024 / 1024).toFixed(2)} MB`
                  : "—"}
              </span>
              {" · "}Encrypted at rest and in transit
            </p>

            {publishError && (
              <p className="text-sm text-destructive">{publishError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPublishOpen(false)}
                disabled={publishing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handlePublishConfirm}
                disabled={!publishName.trim() || publishing}
              >
                {publishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                {publishing ? "Publishing…" : "Publish Database"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
