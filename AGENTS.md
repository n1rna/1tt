# 1two.dev — Developer Tools Platform

A collection of browser-based developer tools built with Next.js. Each tool is self-contained, fast, and works entirely client-side.

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript 5** (strict mode)
- **Tailwind CSS v4** (PostCSS plugin, `@plugin` directive for extensions)
- **shadcn/ui** (base-nova style, built on `@base-ui/react` — NOT Radix)
- **lucide-react** for icons
- **Bun** as the package manager and script runner (not npm/yarn/pnpm)
- **Playwright** for e2e tests, **Vitest** for unit tests
- **next-themes** for dark/light mode (dark by default)

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, theme, header, command palette)
│   ├── globals.css             # Tailwind v4 config, CSS variables (oklch), custom utilities
│   └── tools/
│       └── [slug]/page.tsx     # One page per tool
├── components/
│   ├── layout/                 # Header, ToolLauncher (⌘P), ToolLayout, ThemeProvider
│   ├── tools/                  # Tool components (one file per tool)
│   └── ui/                     # shadcn/ui primitives (Button, Card, Select, etc.)
├── lib/
│   ├── tools/
│   │   ├── types.ts            # ToolDefinition interface, ToolCategory type
│   │   ├── registry.ts         # Tool list, search, category grouping
│   │   └── [name].ts           # Pure utility functions per tool
│   └── utils.ts                # cn() helper
└── hooks/
e2e/                            # Playwright e2e tests (one spec per tool)
```

## How to Add a New Tool

### 1. Register the tool

Add an entry to `src/lib/tools/registry.ts`:

```ts
{
  slug: "my-tool",
  name: "My Tool",
  description: "Short description for the command palette",
  category: "text",         // see ToolCategory in types.ts
  icon: "Wrench",           // any lucide-react icon name
  keywords: ["search", "terms", "for", "command", "palette"],
},
```

Available categories: `encoding`, `formatting`, `parsing`, `conversion`, `generators`, `crypto`, `text`, `web`, `data`.

### 2. Create the page

Create `src/app/tools/my-tool/page.tsx`:

**For full-screen tools** (split-pane editors like JSON, Diff, Markdown):

```tsx
import { MyTool } from "@/components/tools/my-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "my-tool",
  title: "My Tool — Keyword-Rich Title",
  description: "Keyword-rich description (150+ chars) targeting search queries users would type.",
  keywords: ["my tool", "related term", "search phrase"],
});

export default function MyToolPage() {
  const jsonLd = toolJsonLd("my-tool");
  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <style>{`body { overflow: hidden; }`}</style>
      <MyTool />
    </>
  );
}
```

**For standard layout tools** (cards, forms — like JWT, Base64):

```tsx
import { ToolLayout } from "@/components/layout/tool-layout";
import { MyTool } from "@/components/tools/my-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "my-tool",
  title: "My Tool — Keyword-Rich Title",
  description: "Keyword-rich description (150+ chars) targeting search queries users would type.",
  keywords: ["my tool", "related term", "search phrase"],
});

export default function MyToolPage() {
  const jsonLd = toolJsonLd("my-tool");
  return (
    <ToolLayout slug="my-tool">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <MyTool />
    </ToolLayout>
  );
}
```

### 3. Create the component

Create `src/components/tools/my-tool.tsx`:

```tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, ClipboardPaste } from "lucide-react";

export function MyTool() {
  const [input, setInput] = useState("");
  // ... tool logic
}
```

**Conventions:**
- Always `"use client"` at the top
- One exported function component per file
- Use shadcn/ui `Button`, `Card`, etc. for UI elements
- Use lucide-react icons (import individually, not `* as Icons`)
- Common action patterns: Paste (`ClipboardPaste`), Copy (`Copy` → `Check`), Clear (`X`)
- Use `onMouseDown={e => e.preventDefault()}` on toolbar buttons to prevent stealing focus from editors
- Use `useCallback` for handlers passed to child components

### 4. Create utility functions (if needed)

Create `src/lib/tools/my-tool.ts` for pure logic:

```ts
export interface MyResult {
  valid: boolean;
  output: string;
  error?: string;
}

export function processInput(input: string): MyResult {
  // Pure function, no React dependencies
}
```

### 5. Write tests

**E2e test** — `e2e/my-tool.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("My Tool", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/my-tool");
  });

  test("shows toolbar", async ({ page }) => {
    await expect(page.getByText("My Tool")).toBeVisible();
  });

  test("processes input", async ({ page }) => {
    await page.locator("textarea").fill("test input");
    await expect(page.getByText("expected output")).toBeVisible({ timeout: 5000 });
  });
});
```

**Unit test** — `src/lib/tools/__tests__/my-tool.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { processInput } from "../my-tool";

