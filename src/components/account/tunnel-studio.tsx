"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Database, Wifi, WifiOff, Loader2 } from "lucide-react";
import { AuthGate } from "@/components/layout/auth-gate";
import { StudioShell } from "@/components/account/database-studio/studio-shell";
import { useBillingStatus } from "@/lib/billing";
import { queryTunnel, getTunnelSchema } from "@/lib/tunnel";
import type { TableSchema } from "@/components/account/database-studio/types";

function TunnelStudioInner({ token }: { token: string }) {
  const [schema, setSchema] = useState<TableSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [dialect, setDialect] = useState<"postgres" | "redis">("postgres");
  const [error, setError] = useState<string | null>(null);

  const { data: billing } = useBillingStatus();
  const aiEnabled = billing != null && billing.plan !== "free";

  // Load schema (also checks if tunnel is connected)
  const loadSchema = useCallback(async () => {
    setSchemaLoading(true);
    setError(null);
    try {
      const result = await getTunnelSchema(token);
      const tables = (result.tables ?? []).map((t) => ({
        schema: t.schema ?? "public",
        name: t.name,
        type: "table",
        columns: (t.columns ?? []).map((c) => ({
          name: c.name,
          type: c.type,
          isPrimary: c.is_primary ?? false,
          isUnique: false,
          foreignKey: undefined,
        })),
        indexes: [],
        rowEstimate: 0,
      })) as unknown as TableSchema[];
      setSchema(tables);
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schema");
      setConnected(false);
    } finally {
      setSchemaLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const queryExecutor = useCallback(
    async (sql: string) => {
      const result = await queryTunnel(token, { sql });
      return {
        columns: result.columns ?? [],
        rows: (result.rows ?? []) as string[][],
        rowCount: result.rows_affected ?? result.rows?.length ?? 0,
      };
    },
    [token]
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
          External Database
        </span>
        {connected ? (
          <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/60 truncate font-mono">
        tunnel:{token.slice(0, 12)}…
      </p>
    </div>
  );

  if (!schemaLoading && error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <WifiOff className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium">Tunnel not connected</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Make sure the CLI is running with this tunnel token. The tunnel may have expired or the CLI disconnected.
          </p>
        </div>
        <p className="text-xs text-destructive">{error}</p>
        <Link
          href="/account/databases"
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Back to databases
        </Link>
      </div>
    );
  }

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting to tunnel…
      </div>
    );
  }

  return (
    <StudioShell
      queryExecutor={queryExecutor}
      dialect={dialect}
      schema={schema}
      schemaLoading={schemaLoading}
      sidebarHeader={sidebarHeader}
      aiEnabled={aiEnabled}
      onRefreshSchema={loadSchema}
      className="flex-1 min-h-0"
    />
  );
}

export function TunnelStudio({ token }: { token: string }) {
  return (
    <AuthGate>
      <TunnelStudioInner token={token} />
    </AuthGate>
  );
}
