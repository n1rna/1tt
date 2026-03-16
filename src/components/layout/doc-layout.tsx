"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import * as icons from "lucide-react";
import { getToolBySlug } from "@/lib/tools/registry";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface DocPage {
  slug: string;
  title: string;
  active?: boolean;
}

export interface DocLayoutProps {
  title: string;
  description?: string;
  /** Slug of an existing tool to link to */
  toolSlug?: string;
  /** Raw markdown content */
  markdown: string;
  /** Other pages in the same doc group */
  pages?: DocPage[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({ id: slugify(text), text, level });
    }
  }
  return headings;
}

// ---------------------------------------------------------------------------
// Scroll-spy hook
// ---------------------------------------------------------------------------

function useScrollSpy(headingIds: string[]): string {
  const [activeId, setActiveId] = useState<string>("");

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setActiveId(entry.target.id);
      }
    }
  }, []);

  useEffect(() => {
    if (headingIds.length === 0) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "-80px 0px -70% 0px",
    });

    for (const id of headingIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headingIds, handleIntersect]);

  return activeId;
}

// ---------------------------------------------------------------------------
// Markdown components
// ---------------------------------------------------------------------------

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-foreground mt-0 mb-4 scroll-mt-20">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const text = String(children);
    const id = slugify(text);
    return (
      <h2
        id={id}
        className="text-lg font-semibold text-foreground mt-8 mb-3 scroll-mt-20"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }) => {
    const text = String(children);
    const id = slugify(text);
    return (
      <h3
        id={id}
        className="text-base font-semibold text-foreground mt-6 mb-2 scroll-mt-20"
      >
        {children}
      </h3>
    );
  },
  p: ({ children }) => (
    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1.5 mb-4 text-sm text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1.5 mb-4 text-sm text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children, className }) => {
    // Block code (has a language class)
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="block bg-muted/50 rounded-lg p-4 text-xs text-foreground overflow-x-auto font-mono leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted text-foreground px-1 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto mb-4 text-xs font-mono leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-4 italic text-sm text-muted-foreground mb-4">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary hover:underline underline-offset-2 inline-flex items-center gap-0.5"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
      {href?.startsWith("http") && (
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
      )}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-border my-6" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
  th: ({ children }) => (
    <th className="text-left text-xs font-semibold text-foreground px-3 py-2 bg-muted/40">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-xs text-muted-foreground">{children}</td>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} className="rounded-lg max-w-full my-4" />
  ),
};

// ---------------------------------------------------------------------------
// Sidebar TOC
// ---------------------------------------------------------------------------

interface SidebarTocProps {
  headings: Heading[];
  activeId: string;
  pages?: DocPage[];
}

function SidebarToc({ headings, activeId, pages }: SidebarTocProps) {
  return (
    <aside className="w-56 shrink-0">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-6">
        {/* Page navigation */}
        {pages && pages.length > 0 && (
          <nav>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
              Pages
            </p>
            <ul className="space-y-0.5">
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`}
                    className={cn(
                      "block text-xs py-1 px-2 rounded transition-colors",
                      page.active
                        ? "text-foreground font-medium bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* TOC */}
        {headings.length > 0 && (
          <nav>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
              On this page
            </p>
            <ul className="space-y-0.5">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={cn(
                      "block text-xs py-1 transition-colors border-l-2",
                      h.level === 3 ? "pl-5" : "pl-3",
                      activeId === h.id
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile TOC (shown at top on small screens)
// ---------------------------------------------------------------------------

interface MobileTocProps {
  headings: Heading[];
  activeId: string;
}

function MobileToc({ headings, activeId }: MobileTocProps) {
  const [open, setOpen] = useState(false);

  if (headings.length === 0) return null;

  const active = headings.find((h) => h.id === activeId);

  return (
    <div className="lg:hidden mb-6 border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <span className="font-medium text-foreground text-xs">
          {active ? active.text : "On this page"}
        </span>
        <span className="text-xs opacity-60">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="border-t divide-y divide-border/50">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={cn(
                  "block px-4 py-2 text-xs transition-colors",
                  h.level === 3 ? "pl-8" : "pl-4",
                  activeId === h.id
                    ? "text-primary font-medium bg-accent/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
                onClick={() => setOpen(false)}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Related tool card
// ---------------------------------------------------------------------------

function RelatedToolCard({ slug }: { slug: string }) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;
  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[tool.icon];
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
    >
      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tool.name}</p>
        <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main DocLayout
// ---------------------------------------------------------------------------

export function DocLayout({
  title,
  description,
  toolSlug,
  markdown,
  pages,
}: DocLayoutProps) {
  const headings = extractHeadings(markdown);
  const headingIds = headings.map((h) => h.id);
  const activeId = useScrollSpy(headingIds);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Back link */}
      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-3 w-3" />
        Guides
      </Link>

      {/* Page header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                {description}
              </p>
            )}
          </div>
          {toolSlug && (
            <Link
              href={`/tools/${toolSlug}`}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Open tool
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </header>

      {/* Mobile TOC */}
      <MobileToc headings={headings} activeId={activeId} />

      {/* Body: sidebar + content */}
      <div className="flex gap-10 items-start">
        {/* Sidebar — hidden on mobile */}
        <div className="hidden lg:block">
          <SidebarToc headings={headings} activeId={activeId} pages={pages} />
        </div>

        {/* Main markdown content */}
        <article className="min-w-0 flex-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {markdown}
          </ReactMarkdown>
        </article>
      </div>

      {/* Related tool footer */}
      {toolSlug && (
        <footer className="mt-14 pt-8 border-t">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-4">
            Related tool
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 max-w-sm">
            <RelatedToolCard slug={toolSlug} />
          </div>
        </footer>
      )}
    </div>
  );
}
