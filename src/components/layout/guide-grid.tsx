import Link from "next/link";
import * as icons from "lucide-react";
import { ArrowRight, BookOpen } from "lucide-react";
import { guides } from "@/lib/guides/registry";
import { docs } from "@/lib/docs/registry";
import { cn } from "@/lib/utils";

const GRID_SPANS = [
  "md:col-span-2",
  "md:col-span-1",
  "md:col-span-1",
  "md:col-span-1",
  "md:col-span-1",
  "md:col-span-2",
  "md:col-span-1",
  "md:col-span-1",
];

const ACCENT_COLORS = [
  "from-blue-500/10 to-violet-500/10 dark:from-blue-500/5 dark:to-violet-500/5",
  "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5",
  "from-violet-500/10 to-purple-500/10 dark:from-violet-500/5 dark:to-purple-500/5",
  "from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5",
  "from-rose-500/10 to-pink-500/10 dark:from-rose-500/5 dark:to-pink-500/5",
  "from-cyan-500/10 to-sky-500/10 dark:from-cyan-500/5 dark:to-sky-500/5",
  "from-indigo-500/10 to-blue-500/10 dark:from-indigo-500/5 dark:to-blue-500/5",
  "from-teal-500/10 to-emerald-500/10 dark:from-teal-500/5 dark:to-emerald-500/5",
];

export function GuideGrid() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Guides</h1>
        <p className="text-base text-muted-foreground max-w-lg">
          Deep dives into what you can do with 1tt.dev — features, workflows,
          and things you might not know about.
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {guides.map((guide, i) => {
          const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[
            guide.icon
          ];
          const span = GRID_SPANS[i % GRID_SPANS.length];
          const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];

          return (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className={cn(
                "group rounded-xl border border-border/50 bg-card overflow-hidden",
                "hover:shadow-lg hover:border-border/80 transition-all duration-200",
                "flex flex-col",
                span,
              )}
            >
              {/* Gradient header with icon */}
              <div className={cn(
                "px-5 pt-8 pb-6 bg-gradient-to-br relative",
                accent,
              )}>
                {Icon && (
                  <div className="rounded-xl bg-background/80 backdrop-blur-sm border border-border/40 p-3 w-fit shadow-sm">
                    <Icon className="h-6 w-6 text-foreground" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="px-5 py-4 flex-1 flex flex-col">
                <h2 className="text-sm font-semibold text-foreground mb-1.5 group-hover:underline underline-offset-2 decoration-foreground/30">
                  {guide.title}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {guide.description}
                </p>
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Read guide
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Tool Documentation */}
      {docs.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Tool Documentation</h2>
            <p className="text-sm text-muted-foreground mt-1">
              In-depth documentation for individual tools.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {docs.map((doc) => {
              const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[
                doc.icon
              ];
              return (
                <Link
                  key={doc.slug}
                  href={`/docs/${doc.slug}`}
                  className="group flex items-start gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 hover:border-border/80 hover:shadow-sm transition-all"
                >
                  <div className="rounded-lg bg-muted/50 p-2 shrink-0">
                    {Icon ? (
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium group-hover:underline underline-offset-2 decoration-foreground/30">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {doc.description}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
