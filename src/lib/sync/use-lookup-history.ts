"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSyncedState } from "./use-synced-state";

export type LookupTool = "dns" | "og" | "ssl" | "email";

export interface LookupHistoryEntry {
  id: string;
  tool: LookupTool;
  query: string;       // domain or URL
  timestamp: number;    // Date.now()
  result: unknown;      // tool-specific result blob
}

const MAX_ENTRIES = 500;
const STORAGE_KEY = "lookup-history";
const OLD_DNS_KEY = "dns-lookup-history";

export function useLookupHistory() {
  const sync = useSyncedState<LookupHistoryEntry[]>(STORAGE_KEY, []);
  const migrated = useRef(false);

  // One-time migration from old dns-lookup-history
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;

    try {
      const oldRaw = localStorage.getItem(OLD_DNS_KEY);
      const newRaw = localStorage.getItem(STORAGE_KEY);
      if (oldRaw && !newRaw) {
        const oldEntries = JSON.parse(oldRaw) as Array<{
          domain: string;
          lastLookup: number;
          results: Record<string, unknown>;
        }>;
        const converted: LookupHistoryEntry[] = oldEntries.map((e) => ({
          id: crypto.randomUUID(),
          tool: "dns" as const,
          query: e.domain,
          timestamp: e.lastLookup,
          result: e.results,
        }));
        sync.setData(converted);
        localStorage.removeItem(OLD_DNS_KEY);
        localStorage.removeItem(`sync-mode:${OLD_DNS_KEY}`);
      }
    } catch {
      // Ignore migration errors
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const entriesForTool = useCallback(
    (tool: LookupTool): LookupHistoryEntry[] =>
      sync.data.filter((e) => e.tool === tool),
    [sync.data]
  );

  const addEntry = useCallback(
    (tool: LookupTool, query: string, result: unknown) => {
      sync.setData((prev) => {
        // Remove existing entry with same tool+query to avoid duplicates
        const filtered = prev.filter(
          (e) => !(e.tool === tool && e.query === query)
        );
        const entry: LookupHistoryEntry = {
          id: crypto.randomUUID(),
          tool,
          query,
          timestamp: Date.now(),
          result,
        };
        // Prepend new entry, cap at MAX_ENTRIES
        return [entry, ...filtered].slice(0, MAX_ENTRIES);
      });
    },
    [sync.setData]
  );

  const removeEntry = useCallback(
    (id: string) => {
      sync.setData((prev) => prev.filter((e) => e.id !== id));
    },
    [sync.setData]
  );

  const clearForTool = useCallback(
    (tool: LookupTool) => {
      sync.setData((prev) => prev.filter((e) => e.tool !== tool));
    },
    [sync.setData]
  );

  return {
    entries: sync.data,
    entriesForTool,
    addEntry,
    removeEntry,
    clearForTool,
    syncToggleProps: sync.syncToggleProps,
  };
}
