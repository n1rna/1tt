import { ToolLayout } from "@/components/layout/tool-layout";
import { MarkdownTableGenerator } from "@/components/tools/markdown-table-generator";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "mdtable",
  title: "Markdown Table Generator",
  description:
    "Build markdown tables visually — add rows and columns, edit cells inline, paste CSV data, and generate clean aligned markdown output.",
  keywords: [
    "markdown table",
    "markdown table generator",
    "md table",
    "table to markdown",
    "csv to markdown",
    "github markdown table",
    "aligned markdown",
  ],
});

export default function MarkdownTablePage() {
  const jsonLd = toolJsonLd("mdtable");
  return (
    <ToolLayout slug="mdtable">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <MarkdownTableGenerator />
    </ToolLayout>
  );
}
