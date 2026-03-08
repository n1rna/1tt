"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  getSearchItems,
  searchItems,
  categoryLabels,
} from "@/lib/tools/registry";
import type { SearchItem } from "@/lib/tools/registry";
import { loadBookmarks } from "@/lib/tools/preferences";

function getIcon(name: string) {
  const Icon = (
    Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  )[name];
  return Icon || Icons.Wrench;
}

function groupByCategory(items: SearchItem[]) {
  const groups: Record<string, SearchItem[]> = {};
  for (const item of items) {
    const label = categoryLabels[item.category] || item.category;
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

export function ToolLauncher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const router = useRouter();
  const allItems = useMemo(() => getSearchItems(), []);

  const refreshBookmarks = useCallback(() => {
    setBookmarks(new Set(loadBookmarks()));
  }, []);

  useEffect(() => {
    refreshBookmarks();

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    function onBookmarksChanged() {
      refreshBookmarks();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("open-tool-launcher", onOpen);
    window.addEventListener("bookmarks-changed", onBookmarksChanged);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("open-tool-launcher", onOpen);
      window.removeEventListener("bookmarks-changed", onBookmarksChanged);
    };
  }, [refreshBookmarks]);

  // Refresh bookmarks when dialog opens
  useEffect(() => {
    if (open) refreshBookmarks();
  }, [open, refreshBookmarks]);

  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchItems(query, allItems),
    [query, allItems]
  );

  // Scroll results to top when query changes
  useEffect(() => {
    listRef.current?.scrollTo(0, 0);
  }, [query]);

  // When searching, show results grouped by category
  // When browsing (no query), show bookmarked items first in their own group
  const grouped = useMemo(() => {
    if (query.trim()) {
      return groupByCategory(results);
    }

    const bookmarked = results.filter(
      (item) => bookmarks.has(item.id) || bookmarks.has(item.href.replace("/tools/", "").split("?")[0])
    );
    const rest = results.filter(
      (item) => !bookmarks.has(item.id) && !bookmarks.has(item.href.replace("/tools/", "").split("?")[0])
    );

    const groups: Record<string, SearchItem[]> = {};

    if (bookmarked.length > 0) {
      groups["Bookmarked"] = bookmarked;
    }

    const restGrouped = groupByCategory(rest);
    for (const [key, items] of Object.entries(restGrouped)) {
      groups[key] = items;
    }

    return groups;
  }, [results, query, bookmarks]);

  function select(item: SearchItem) {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  // Check if an item's tool slug is bookmarked
  function isBookmarked(item: SearchItem): boolean {
    const slug = item.href.replace("/tools/", "").split("?")[0];
    return bookmarks.has(slug) || bookmarks.has(item.id);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
      shouldFilter={false}
      title="Tool Launcher"
      description="Search for a tool..."
    >
      <CommandInput
        placeholder="Search tools..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList ref={listRef} className="max-h-80">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1 py-4">
            <Icons.SearchX className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tools found</p>
            <p className="text-xs text-muted-foreground/60">
              Try a different search term
            </p>
          </div>
        </CommandEmpty>
        {Object.entries(grouped).map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map((item) => {
              const Icon = getIcon(item.icon);
              const starred = isBookmarked(item);
              return (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => select(item)}
                  keywords={[item.id]}
                  className="gap-3 py-2.5 px-2.5"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.parent ? (
                        <>
                          <span className="text-muted-foreground font-normal">
                            {item.parent}
                            <Icons.ChevronRight className="inline h-3 w-3 mx-0.5" />
                          </span>
                          {item.name}
                        </>
                      ) : (
                        item.name
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
                      {item.description}
                    </div>
                  </div>
                  {starred && (
                    <Icons.Star
                      className="h-3.5 w-3.5 text-amber-500 shrink-0"
                      fill="currentColor"
                    />
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
