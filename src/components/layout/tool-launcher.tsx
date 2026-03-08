"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import {
  getSearchItems,
  searchItems,
  categoryLabels,
} from "@/lib/tools/registry";
import type { SearchItem } from "@/lib/tools/registry";
import { Badge } from "@/components/ui/badge";

function getIcon(name: string) {
  const Icon = (
    Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  )[name];
  return Icon || Icons.Wrench;
}

export function ToolLauncher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const allItems = useMemo(() => getSearchItems(), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("open-tool-launcher", onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("open-tool-launcher", onOpen);
    };
  }, []);

  const results = useMemo(
    () => searchItems(query, allItems),
    [query, allItems]
  );

  function select(item: SearchItem) {
    setOpen(false);
    setQuery("");
    router.push(item.href);
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
      <CommandList>
        <CommandEmpty>No tools found.</CommandEmpty>
        {results.map((item) => {
          const Icon = getIcon(item.icon);
          return (
            <CommandItem
              key={item.id}
              value={item.id}
              onSelect={() => select(item)}
              keywords={[item.id]}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {item.parent ? (
                  <>
                    <span className="text-muted-foreground">
                      {item.parent} /{" "}
                    </span>
                    {item.name}
                  </>
                ) : (
                  item.name
                )}
              </span>
              <Badge
                variant="outline"
                className="ml-auto shrink-0 text-[10px] px-1.5 py-0 h-4 font-normal"
              >
                {categoryLabels[item.category]}
              </Badge>
            </CommandItem>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
