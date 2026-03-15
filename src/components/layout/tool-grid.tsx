"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { tools, categoryLabels } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/registry";
import type { ToolCategory } from "@/lib/tools/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  loadBookmarks,
  saveBookmarks,
  loadToolOrder,
  saveToolOrder,
} from "@/lib/tools/preferences";
import { useSyncedState } from "@/lib/sync";
import { SyncToggle } from "@/components/ui/sync-toggle";

const FEATURED_SLUGS = ["json", "jwt", "color", "random", "cron", "logo", "og", "sqlite"];

// Category display order for "All Tools" section
const CATEGORY_ORDER: ToolCategory[] = [
  "formatting",
  "parsing",
  "encoding",
  "generators",
  "crypto",
  "conversion",
  "text",
  "web",
  "data",
  "media",
  "planning",
];

function getIcon(name: string) {
  const Icon = (
    Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  )[name];
  return Icon || Icons.Wrench;
}

function AuthBadge({ requiresAuth, loggedIn }: { requiresAuth?: boolean; loggedIn: boolean }) {
  if (!requiresAuth) return null;
  return loggedIn ? (
    <Icons.UserCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
  ) : (
    <Icons.Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
  );
}

// ── Bookmarked card (fancy, draggable) ─────────────────────────────────────

function SortableBookmarkCard({
  tool,
  onToggleBookmark,
  loggedIn,
}: {
  tool: ToolDefinition;
  onToggleBookmark: (slug: string) => void;
  loggedIn: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tool.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  const Icon = getIcon(tool.icon);

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <Link href={`/tools/${tool.slug}`} className="block h-full">
        {/* Gradient border via a pseudo-wrapper */}
        <div
          className={`relative h-full rounded-xl p-px transition-all duration-200 ${
            isDragging ? "shadow-xl" : "hover:-translate-y-0.5"
          }`}
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--color-primary) 40%, transparent), color-mix(in oklch, var(--color-primary) 10%, transparent) 60%, color-mix(in oklch, var(--color-border) 80%, transparent))",
          }}
        >
          <div className="h-full rounded-[11px] bg-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline" className="text-xs font-medium">
                {categoryLabels[tool.category]}
              </Badge>
              <AuthBadge requiresAuth={tool.requiresAuth} loggedIn={loggedIn} />
            </div>
            <h3 className="text-base font-semibold tracking-tight">{tool.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {tool.description}
            </p>
          </div>
        </div>
      </Link>

      {/* Bookmark toggle */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleBookmark(tool.slug);
        }}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-md text-amber-500 opacity-100 hover:text-amber-600 transition-colors"
        title="Remove bookmark"
      >
        <Icons.Star className="h-4 w-4" fill="currentColor" />
      </button>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute bottom-3 right-3 z-20 p-1.5 rounded-md text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-all"
        title="Drag to reorder"
      >
        <Icons.GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Featured card (fancy, static) ──────────────────────────────────────────

