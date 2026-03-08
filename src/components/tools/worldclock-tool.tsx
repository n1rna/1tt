"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Plus, Search, Clock, MapPin } from "lucide-react";

// ── Types ────────────────────────────────────────────

interface ClockEntry {
  tz: string;
  label: string;
}

// ── Helpers ──────────────────────────────────────────

const ALL_TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"];
  }
})();

const DEFAULT_FAVORITES: ClockEntry[] = [
  { tz: "UTC", label: "UTC" },
  { tz: "America/New_York", label: "New York" },
  { tz: "Europe/London", label: "London" },
  { tz: "Asia/Tokyo", label: "Tokyo" },
];

const DEFAULT_OVERLAP: ClockEntry[] = [
  { tz: "UTC", label: "UTC" },
  { tz: "America/New_York", label: "New York" },
  { tz: "Europe/London", label: "London" },
];

function tzLabel(tz: string): string {
  // Derive a readable city/region label from IANA tz name
  const parts = tz.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

function formatTime(date: Date, tz: string): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date, tz: string): string {
  return date.toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getUtcOffsetMinutes(tz: string, date: Date): number {
  // Parse UTC offset by comparing locale strings
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC", hour12: false, hour: "2-digit", minute: "2-digit" });
  const tzStr  = date.toLocaleString("en-US", { timeZone: tz,    hour12: false, hour: "2-digit", minute: "2-digit" });

  const [utcH, utcM] = utcStr.split(":").map(Number);
  const [tzH,  tzM]  = tzStr.split(":").map(Number);

  let diff = (tzH * 60 + tzM) - (utcH * 60 + utcM);
  // Handle day boundary crossing
  if (diff > 720)  diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs  = Math.abs(minutes);
  const h    = Math.floor(abs / 60).toString().padStart(2, "0");
  const m    = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

function localHourInTz(utcHour: number, offsetMinutes: number): number {
  return ((utcHour * 60 + offsetMinutes) / 60 + 24) % 24;
}

// ── Subcomponents ─────────────────────────────────────

function formatRelative(diffMinutes: number): string {
  if (diffMinutes === 0) return "same time";
  const abs = Math.abs(diffMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return `${parts.join(" ")} ${diffMinutes > 0 ? "ahead" : "behind"}`;
}

function ClockCard({ entry, onRemove, now, isLocal, relativeText }: {
  entry: ClockEntry;
  onRemove: (() => void) | null;
  now: Date;
  isLocal?: boolean;
  relativeText?: string;
}) {
  const offsetMin = getUtcOffsetMinutes(entry.tz, now);
  const timeStr   = formatTime(now, entry.tz);
  const dateStr   = formatDate(now, entry.tz);
  const offsetStr = formatOffset(offsetMin);

  return (
    <div className={`group relative flex flex-col gap-1 rounded-xl border px-5 py-4 ${isLocal ? "border-foreground/20 bg-foreground/[0.03]" : "bg-card"}`}>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
          aria-label={`Remove ${entry.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex items-center gap-1.5">
        {isLocal && <MapPin className="h-3 w-3 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground font-medium">{entry.label}</span>
        {isLocal && <span className="text-[10px] text-muted-foreground/60">· local</span>}
      </div>
      <span className="text-3xl font-mono font-semibold tracking-tight leading-none">{timeStr}</span>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-muted-foreground">{dateStr}</span>
        <span className="text-xs text-muted-foreground/60">·</span>
        <span className="text-xs text-muted-foreground">{offsetStr}</span>
        {relativeText && (
          <>
            <span className="text-xs text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground">{relativeText}</span>
          </>
        )}
      </div>
    </div>
  );
}

function TzSearchDropdown({
  onSelect,
  placeholder,
  exclude,
}: {
  onSelect: (tz: string, label: string) => void;
  placeholder?: string;
  exclude?: Set<string>;
}) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);
  const containerRef          = useRef<HTMLDivElement>(null);

  const filtered = ALL_TIMEZONES.filter(
    (tz) =>
      (!exclude || !exclude.has(tz)) &&
      tz.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 30);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(tz: string) {
    onSelect(tz, tzLabel(tz));
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-2 h-8 px-3 rounded-lg border bg-background text-sm cursor-pointer hover:border-foreground/30 transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder ?? "Search timezone…"}
            className="flex-1 bg-transparent outline-none text-sm min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-muted-foreground text-xs">{placeholder ?? "Add timezone…"}</span>
        )}
        {open && <Search className="h-3 w-3 text-muted-foreground shrink-0" />}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-72 max-h-60 overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {filtered.map((tz) => (
            <button
              key={tz}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(tz); }}
            >
              <span className="font-medium truncate">{tzLabel(tz)}</span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">{tz}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Overlap Timeline ──────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourBg(localHour: number): string {
  // Work hours 9–17: green tint; near-work 7–9,17–19: neutral; night 22–6: dark
  const h = localHour % 24;
  if (h >= 9 && h < 17) return "bg-emerald-500/70 dark:bg-emerald-600/60";
  if (h >= 7 && h < 9)  return "bg-muted/60";
  if (h >= 17 && h < 19) return "bg-muted/60";
  if (h >= 19 && h < 22) return "bg-muted/40";
  return "bg-muted/20"; // night
}

function isWorkHour(localHour: number): boolean {
  const h = localHour % 24;
  return h >= 9 && h < 17;
}

function formatHourMin(fractionalHour: number): string {
  const h = Math.floor(((fractionalHour % 24) + 24) % 24);
  const m = Math.round((fractionalHour - Math.floor(fractionalHour)) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function OverlapTimeline({
  entries,
  now,
  onRemove,
}: {
  entries: ClockEntry[];
  now: Date;
  onRemove: (tz: string) => void;
}) {
  const offsets = entries.map((e) => getUtcOffsetMinutes(e.tz, now));

  const goodUtcHours = new Set<number>();
  for (let utcH = 0; utcH < 24; utcH++) {
    if (entries.length > 0 && entries.every((_, i) => isWorkHour(localHourInTz(utcH, offsets[i])))) {
      goodUtcHours.add(utcH);
    }
  }

  const nowUtcHour = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const nowPct = (nowUtcHour / 24) * 100;

  // Hairpin follows cursor on hover — fractional UTC hour (0–24), null when not hovering
  const [hairpinUtc, setHairpinUtc] = useState<number | null>(null);
  const timelineAreaRef = useRef<HTMLDivElement>(null);

  const xToUtcHour = useCallback((clientX: number): number => {
    const area = timelineAreaRef.current;
    if (!area) return 0;
    const bars = area.querySelectorAll("[data-timeline-bar]");
    if (bars.length === 0) return 0;
    const rect = bars[0].getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * 24;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setHairpinUtc(xToUtcHour(e.clientX));
  }, [xToUtcHour]);

  const handleMouseLeave = useCallback(() => {
    setHairpinUtc(null);
  }, []);

  const hairpinPct = hairpinUtc !== null ? (hairpinUtc / 24) * 100 : null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour ruler */}
        <div className="flex ml-36 mb-1">
          {HOURS.map((h) => (
            <div
              key={h}
              className={`flex-1 text-center text-[10px] font-mono ${goodUtcHours.has(h) ? "text-emerald-500 font-semibold" : "text-muted-foreground/60"}`}
            >
              {h === 0 ? "0" : h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>

        {/* Per-timezone rows with hairpin overlay */}
        <div
          ref={timelineAreaRef}
          className="relative select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="divide-y">
            {entries.map((entry, idx) => {
              const offsetMin = offsets[idx];
              const offsetStr = formatOffset(offsetMin);

              return (
                <div key={entry.tz} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {/* Label */}
                  <div className="w-36 shrink-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium truncate">{entry.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(entry.tz); }}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={`Remove ${entry.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{offsetStr}</span>
                  </div>

                  {/* Timeline bar */}
                  <div data-timeline-bar className="relative flex-1 h-8">
                    {/* Color cells */}
                    <div className="absolute inset-0 flex rounded overflow-hidden border">
                      {HOURS.map((utcH) => {
                        const localH = localHourInTz(utcH, offsetMin);
                        const good   = goodUtcHours.has(utcH);
                        return (
                          <div
                            key={utcH}
                            className={`flex-1 ${hourBg(localH)} ${good ? "ring-inset ring-1 ring-emerald-500/40" : ""}`}
                          />
                        );
                      })}
                    </div>

                    {/* Current time indicator */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 z-10 pointer-events-none"
                      style={{ left: `${nowPct}%` }}
                    />

                    {/* Hairpin indicator with floating time label */}
                    {hairpinPct !== null && hairpinUtc !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-sky-500 z-20 pointer-events-none"
                        style={{ left: `${hairpinPct}%` }}
                      >
                        <span
                          className="absolute -top-4.5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-sky-500 whitespace-nowrap bg-background/90 px-1 rounded"
                        >
                          {formatHourMin(hairpinUtc + offsetMin / 60)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Good overlap summary */}
        {entries.length >= 2 && (
          <div className="mt-3">
            {goodUtcHours.size === 0 ? (
              <p className="text-xs text-muted-foreground">No overlapping work hours found across all timezones.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-500 font-medium">Good meeting windows (UTC):</span>{" "}
                {[...goodUtcHours].sort((a, b) => a - b).map((h) => `${h.toString().padStart(2, "0")}:00`).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────

function getLocalTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function WorldClockTool() {
  const [now,           setNow]          = useState(() => new Date());
  const [favorites,     setFavorites]    = useState<ClockEntry[]>([]);
  const [overlapTzs,    setOverlapTzs]   = useState<ClockEntry[]>([]);
  const [showRelative,  setShowRelative] = useState(false);
  const [localTz,       setLocalTz]      = useState("UTC");
  const [hydrated,      setHydrated]     = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const detectedTz = getLocalTz();
    setLocalTz(detectedTz);
    try {
      const fav = localStorage.getItem("worldclock-favorites");
      setFavorites(fav ? JSON.parse(fav) : DEFAULT_FAVORITES);
    } catch {
      setFavorites(DEFAULT_FAVORITES);
    }
    try {
      const ol = localStorage.getItem("worldclock-overlap");
      setOverlapTzs(ol ? JSON.parse(ol) : DEFAULT_OVERLAP);
    } catch {
      setOverlapTzs(DEFAULT_OVERLAP);
    }
    try {
      const rel = localStorage.getItem("worldclock-show-relative");
      if (rel !== null) setShowRelative(JSON.parse(rel));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persist favorites
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("worldclock-favorites", JSON.stringify(favorites));
  }, [favorites, hydrated]);

  // Persist overlap
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("worldclock-overlap", JSON.stringify(overlapTzs));
  }, [overlapTzs, hydrated]);

  // Persist relative toggle
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("worldclock-show-relative", JSON.stringify(showRelative));
  }, [showRelative, hydrated]);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const addFavorite = useCallback((tz: string, label: string) => {
    setFavorites((prev) => [...prev, { tz, label }]);
  }, []);

  const removeFavorite = useCallback((tz: string) => {
    setFavorites((prev) => prev.filter((e) => e.tz !== tz));
  }, []);

  const addOverlap = useCallback((tz: string, label: string) => {
    setOverlapTzs((prev) => [...prev, { tz, label }]);
  }, []);

  const removeOverlap = useCallback((tz: string) => {
    setOverlapTzs((prev) => prev.filter((e) => e.tz !== tz));
  }, []);

  // Local tz always first, then favorites (excluding local tz duplicate)
  const localEntry: ClockEntry = { tz: localTz, label: tzLabel(localTz) };
  const localOffsetMin = getUtcOffsetMinutes(localTz, now);
  const displayFavorites = [localEntry, ...favorites.filter((e) => e.tz !== localTz)];

  const favSet     = new Set(displayFavorites.map((e) => e.tz));
  const overlapSet = new Set(overlapTzs.map((e) => e.tz));

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Section A: Favorite Clocks ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Favorite Timezones</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Live clocks updating every second</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowRelative((v) => !v)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                showRelative
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:text-foreground border-input"
              }`}
            >
              Relative
            </button>
            <TzSearchDropdown
              onSelect={addFavorite}
              placeholder="Add timezone…"
              exclude={favSet}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {displayFavorites.map((entry) => {
            const isLocal = entry.tz === localTz;
            let relativeText: string | undefined;
            if (showRelative && !isLocal) {
              const entryOffset = getUtcOffsetMinutes(entry.tz, now);
              relativeText = formatRelative(entryOffset - localOffsetMin);
            }
            return (
              <ClockCard
                key={entry.tz}
                entry={entry}
                onRemove={isLocal ? null : () => removeFavorite(entry.tz)}
                now={now}
                isLocal={isLocal}
                relativeText={relativeText}
              />
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t" />

      {/* ── Section B: Overlap Finder ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Timezone Overlap Finder</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Green cells = working hours (9:00–17:00 local). Highlighted columns overlap across all zones.
            </p>
          </div>
          <TzSearchDropdown
            onSelect={addOverlap}
            placeholder="Add timezone…"
            exclude={overlapSet}
          />
        </div>

        {overlapTzs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Add at least two timezones to find overlap windows.
          </div>
        ) : (
          <div className="rounded-xl border p-4">
            <OverlapTimeline
              entries={overlapTzs}
              now={now}
              onRemove={removeOverlap}
            />
          </div>
        )}
      </section>
    </div>
  );
}
