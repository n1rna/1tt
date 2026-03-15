"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Database, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/layout/auth-gate";
import {
  getHostedSqliteDb,
  createTursoExecutor,
  getTursoSchema,
  type HostedSqliteDB,
} from "@/lib/hosted-sqlite";
import { StudioShell } from "./database-studio/studio-shell";
import { useBillingStatus } from "@/lib/billing";
import type { TableSchema, QueryExecutor } from "./database-studio/types";
import { ApiInfoDialog } from "./hosted-sqlite-api-dialog";

function HostedSqliteStudioInner() {
  const params = useParams();
  const dbId = params.id as string;

  const [db, setDb] = useState<HostedSqliteDB | null>(null);
  const [schema, setSchema] = useState<TableSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [apiOpen, setApiOpen] = useState(false);

  const { data: billing } = useBillingStatus();
  const aiEnabled = billing != null && billing.plan !== "free";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSchemaLoading(true);
      try {
        const detail = await getHostedSqliteDb(dbId);
        if (cancelled) return;
        setDb(detail);

        if (detail.tursoHostname && detail.apiKey) {
          const tables = await getTursoSchema(detail.tursoHostname, detail.apiKey);
          if (!cancelled) setSchema(tables);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setSchemaLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [dbId]);

  // Build the query executor once the DB detail is available.
  // If we have a Turso hostname + token, go direct; otherwise fall back to proxy.
  const queryExecutor = useCallback<QueryExecutor>(
    (sql: string) => {
      if (db?.tursoHostname && db.apiKey) {
        return createTursoExecutor(db.tursoHostname, db.apiKey)(sql);
      }
      return Promise.resolve({ error: "Database not ready" });
    },
    [db]
  );

  const sidebarHeader = (
    <div className="px-3 py-2.5 border-b space-y-1.5">
      <Link
        href="/account/databases"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3 w-3" />
        All databases
      </Link>
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold truncate flex-1 min-w-0">
          {db?.name ?? dbId}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setApiOpen(true)}
          title="API access"
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {db && (
        <ApiInfoDialog
          db={db}
          open={apiOpen}
          onOpenChange={setApiOpen}
        />
      )}
    </div>
  );

  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      <StudioShell
        queryExecutor={queryExecutor}
        dialect="sqlite"
        schema={schema}
        schemaLoading={schemaLoading}
        sidebarHeader={sidebarHeader}
        aiEnabled={aiEnabled}
      />
    </>
  );
}

export function HostedSqliteStudio() {
  return (
    <AuthGate>
      <HostedSqliteStudioInner />
    </AuthGate>
  );
}