function FeaturedCard({
  tool,
  bookmarked,
  onToggleBookmark,
  loggedIn,
}: {
  tool: ToolDefinition;
  bookmarked: boolean;
  onToggleBookmark: (slug: string) => void;
  loggedIn: boolean;
}) {
  const Icon = getIcon(tool.icon);

  return (
    <div className="relative group">
      <Link href={`/tools/${tool.slug}`} className="block h-full">
        <div className="relative h-full rounded-xl border bg-card p-5 transition-all duration-200 hover:border-foreground/25 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20">
          {/* Subtle icon glow behind the icon container */}
          <div className="flex items-start gap-4 mb-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg blur-md bg-primary/20 scale-125" aria-hidden />
              <div className="relative p-2.5 rounded-lg bg-primary/10 ring-1 ring-primary/15">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-base font-semibold tracking-tight">{tool.name}</h3>
              <Badge variant="outline" className="text-xs font-medium mt-1">
                {categoryLabels[tool.category]}
              </Badge>
            </div>
            <AuthBadge requiresAuth={tool.requiresAuth} loggedIn={loggedIn} />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {tool.description}
          </p>
        </div>
      </Link>

      {/* Bookmark toggle */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleBookmark(tool.slug);
        }}
        className={`absolute top-3 right-3 z-20 p-1.5 rounded-md transition-all ${
          bookmarked
            ? "text-amber-500 opacity-100"
            : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-500"
        }`}
        title={bookmarked ? "Remove bookmark" : "Bookmark"}
      >
        <Icons.Star className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

// ── Hosted databases card (conditional routing) ─────────────────────────────

function DatabaseFeaturedCard({ loggedIn }: { loggedIn: boolean }) {
  const Icon = getIcon("Database");
  const href = loggedIn ? "/account/databases" : "/guides/postgresql-studio";

  return (
    <div className="relative group">
      <Link href={href} className="block h-full">
        <div className="relative h-full rounded-xl border bg-card p-5 transition-all duration-200 hover:border-foreground/25 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20">
          <div className="flex items-start gap-4 mb-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg blur-md bg-primary/20 scale-125" aria-hidden />
              <div className="relative p-2.5 rounded-lg bg-primary/10 ring-1 ring-primary/15">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-base font-semibold tracking-tight">Hosted Databases</h3>
              <Badge variant="outline" className="text-xs font-medium mt-1">
                Data Tools
              </Badge>
            </div>
            <AuthBadge requiresAuth loggedIn={loggedIn} />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            Provision and manage PostgreSQL databases directly from 1two.dev — no infrastructure setup required.
          </p>
        </div>
      </Link>
    </div>
  );
}

// ── Compact row item for "All Tools" ───────────────────────────────────────

function CompactToolRow({
  tool,
  bookmarked,
  featured,
  onToggleBookmark,
  loggedIn,
}: {
  tool: ToolDefinition;
  bookmarked: boolean;
  featured: boolean;
  onToggleBookmark: (slug: string) => void;
  loggedIn: boolean;
}) {
  const Icon = getIcon(tool.icon);

  return (
    <div className="group">
      <Link
        href={`/tools/${tool.slug}`}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 hover:bg-muted/60"
      >
        <div className="shrink-0 p-1.5 rounded-md bg-primary/8 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{tool.name}</span>
            {featured && (
              <Icons.Sparkles className="h-3 w-3 text-primary/60 shrink-0" />
            )}
            <AuthBadge requiresAuth={tool.requiresAuth} loggedIn={loggedIn} />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleBookmark(tool.slug);
              }}
              className={`p-0.5 rounded transition-all shrink-0 ${
                bookmarked
                  ? "text-amber-500 opacity-100"
                  : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-amber-500"
              }`}
              title={bookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <Icons.Star className="h-3 w-3" fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground truncate leading-relaxed">
            {tool.description}
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs shrink-0 hidden sm:inline-flex font-normal text-muted-foreground"
        >
          {categoryLabels[tool.category]}
        </Badge>
      </Link>
    </div>
  );
}

// ── Section heading ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

