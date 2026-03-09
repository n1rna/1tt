import { DiffViewer } from "@/components/tools/diff-viewer";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "diff",
  title: "Diff & Compare Tool",
  description:
    "Compare two or more texts side by side with line-by-line diff highlighting. Find differences between code, configs, or any text instantly online.",
  keywords: [
    "diff tool",
    "text diff",
    "compare text",
    "side by side diff",
    "diff checker",
    "code compare",
    "text comparison",
    "diff online",
    "file diff",
    "find differences",
  ],
});

export default function DiffPage() {
  const jsonLd = toolJsonLd("diff");
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
      <DiffViewer />
    </>
  );
}
