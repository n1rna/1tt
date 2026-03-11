"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { AuthGate } from "@/components/layout/auth-gate";
import { SYNCABLE_KEYS, type SyncableKeyDef } from "@/lib/sync/schema";
import { getToolBySlug } from "@/lib/tools/registry";
import * as icons from "lucide-react";
import {
  Cloud,
  CloudOff,
  Loader2,
  Trash2,
  HardDrive,
  ArrowUpFromLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ── Types ──────────────────────────────────────────

interface CloudEntry {
  key: string;
  size: number;
  updatedAt: string;
}

// ── Helpers ────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Resolve tool icon for a syncable key */
function getToolIcon(slug: string): string {
  return getToolBySlug(slug)?.icon ?? "Box";
}

/** Resolve tool name for a syncable key */
function getToolName(slug: string): string {
  return getToolBySlug(slug)?.name ?? slug;
}

// ── Component ──────────────────────────────────────

function SyncManagerInner() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  const [cloudEntries, setCloudEntries] = useState<Map<string, CloudEntry>>(new Map());
  const [syncModes, setSyncModes] = useState<Map<string, "local" | "cloud">>(new Map());
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

  // Read sync modes from localStorage on mount
  useEffect(() => {
    const modes = new Map<string, "local" | "cloud">();
    for (const k of SYNCABLE_KEYS) {
      const stored = localStorage.getItem(`sync-mode:${k.key}`);
      modes.set(k.key, stored === "cloud" ? "cloud" : "local");
    }
    setSyncModes(modes);
  }, []);

  // Fetch cloud summary
  const fetchSummary = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/proxy/tool-state/summary", {
        credentials: "include",
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = (await res.json()) as { states: CloudEntry[] };
      const map = new Map<string, CloudEntry>();
      for (const e of json.states) {
        map.set(e.key, e);
      }
      setCloudEntries(map);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Enable cloud sync for a key
  const enableCloud = useCallback(
    async (key: string) => {
      setActionKey(key);
      localStorage.setItem(`sync-mode:${key}`, "cloud");
      setSyncModes((prev) => new Map(prev).set(key, "cloud"));

      // Push current local state to cloud
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          await fetch("/api/proxy/tool-state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, data: JSON.parse(raw) }),
            credentials: "include",
          });
        } catch {
          // ignore
        }
      }
      await fetchSummary();
      setActionKey(null);
    },
    [fetchSummary],
  );

  // Disable cloud sync for a key (deletes from cloud)
  const disableCloud = useCallback(
    async (key: string) => {
      setActionKey(key);
      localStorage.setItem(`sync-mode:${key}`, "local");
      setSyncModes((prev) => new Map(prev).set(key, "local"));

      try {
        await fetch(`/api/proxy/tool-state?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {
        // ignore
      }
      await fetchSummary();
      setActionKey(null);
    },
    [fetchSummary],
  );

  // Delete cloud data for a key (without changing sync mode)
  const deleteCloudData = useCallback(
    async (key: string) => {
      setActionKey(key);
      try {
        await fetch(`/api/proxy/tool-state?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {
        // ignore
      }
      await fetchSummary();
      setActionKey(null);
    },
    [fetchSummary],
  );

  // Totals
  const totalUsed = Array.from(cloudEntries.values()).reduce(
    (sum, e) => sum + e.size,
    0,
  );
  const totalQuota = SYNCABLE_KEYS.reduce((sum, k) => sum + k.maxSizeBytes, 0);
  const cloudKeyCount = Array.from(syncModes.values()).filter(
    (m) => m === "cloud",
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Cloud Sync</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage which tools sync their data to the cloud. Cloud data is
          tied to your account and available across devices.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Storage used</div>
          <div className="text-xl font-semibold mt-1 tabular-nums">
            {loading ? "-" : formatBytes(totalUsed)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            of {formatBytes(totalQuota)} quota
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Cloud synced</div>
          <div className="text-xl font-semibold mt-1 tabular-nums">
            {cloudKeyCount}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            of {SYNCABLE_KEYS.length} keys
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">On cloud</div>
          <div className="text-xl font-semibold mt-1 tabular-nums">
            {loading ? "-" : cloudEntries.size}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            entries stored
          </div>
        </div>
      </div>

      {/* Storage bar */}
      {!loading && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Quota usage</span>
            <span className="tabular-nums">
              {((totalUsed / totalQuota) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min((totalUsed / totalQuota) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Tool list */}
      <div className="rounded-lg border divide-y">
        {SYNCABLE_KEYS.map((keyDef) => {
          const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[
            getToolIcon(keyDef.toolSlug)
          ];
          const mode = syncModes.get(keyDef.key) ?? "local";
          const cloud = cloudEntries.get(keyDef.key);
          const isCloud = mode === "cloud";
          const isBusy = actionKey === keyDef.key;
          const usagePercent = cloud
            ? (cloud.size / keyDef.maxSizeBytes) * 100
            : 0;

          return (
            <div
              key={keyDef.key}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* Tool icon */}
              {Icon && (
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              )}

              {/* Label and meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tools/${keyDef.toolSlug}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {keyDef.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {getToolName(keyDef.toolSlug)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {isCloud && cloud ? (
                    <>
                      <span className="tabular-nums">
                        {formatBytes(cloud.size)} /{" "}
                        {formatBytes(keyDef.maxSizeBytes)}
                      </span>
                      <span className="tabular-nums">
                        {relativeTime(new Date(cloud.updatedAt))}
                      </span>
                    </>
                  ) : isCloud ? (
                    <span>No data on cloud yet</span>
                  ) : (
                    <span>
                      Local only - max {formatBytes(keyDef.maxSizeBytes)}
                    </span>
                  )}
                </div>
                {/* Per-key usage bar */}
                {isCloud && cloud && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5 max-w-48">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{
                        width: `${Math.min(usagePercent, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isCloud ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Push local state to cloud"
                      onClick={() => enableCloud(keyDef.key)}
                    >
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    {cloud && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Delete cloud data"
                        onClick={() => deleteCloudData(keyDef.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Disable cloud sync"
                      onClick={() => disableCloud(keyDef.key)}
                    >
                      <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    title="Enable cloud sync"
                    onClick={() => enableCloud(keyDef.key)}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    Enable
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SyncManager() {
  return (
    <AuthGate>
      <SyncManagerInner />
    </AuthGate>
  );
}
