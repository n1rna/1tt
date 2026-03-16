"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, GlobeLock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Relative time helper ────────────────────────────────

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
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

function absoluteTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).format(date);
}

// ── Tooltip ─────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-0 top-full mt-1.5 z-50 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-1 text-[11px] text-popover-foreground shadow-sm pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );
}

// ── SyncToggle props ────────────────────────────────────

export interface SyncToggleProps {
  syncMode: "local" | "cloud";
  onSyncModeChange: (mode: "local" | "cloud") => void;
  onPushToCloud: () => void;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  isLoggedIn: boolean;
  /** Optional label shown before the toggle icon */
  label?: string;
}

export function SyncToggle({
  syncMode,
  onSyncModeChange,
  onPushToCloud,
  isSyncing,
  lastSyncedAt,
  isLoggedIn,
  label,
}: SyncToggleProps) {
  const [showRelative, setShowRelative] = useState(true);
  const [, setTick] = useState(0);

  // Tick every 10s to keep relative time fresh
  useEffect(() => {
    if (!showRelative || !lastSyncedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [showRelative, lastSyncedAt]);

  const toggleMode = useCallback(() => {
    if (!isLoggedIn) return;
    onSyncModeChange(syncMode === "cloud" ? "local" : "cloud");
  }, [isLoggedIn, syncMode, onSyncModeChange]);

  const syncDate = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const syncTimeText = syncDate
    ? showRelative
      ? relativeTime(syncDate)
      : absoluteTime(syncDate)
    : null;

  const tooltipText = !isLoggedIn
    ? "Sign in to sync"
    : syncMode === "cloud"
      ? "Cloud sync on - click to disable"
      : "Cloud sync off - click to enable";

  return (
    <div className="flex items-center gap-0.5">
      {label && (
        <span className="text-[10px] text-muted-foreground/60 mr-0.5">{label}</span>
      )}
      <Tooltip text={tooltipText}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleMode}
          disabled={!isLoggedIn}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : !isLoggedIn ? (
            <GlobeLock className="h-4 w-4 text-muted-foreground/50" />
          ) : syncMode === "cloud" ? (
            <Globe className="h-4 w-4 text-primary" />
          ) : (
            <GlobeLock className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </Tooltip>

      {syncMode === "cloud" && isLoggedIn && (
        <>
          <Tooltip text="Push local state to cloud">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onPushToCloud}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isSyncing ? "animate-spin" : ""}`} />
            </Button>
          </Tooltip>

          {syncTimeText && (
            <button
              onClick={() => setShowRelative((v) => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors tabular-nums cursor-pointer px-1"
              title="Click to toggle relative/absolute time"
            >
              {syncTimeText}
            </button>
          )}
        </>
      )}
    </div>
  );
}
