import { ToolGrid } from "@/components/layout/tool-grid";
import { homepageJsonLd } from "@/lib/tools/seo";

export default function Home() {
  const jsonLdItems = homepageJsonLd();
  return (
    <>
      {jsonLdItems.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <div className="p-6 max-w-6xl mx-auto">
        <ToolGrid />
      </div>
    </>
  );
}
