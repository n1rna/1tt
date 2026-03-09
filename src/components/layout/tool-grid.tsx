"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tools, categoryLabels } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/registry";
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

function getIcon(name: string) {
  const Icon = (
    Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  )[name];
  return Icon || Icons.Wrench;
}

function SortableToolCard({
  tool,
  bookmarked,
  onToggleBookmark,
}: {
  tool: ToolDefinition;
  bookmarked: boolean;
  onToggleBookmark: (slug: string) => void;
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
        <Card
          className={`h-full hover:bg-accent/50 transition-colors cursor-pointer ${
            isDragging ? "shadow-lg" : ""
          }`}
        >
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline" className="text-xs">
                {categoryLabels[tool.category]}
              </Badge>
              {tool.requiresAuth && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <Icons.Lock className="h-2.5 w-2.5" />
                  Sign in
                </span>
              )}
            </div>
            <CardTitle className="text-lg">{tool.name}</CardTitle>
            <CardDescription>{tool.description}</CardDescription>
          </CardHeader>
        </Card>
      </Link>

      {/* Bookmark button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleBookmark(tool.slug);
        }}
        className={`absolute top-2.5 right-2.5 p-1.5 rounded-md transition-all ${
          bookmarked
            ? "text-amber-500 opacity-100"
            : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-500"
        }`}
        title={bookmarked ? "Remove bookmark" : "Bookmark"}
      >
        <Icons.Star
          className="h-4 w-4"
          fill={bookmarked ? "currentColor" : "none"}
        />
      </button>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute bottom-2.5 right-2.5 p-1.5 rounded-md text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-all"
        title="Drag to reorder"
      >
        <Icons.GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToolGrid() {
  const [mounted, setMounted] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    setBookmarks(new Set(loadBookmarks()));
    setOrder(loadToolOrder());
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const toggleBookmark = useCallback(
    (slug: string) => {
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
        saveBookmarks([...next]);
        // Dispatch event so launcher can pick it up
        window.dispatchEvent(new CustomEvent("bookmarks-changed"));
        return next;
      });
    },
    []
  );

  // Build ordered tool list
  const orderedTools = (() => {
    if (!mounted) return tools;

    const toolMap = new Map(tools.map((t) => [t.slug, t]));
    const result: ToolDefinition[] = [];

    // Add tools in saved order
    for (const slug of order) {
      const tool = toolMap.get(slug);
      if (tool) {
        result.push(tool);
        toolMap.delete(slug);
      }
    }

    // Add remaining tools not in saved order
    for (const tool of tools) {
      if (toolMap.has(tool.slug)) {
        result.push(tool);
      }
    }

    // Sort: bookmarked first, then rest in order
    const bookmarkedTools = result.filter((t) => bookmarks.has(t.slug));
    const unbookmarkedTools = result.filter((t) => !bookmarks.has(t.slug));
    return [...bookmarkedTools, ...unbookmarkedTools];
  })();

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = orderedTools.findIndex((t) => t.slug === active.id);
      const newIndex = orderedTools.findIndex((t) => t.slug === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...orderedTools.map((t) => t.slug)];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);
      setOrder(newOrder);
      saveToolOrder(newOrder);
    },
    [orderedTools]
  );

  if (!mounted) {
    // SSR / initial render — no reorder or bookmarks
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = getIcon(tool.icon);
          return (
            <Link key={tool.slug} href={`/tools/${tool.slug}`}>
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[tool.category]}
                    </Badge>
                    {tool.requiresAuth && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        <Icons.Lock className="h-2.5 w-2.5" />
                        Sign in
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg">{tool.name}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedTools.map((t) => t.slug)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderedTools.map((tool) => (
            <SortableToolCard
              key={tool.slug}
              tool={tool}
              bookmarked={bookmarks.has(tool.slug)}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
