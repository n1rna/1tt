"use client";

export interface TunnelToken {
  token: string;
  ws_url: string;
}

export interface TunnelStatus {
  connected: boolean;
  dialect?: string;
  version?: string;
}

export async function createTunnel(): Promise<TunnelToken> {
  const res = await fetch("/api/proxy/tunnel/create", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<TunnelToken>;
}

export async function queryTunnel(
  token: string,
  payload: { sql?: string; command?: string[] }
): Promise<{ columns?: string[]; rows?: unknown[][]; rows_affected?: number; result?: unknown; message?: string }> {
  const res = await fetch(`/api/proxy/tunnel/${token}/query`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string; error?: string }).message ?? (err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getTunnelSchema(
  token: string
): Promise<{ tables?: { schema: string; name: string; columns: { name: string; type: string; is_primary?: boolean }[] }[] }> {
  const res = await fetch(`/api/proxy/tunnel/${token}/schema`, {
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
