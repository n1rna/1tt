import type { GuideDefinition } from "./types";

export const guides: GuideDefinition[] = [
  {
    slug: "serve-og-images",
    title: "Serve OG Images from 1tt.dev",
    description:
      "Design Open Graph images in the browser and serve them directly from a permanent URL — no hosting or build step required.",
    icon: "Image",
    relatedTools: ["og", "og-checker"],
    keywords: [
      "og image",
      "open graph",
      "social preview",
      "meta image",
      "twitter card",
      "og hosting",
      "dynamic og",
    ],
  },
  {
    slug: "browser-databases",
    title: "Explore Databases in the Browser",
    description:
      "Open SQLite files, connect to Postgres databases, and browse Elasticsearch clusters — all from a single browser tab.",
    icon: "Database",
    relatedTools: ["sqlite", "elasticsearch"],
    keywords: [
      "sqlite browser",
      "database explorer",
      "sql editor",
      "elasticsearch client",
      "postgres gui",
      "browser database",
    ],
  },
  {
    slug: "cloud-sync",
    title: "Cloud Sync Across Devices",
    description:
      "Keep your tool state, saved connections, and preferences in sync across browsers and devices with one-click cloud sync.",
    icon: "RefreshCw",
    relatedTools: ["elasticsearch", "og", "color", "invoice"],
    keywords: [
      "cloud sync",
      "sync state",
      "cross device",
      "backup",
      "localStorage sync",
      "developer tools sync",
    ],
  },
  {
    slug: "config-generators",
    title: "Generate Config Files Instantly",
    description:
      "Interactive config generators for TypeScript, ESLint, Prettier, Docker, nginx, and more — pick options and copy the result.",
    icon: "FileCode",
    relatedTools: ["config"],
    keywords: [
      "config generator",
      "tsconfig",
      "eslint config",
      "prettier config",
      "dockerfile generator",
      "nginx config",
      "gitignore",
    ],
  },
  {
    slug: "minimal-calendar",
    title: "A Calendar for Quick Planning",
    description:
      "A minimal, distraction-free calendar for when you need to plan something fast without opening your personal calendar.",
    icon: "CalendarDays",
    relatedTools: ["calendar"],
    keywords: [
      "calendar",
      "minimal calendar",
      "quick planning",
      "milestone",
      "timeline",
      "date range",
      "project planning",
    ],
  },
  {
    slug: "postgresql-studio",
    title: "PostgreSQL Database Studio",
    description:
      "Connect to any PostgreSQL database from the browser — browse schemas, run SQL queries, and inspect tables without installing a desktop client.",
    icon: "Server",
    relatedTools: ["elasticsearch", "sqlite"],
    keywords: [
      "postgresql",
      "postgres",
      "database studio",
      "sql editor",
      "pg admin",
      "database gui",
      "schema browser",
      "postgres client",
    ],
  },
  {
    slug: "sqlite-browser",
    title: "SQLite in the Browser with Turso & libSQL",
    description:
      "Open SQLite databases entirely client-side with WebAssembly — plus how Turso and libSQL are extending SQLite for edge and multi-tenant workloads.",
    icon: "HardDrive",
    relatedTools: ["sqlite"],
    keywords: [
      "sqlite",
      "turso",
      "libsql",
      "sqlite wasm",
      "sql.js",
      "embedded database",
      "edge database",
      "sqlite browser",
    ],
  },
  {
    slug: "llms-txt-generator",
    title: "Generate llms.txt for Any Website",
    description:
      "Crawl any site and generate an llms.txt file that gives LLMs the context they need — ideal for RAG pipelines, AI assistants, and documentation.",
    icon: "Bot",
    relatedTools: ["llms-txt"],
    keywords: [
      "llms.txt",
      "llms",
      "ai context",
      "rag",
      "documentation",
      "crawl",
      "sitemap",
      "ai documentation",
      "context window",
    ],
  },
  {
    slug: "redis-studio",
    title: "Hosted Redis with Upstash",
    description:
      "Create hosted Redis databases in seconds and manage them from the browser — browse keys, inspect values, set TTLs, and run commands.",
    icon: "Database",
    relatedTools: ["elasticsearch", "sqlite"],
    keywords: [
      "redis",
      "upstash",
      "redis gui",
      "redis browser",
      "key value store",
      "redis studio",
      "hosted redis",
      "redis client",
      "redis commands",
    ],
  },
  {
    slug: "csv-viewer",
    title: "CSV Viewer with Dataset Splitting",
    description:
      "Open, filter, sort, and edit CSV files in the browser — then split them into train/test sets for machine learning with one click.",
    icon: "FileSpreadsheet",
    relatedTools: ["csv"],
    keywords: [
      "csv viewer",
      "csv editor",
      "csv splitter",
      "train test split",
      "dataset split",
      "csv filter",
      "csv sort",
      "csv export",
      "machine learning data",
      "data preparation",
    ],
  },
];

export function getGuideBySlug(slug: string): GuideDefinition | undefined {
  return guides.find((g) => g.slug === slug);
}
