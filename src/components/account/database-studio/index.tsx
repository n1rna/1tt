"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Database, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/layout/auth-gate";
import { ConnectionDialog } from "@/components/account/connection-dialog";
import { getDatabaseSchema, queryDatabase } from "@/lib/databases";
import { StudioShell } from "./studio-shell";
import { useBillingStatus } from "@/lib/billing";
import type { TableSchema } from "./types";

function DatabaseStudioInner() {
  const params = useParams();
  const dbId = params.id as string;

  const [dbName, setDbName] = useState<string>("");
  const [schema, setSchema] = useState<TableSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [connOpen, setConnOpen] = useState(false);

  const { data: billing } = useBillingStatus();
  const aiEnabled = billing != null && billing.plan !== "free";

  // Load schema + db name
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSchemaLoading(true);
      try {
        const [detailRes, tables] = await Promise.all([
          fetch(`/api/proxy/databases/${dbId}`, { credentials: "include" }),
          getDatabaseSchema(dbId),
        ]);
        if (cancelled) return;
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as { name?: string };
          if (!cancelled) setDbName(detail.name ?? dbId);
        }
        // Coerce the schema to our extended TableSchema type (backend may not have all fields yet)
        const coerced = tables.map((t) => ({
          ...t,
          indexes: (t as unknown as { indexes?: TableSchema["indexes"] }).indexes ?? [],
          rowEstimate: (t as unknown as { rowEstimate?: number }).rowEstimate ?? 0,
          columns: t.columns.map((c) => ({
            ...c,
            isPrimary: (c as unknown as { isPrimary?: boolean }).isPrimary ?? false,
            isUnique: (c as unknown as { isUnique?: boolean }).isUnique ?? false,
            foreignKey: (c as unknown as { foreignKey?: { table: string; column: string } }).foreignKey,
          })),
        })) as TableSchema[];
        if (!cancelled) setSchema(coerced);
      } catch {
        // silently fail — sidebar will show nothing
      } finally {
        if (!cancelled) setSchemaLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dbId]);

  const queryExecutor = useCallback(
    (sql: string) => queryDatabase(dbId, sql),
    [dbId]
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
          {dbName || dbId}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setConnOpen(true)}
          title="Connection details"
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ConnectionDialog
        dbId={dbId}
        dbName={dbName || dbId}
        open={connOpen}
        onOpenChange={setConnOpen}
      />
    </div>
  );

  return (
    <StudioShell
      queryExecutor={queryExecutor}
      dialect="postgres"
      schema={schema}
      schemaLoading={schemaLoading}
      sidebarHeader={sidebarHeader}
      aiEnabled={aiEnabled}
    />
  );
}

export function DatabaseStudio() {
  return (
    <AuthGate>
      <DatabaseStudioInner />
    </AuthGate>
  );
}
