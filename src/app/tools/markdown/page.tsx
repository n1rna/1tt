import { MarkdownEditor } from "@/components/tools/markdown-editor";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "markdown",
  title: "Online Markdown Editor & Preview",
  description:
    "Write and preview Markdown online with live rendering, toolbar shortcuts, and syntax highlighting. Supports GitHub Flavored Markdown (GFM) with tables, task lists, and code blocks.",
  keywords: [
    "markdown editor",
    "markdown preview",
    "markdown online",
    "markdown viewer",
    "gfm editor",
    "github markdown",
    "markdown renderer",
    "markdown to html",
    "live markdown",
    "markdown writer",
  ],
});

export default function MarkdownPage() {
  const jsonLd = toolJsonLd("markdown");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <style>{`body { overflow: hidden; }`}</style>
      <MarkdownEditor />
    </>
  );
}