describe("processInput", () => {
  it("handles valid input", () => {
    expect(processInput("test")).toEqual({ valid: true, output: "result" });
  });
});
```

### 6. Run tests

```bash
bunx playwright test e2e/my-tool.spec.ts   # e2e tests
bunx vitest run src/lib/tools/__tests__/    # unit tests
```

## Split-Pane Editor Pattern

Full-screen tools (JSON, Diff, Markdown) share a common layout:

```tsx
<div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] overflow-hidden">
  {/* Top toolbar */}
  <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm font-semibold">Tool Name</span>
    {/* Status indicators, action buttons */}
  </div>

  {/* Split panes */}
  <div className="flex flex-1 min-h-0">
    {/* Left pane */}
    <div className="flex flex-col min-w-0" style={{ width: `${widths[0]}%` }}>
      <div className="flex items-center px-3 h-8 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground">Editor</span>
        {/* Pane actions */}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Content */}
      </div>
    </div>

    {/* Resize handle */}
    <ResizeHandle index={0} onResize={handleResize} />

    {/* Right pane */}
    <div className="flex flex-col min-w-0" style={{ width: `${widths[1]}%` }}>
      <div className="flex items-center px-3 h-8 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground">Preview</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {/* Content */}
      </div>
    </div>
  </div>
</div>
```

The resize handle tracks mouse deltas and updates a `widths` state array (percentages). Each pane has a min width of 15%.

## Line Number Editor Pattern

For editors with line numbers that support word wrapping, use a CSS grid mirror:

```tsx
<div className="relative flex-1 min-h-0 overflow-auto">
  <div className="relative min-h-full">
    {/* Grid: line numbers + invisible mirror text (determines row heights) */}
    <div className="grid" style={{ gridTemplateColumns: "2.5rem 1fr" }} aria-hidden>
      {lines.map((line, i) => (
        <Fragment key={i}>
          <div className="text-right pr-2 text-xs leading-6 select-none border-r border-border/50 text-muted-foreground/40">
            {i + 1}
          </div>
          <div className="pl-2 pr-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words text-transparent min-w-0">
            {line || "\u200b"}
          </div>
        </Fragment>
      ))}
    </div>
    {/* Textarea overlay — same font/padding so text aligns with mirror */}
    <textarea className="absolute inset-0 w-full h-full ... pl-12 pr-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words" />
  </div>
</div>
```

The invisible mirror text wraps identically to the textarea, so each grid row's height matches the actual wrapped line height. Line numbers stay aligned at the top of each row.

## Config Generator App Definitions

The Config Generator tool (`/tools/config`) lets users generate config files for popular tools via a two-pane UI. Each supported app is a single TypeScript file in `src/lib/tools/config-generator/apps/`.

**Full guide:** `src/lib/tools/config-generator/GUIDE.md` — contains the type reference, step-by-step instructions, complete examples for JSON/nested JSON/custom formats/text formats, conventions, and a checklist.

To add a new app: read the guide, create the app definition file, and register it in `apps/index.ts`.

## Key Conventions

- **No emojis** in code or UI unless user requests them
- **oklch** color space for all theme colors (CSS variables in globals.css)
- **Dark theme first** — designed for dark mode, light mode supported
- **Client-side only** — all tool logic runs in the browser, no server API calls
- **Debounced processing** for large inputs (50ms small, 200ms medium, 400ms large)
- **`hide-scrollbar`** utility class available for hiding native scrollbars
- **Tailwind v4** — uses `@plugin`, `@theme inline`, `@custom-variant` directives (not v3 `tailwind.config.js`)
- **shadcn/ui uses @base-ui/react**, not Radix — component APIs may differ from standard shadcn docs
- **No `--no-verify`** on git commits — always let hooks run
- **Keep it simple** — avoid over-engineering, no premature abstractions
- **Use `bun`** for all package management and script running — never npm/yarn/pnpm
- **Cloudflare Workers** — deployed via OpenNext adapter (`@opennextjs/cloudflare`), not static export
- **SEO** — use `toolMetadata()` + `toolJsonLd()` from `src/lib/tools/seo.ts` for all tool pages

## Deployment Architecture

### Overview

The app deploys to Cloudflare with two services:

1. **Web (Next.js)** → Cloudflare Workers via `@opennextjs/cloudflare`
2. **API (Go backend)** → Cloudflare Containers (Docker on Durable Objects)

The web worker communicates with the API container via **Service Bindings** (internal, no public URL needed).

### Config Files

- `wrangler.jsonc` — Web worker config (name: `1two-web`, KV for cache, service binding to `onetwo-api`)
- `open-next.config.ts` — OpenNext adapter config
- `workers/api-container/wrangler.toml` — Container worker config (name: `onetwo-api`)
- `workers/api-container/src/index.ts` — Container entrypoint (proxies requests to Go container)
- `api/Dockerfile` — Go backend Docker image

### Build & Deploy Commands

```bash
bun run cf:build        # Build Next.js for Cloudflare Workers
bun run cf:deploy       # Deploy web worker (build + wrangler deploy)
bun run cf:deploy-api   # Deploy API container
just deploy             # Deploy both web and API
```

### GitHub Actions (`.github/workflows/deploy.yml`)

Triggers on push to `main` or manual `workflow_dispatch`. Three jobs:

1. **changes** — Uses `dorny/paths-filter` to detect which services changed
2. **deploy-web** — Builds and deploys Next.js (skipped if no web changes)
3. **deploy-api** — Builds and deploys Go container (skipped if no API changes)

`workflow_dispatch` always deploys both services regardless of changes.

### Service Binding (Web → API)

The web app uses `src/lib/api-fetch.ts` to call the Go backend:
- **On Cloudflare**: Uses the `API_BACKEND` service binding (internal, fast)
- **Locally**: Falls back to `API_BACKEND_URL` env var (default `http://localhost:8080`)

