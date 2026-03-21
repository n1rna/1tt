"use client";

import { useEffect } from "react";
import { AuthGate } from "@/components/layout/auth-gate";
import { ElasticsearchExplorer, setEsTunnelExecutor } from "@/components/tools/elasticsearch-explorer";

function EsTunnelStudioInner({ token }: { token: string }) {
  useEffect(() => {
    setEsTunnelExecutor(async (method: string, path: string, body: string) => {
      const res = await fetch(`/api/proxy/tunnel/${token}/query`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, path, body: body || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    });

    return () => {
      setEsTunnelExecutor(null);
    };
  }, [token]);

  return <ElasticsearchExplorer tunnelMode />;
}

export function EsTunnelStudio({ token }: { token: string }) {
  return (
    <AuthGate>
      <EsTunnelStudioInner token={token} />
    </AuthGate>
  );
}
