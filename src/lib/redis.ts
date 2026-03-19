"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserRedis {
  id: string;
  name: string;
  region: string;
  endpoint: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RedisDetail extends UserRedis {
  restToken: string;
  password: string;
}

export interface RedisCommandResult {
  result: unknown;
  error?: string;
}

export function useRedis() {
  const [data, setData] = useState<UserRedis[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/redis", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch Redis instances: ${res.status}`);
      }
      const json = (await res.json()) as { databases: UserRedis[] };
      setData(json.databases ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export async function createRedis(
  name: string,
  region: string
): Promise<UserRedis> {
  const res = await fetch("/api/proxy/redis", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, region }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Redis instance: ${res.status}`);
  }
  return (await res.json()) as UserRedis;
}

export async function deleteRedis(id: string): Promise<void> {
  const res = await fetch(`/api/proxy/redis/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete Redis instance: ${res.status}`);
  }
}

export async function getRedisDetail(id: string): Promise<RedisDetail> {
  const res = await fetch(`/api/proxy/redis/${id}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Redis detail: ${res.status}`);
  }
  return (await res.json()) as RedisDetail;
}

// ── Executor override for tunnel mode ────────────────────────────────────────
// When set, all commands go through the tunnel instead of the hosted API.
// Set by the tunnel studio component, cleared on unmount.

let _tunnelExecutor: ((command: string[]) => Promise<RedisCommandResult>) | null = null;

export function setTunnelExecutor(fn: ((command: string[]) => Promise<RedisCommandResult>) | null) {
  _tunnelExecutor = fn;
}

export async function executeCommand(
  id: string,
  command: string[]
): Promise<RedisCommandResult> {
  if (_tunnelExecutor) {
    return _tunnelExecutor(command);
  }
  const res = await fetch(`/api/proxy/redis/${id}/command`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) {
    throw new Error(`Command failed: ${res.status}`);
  }
  return (await res.json()) as RedisCommandResult;
}

export async function executePipeline(
  id: string,
  commands: string[][]
): Promise<RedisCommandResult[]> {
  if (_tunnelExecutor) {
    // Execute commands sequentially through the tunnel
    return Promise.all(commands.map((cmd) => _tunnelExecutor!(cmd)));
  }
  const res = await fetch(`/api/proxy/redis/${id}/pipeline`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  if (!res.ok) {
    throw new Error(`Pipeline failed: ${res.status}`);
  }
  return (await res.json()) as RedisCommandResult[];
}

export async function getRedisInfo(id: string): Promise<RedisCommandResult> {
  if (_tunnelExecutor) {
    return _tunnelExecutor(["INFO"]);
  }
  const res = await fetch(`/api/proxy/redis/${id}/info`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Redis info: ${res.status}`);
  }
  return (await res.json()) as RedisCommandResult;
}