// ── Skeleton for SSR / before mount ────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="space-y-10">
      <div>
        <div className="h-4 w-24 rounded bg-muted mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.slice(0, 6).map((tool) => {
            const Icon = getIcon(tool.icon);
            return (
              <Link key={tool.slug} href={`/tools/${tool.slug}`} className="block">
                <div className="h-full rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[tool.category]}
                    </Badge>
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{tool.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function ToolGrid() {
  const {
    data: bookmarkSlugs,
    setData: setBookmarkSlugs,
    syncToggleProps,
    isLoggedIn: loggedIn,
  } = useSyncedState<string[]>("1two:bookmarks", []);
  const [mounted, setMounted] = useState(false);
  const [bookmarkOrder, setBookmarkOrder] = useState<string[]>([]);

  useEffect(() => {
    // Derive order from synced bookmarks + saved drag order
    const bm = bookmarkSlugs;
    const savedOrder = loadToolOrder();
    if (savedOrder.length > 0) {
      setBookmarkOrder(
        savedOrder.filter((slug) => bm.includes(slug)).concat(
          bm.filter((slug) => !savedOrder.includes(slug))
        )
      );
    } else {
      setBookmarkOrder(bm);
    }
    setMounted(true);
  }, [bookmarkSlugs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const toggleBookmark = useCallback((slug: string) => {
    setBookmarkSlugs((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug];
      // Also keep localStorage in sync for the tool-launcher
      saveBookmarks(next);
      return next;
    });
    setTimeout(() => window.dispatchEvent(new CustomEvent("bookmarks-changed")), 0);
  }, [setBookmarkSlugs]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setBookmarkOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const next = [...prev];
        next.splice(oldIndex, 1);
        next.splice(newIndex, 0, active.id as string);
        saveToolOrder(next);
        return next;
      });
    },
    []
  );

  if (!mounted) return <SkeletonGrid />;

  // ── Derive the three lists ──────────────────────────────────────────────

  // 1. Bookmarked - in user-defined order
  const bookmarkedTools = bookmarkOrder
    .map((slug) => tools.find((t) => t.slug === slug))
    .filter((t): t is ToolDefinition => t !== undefined);

  const bookmarkedSlugs = new Set(bookmarkOrder);

  // 2. Featured - hardcoded order, minus bookmarked
  const featuredTools = FEATURED_SLUGS
    .map((slug) => tools.find((t) => t.slug === slug))
    .filter((t): t is ToolDefinition => t !== undefined && !bookmarkedSlugs.has(t.slug));

  const featuredSlugsSet = new Set(FEATURED_SLUGS);

  // 3. All tools grouped by category
  const byCategory: Partial<Record<ToolCategory, ToolDefinition[]>> = {};
  for (const tool of tools) {
    if (!byCategory[tool.category]) byCategory[tool.category] = [];
    byCategory[tool.category]!.push(tool);
  }

  const categoryEntries = CATEGORY_ORDER
    .map((cat) => [cat, byCategory[cat]] as [ToolCategory, ToolDefinition[] | undefined])
    .filter(([, list]) => list && list.length > 0) as [ToolCategory, ToolDefinition[]][];

  return (
    <div className="space-y-10">

      <p className="text-sm text-muted-foreground/60 tracking-wide">no ads, just tools.</p>

      {/* ── Section 1: Bookmarks ── */}
      {bookmarkedTools.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Bookmarks
            </h2>
            <SyncToggle {...syncToggleProps} />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={bookmarkedTools.map((t) => t.slug)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookmarkedTools.map((tool) => (
                  <SortableBookmarkCard
                    key={tool.slug}
                    tool={tool}
                    onToggleBookmark={toggleBookmark}
                    loggedIn={loggedIn}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      )}

      {/* ── Section 2: Featured ── */}
      {featuredTools.length > 0 && (
        <section>
          <SectionHeading>Featured</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredTools.map((tool) => (
              <FeaturedCard
                key={tool.slug}
                tool={tool}
                bookmarked={bookmarkedSlugs.has(tool.slug)}
                onToggleBookmark={toggleBookmark}
                loggedIn={loggedIn}
              />
            ))}
            <DatabaseFeaturedCard loggedIn={loggedIn} />
          </div>
        </section>
      )}

      {/* ── Section 3: All Tools, grouped by category ── */}
      {categoryEntries.length > 0 && (
        <section>
          <SectionHeading>All Tools</SectionHeading>
          <div className="space-y-6">
            {categoryEntries.map(([category, catTools]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                    {categoryLabels[category]}
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="divide-y divide-border/40">
                  {catTools.map((tool) => (
                    <CompactToolRow
                      key={tool.slug}
                      tool={tool}
                      bookmarked={bookmarkedSlugs.has(tool.slug)}
                      featured={featuredSlugsSet.has(tool.slug)}
                      onToggleBookmark={toggleBookmark}
                      loggedIn={loggedIn}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
