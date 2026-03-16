import { DocLayout } from "@/components/layout/doc-layout";
import type { Metadata } from "next";

const MARKDOWN = `
## Overview

The OG Image Builder lets you design Open Graph images directly in the browser — no Figma, no build step, no external service. Create images for social previews, save them as collections, and serve them from permanent URLs with optional dynamic text.

Logged-in users can publish collections and serve images at \`/og/s/{slug}/{variant}.png\`, with support for dynamic \`?title=\` and \`?subtitle=\` query parameters.

## Building an Image

### Layouts

Choose from 7 built-in layout templates:

- **Centered** — title and subtitle stacked in the center
- **Editorial** — left-aligned with a vertical accent line
- **Headline** — large bold title, compact subtitle
- **Cards** — content placed inside a card with rounded corners
- **Corners** — decorative corner elements with centered text
- **Minimal** — clean, whitespace-heavy layout
- **Custom** — position text elements freely on the canvas

### Sizes

6 preset sizes are available:

| Preset | Dimensions | Use case |
|--------|-----------|----------|
| Open Graph | 1200 x 630 | Facebook, LinkedIn, Discord |
| Twitter Card | 1200 x 628 | Twitter / X |
| Twitter Banner | 1500 x 500 | Twitter profile header |
| Instagram Square | 1080 x 1080 | Instagram posts |
| Pinterest | 1000 x 1500 | Pinterest pins |
| WhatsApp | 400 x 400 | WhatsApp link previews |

You can also add custom sizes with any width and height.

### Theming

Customize the look of your images:

- **Background** — solid color or gradient (5 directions: right, bottom, bottom-right, bottom-left, radial)
- **Text color** and **accent color**
- **Font family** — Inter, System UI, Georgia, Times New Roman, Courier New, Arial, Verdana, Trebuchet, Impact
- **Title / subtitle sizing** and font weight
- **Padding** and **border radius**

### Custom Elements

In the **Custom** layout, you can place text elements anywhere on the canvas. Each element supports:

- **Position** — X and Y as a 0–1 range (percentage of canvas)
- **Font size**, **weight**, **color**, **opacity**
- **Text alignment** — left, center, or right
- **Max width** — constrain text wrapping

## Exporting

Click **Export** to download images as PNG, JPEG (with quality slider), or WebP. All enabled sizes are exported at once.

## Collections

Collections let you save a set of OG image designs and serve them from permanent URLs. Requires a 1tt.dev account.

### Creating a Collection

1. Design your images in the builder
2. Click **Save as collection**
3. Give it a name and URL slug (e.g. \`my-blog\`)

The collection stores the full builder state: theme, all image variants, titles, and subtitles.

### Managing Collections

Open a saved collection from the collection picker in the toolbar. You can:

- **Edit** — modify designs and save changes
- **Rename** — change the collection name or slug
- **Delete** — permanently remove the collection and its published URLs

## Publishing and Serving Images

Publishing a collection makes its images available at permanent, publicly accessible URLs.

### How to Publish

1. Open a saved collection
2. Click **Publish** in the toolbar
3. Toggle publishing on

Once published, each enabled image variant gets a URL:

\`\`\`
https://1tt.dev/og/s/{collection-slug}/{variant-name}.png
\`\`\`

For example, a collection with slug \`my-blog\` and an enabled "Open Graph" variant is served at:

\`\`\`
https://1tt.dev/og/s/my-blog/open-graph.png
\`\`\`

### Dynamic Text

Published images support dynamic title and subtitle via query parameters:

\`\`\`
https://1tt.dev/og/s/my-blog/open-graph.png?title=Hello+World&subtitle=My+first+post
\`\`\`

This renders the image with the same theme and layout, but replaces the title and subtitle text. Useful for generating per-page social images without creating separate designs.

### Using in HTML

Add the published URL to your page's \`<head>\`:

\`\`\`html
<meta property="og:image" content="https://1tt.dev/og/s/my-blog/open-graph.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:image" content="https://1tt.dev/og/s/my-blog/twitter-card.png" />
<meta name="twitter:card" content="summary_large_image" />
\`\`\`

For dynamic text per page:

\`\`\`html
<meta property="og:image" content="https://1tt.dev/og/s/my-blog/open-graph.png?title=My+Page+Title" />
\`\`\`

### Caching

Published images are cached at the CDN layer:

- **Browser cache**: 1 hour
- **CDN cache**: 24 hours with stale-while-revalidate

Updating a collection's design and re-saving will reflect after the cache expires. Dynamic query parameter variants are cached independently.

## Cloud Sync

Enable Cloud Sync to keep your collections available across browsers and devices. Collections are stored server-side and linked to your account. The sync toggle is in the toolbar next to the tool name.

## OG Image Checker

Use the **OG Checker** tool to verify how your published images appear when shared. Paste any URL and it fetches the actual \`og:image\`, \`twitter:image\`, and other meta tags to show you exactly what social platforms will display.
`;

export const metadata: Metadata = {
  title: "OG Image Builder Documentation — 1tt.dev",
  description:
    "Learn how to design, publish, and serve Open Graph images from permanent URLs with dynamic text support using the OG Image Builder on 1tt.dev.",
};

export default function OgImagesDocsPage() {
  return (
    <DocLayout
      title="OG Image Builder"
      description="Design Open Graph images in the browser, save them as collections, and serve them from permanent URLs with dynamic text support."
      toolSlug="og"
      markdown={MARKDOWN}
    />
  );
}
