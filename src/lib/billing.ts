"use client";

import { useState, useEffect, useCallback } from "react";

export interface UsageMetric {
  current: number;
  limit: number;
  overageEnabled: boolean;
}

export interface ResourceMetric {
  current: number;
  limit: number;
}

export interface BillingStatus {
  plan: "free" | "pro" | "max";
  status: "active" | "trialing" | "canceled" | "none";
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
  usage: Record<string, UsageMetric>;
  resources: {
    databases: ResourceMetric;
    sqliteDbs: ResourceMetric;
  };
  limits: {
    ogCollections: number | null; // null = unlimited
    databasesMax: number;
    sqliteDbsMax: number;
    sqliteMaxSizeMB: number;
  };
}

export function useBillingStatus() {
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/billing/status", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch billing status: ${res.status}`);
      }
      const json = (await res.json()) as BillingStatus;
      setData(json);
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
