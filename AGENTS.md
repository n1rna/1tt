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
- **Static export** — `output: "export"` in next.config.ts, deployed to Cloudflare Pages
- **SEO** — use `toolMetadata()` + `toolJsonLd()` from `src/lib/tools/seo.ts` for all tool pages