All API proxy routes (`src/app/api/proxy/[...path]/route.ts`, `src/app/ip/route.ts`) use `apiFetch()`.

## Secret Management

Secrets exist in **three locations**, each serving a different purpose:

### 1. Local Development — `.env.*.production` files

- `.env.web.production` — Web app env vars (gitignored)
- Managed with `ee` CLI tool
- Schema defined in `.ee.web` (lists all variable names)

### 2. Build-Time — GitHub Secrets

Used during GitHub Actions CI/CD to inject env vars at build time.

- **`ENV_VARS_WEB`** — Contains all web env vars in ee-encrypted format
- **`CLOUDFLARE_API_TOKEN`** — Wrangler deploy auth
- **`CLOUDFLARE_ACCOUNT_ID`** — Cloudflare account identifier

The `n1rna/ee-action` GitHub Action decrypts `ENV_VARS_WEB` and writes `.env.web.production`, which is then sourced before `bun run cf:build`.

### 3. Runtime — Cloudflare Worker Secrets

Set via `wrangler secret put <NAME>` (or `just cf-secret-web` / `just cf-secret-api`).

**Web worker secrets** (set with `--name 1two-web`):
- `DATABASE_URL` — Neon Postgres connection string
- `BETTER_AUTH_SECRET` — Auth session signing key
- `BETTER_AUTH_URL` — Auth callback base URL
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — OAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Cloudflare Turnstile

**API container secrets** (set with `--name onetwo-api`):
- `DATABASE_URL` — Neon Postgres connection string
- `ALLOWED_ORIGINS` — CORS allowed origins
- `TURNSTILE_SECRET_KEY` — Turnstile verification

Container env vars are passed to the Docker container via the `envVars` getter in `workers/api-container/src/index.ts`.

### Adding or Updating a Secret

To add/update a secret across all three locations:

```bash
# 1. Update local file
ee set .ee.web MY_NEW_VAR "the-value"

# 2. Update GitHub secret (re-export all vars)
ee export .ee.web | gh secret set ENV_VARS_WEB

# 3. Update Cloudflare runtime secret
echo "the-value" | wrangler secret put MY_NEW_VAR --name 1two-web
# or for API:
echo "the-value" | wrangler secret put MY_NEW_VAR --name onetwo-api
```

### ee Configuration

- **`.ee.web`** — Schema file listing all web env var names
- **`ee set <config> <key> <value>`** — Set a value locally
- **`ee export <config>`** — Export all vars (for piping to `gh secret set`)
- **`n1rna/ee-action`** — GitHub Action that hydrates env files from GitHub secrets

### Important Notes

- `pg` module does NOT work on Cloudflare Workers (no TCP sockets). Use `@neondatabase/serverless` instead (WebSocket-based, drop-in `Pool` replacement).
- Real client IP on Cloudflare is in `cf-connecting-ip` header, NOT `x-forwarded-for`.
- Container cold starts take ~15s. The worker calls `startAndWaitForPorts()` before proxying.
- Go backend should handle DB failures gracefully (warn, don't crash) since the container restarts are expensive.
- Build-time env vars (like `NEXT_PUBLIC_*`) must be available when `cf:build` runs — they get baked into the JS bundle.
- Runtime secrets are accessed via `process.env` in server-side code or `ctx.env` in Cloudflare Workers.
