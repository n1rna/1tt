"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Github } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="z-50 w-full border-b bg-background/80 backdrop-blur-sm shrink-0">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Image
            src="/logo.svg"
            alt="1two.dev"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span>1two.dev</span>
        </Link>

        <button
          onClick={() => {
            document.dispatchEvent(new CustomEvent("open-tool-launcher"));
          }}
          className="ml-4 flex flex-1 max-w-sm items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search tools...</span>
          <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span className="text-xs">⌘</span>P
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/n1rna/1two"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
          >
            <Github className="h-4 w-4" />
          </a>
          <ThemeToggle />
          <Button variant="outline" size="sm" disabled>
            Sign in
          </Button>
        </div>
      </div>
    </header>
  );
}
