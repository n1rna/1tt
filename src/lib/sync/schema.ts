export interface SyncableKeyDef {
  key: string;
  toolSlug: string;
  label: string;
  maxSizeBytes: number;
}

export const SYNCABLE_KEYS: SyncableKeyDef[] = [
  { key: "1two:calendar-markers", toolSlug: "calendar", label: "Calendar Markers", maxSizeBytes: 65536 },
  { key: "pomodoro-state", toolSlug: "pomodoro", label: "Pomodoro State", maxSizeBytes: 32768 },
  { key: "worldclock-state", toolSlug: "worldclock", label: "World Clock State", maxSizeBytes: 32768 },
  { key: "lookup-history", toolSlug: "dns", label: "Lookup History", maxSizeBytes: 262144 },
  { key: "1two-saved-logos", toolSlug: "logo", label: "Saved Logos", maxSizeBytes: 262144 },
  { key: "og-custom-layouts", toolSlug: "og", label: "OG Custom Layouts", maxSizeBytes: 262144 },
  { key: "1two-saved-colors", toolSlug: "color", label: "Saved Colors", maxSizeBytes: 65536 },
  { key: "1two-saved-themes", toolSlug: "color", label: "Saved Themes", maxSizeBytes: 65536 },
  { key: "1two:bookmarks", toolSlug: "preferences", label: "Bookmarks", maxSizeBytes: 8192 },
  { key: "1two:tool-order", toolSlug: "preferences", label: "Tool Order", maxSizeBytes: 8192 },
];

export const SYNCABLE_KEY_MAP = new Map(SYNCABLE_KEYS.map((k) => [k.key, k]));

/** Get all syncable keys for a given tool slug */
export function getSyncableKeysForTool(toolSlug: string): SyncableKeyDef[] {
  return SYNCABLE_KEYS.filter((k) => k.toolSlug === toolSlug);
}
