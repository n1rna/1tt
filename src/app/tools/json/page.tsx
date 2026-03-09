import { JsonBeautifier } from "@/components/tools/json-beautifier";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "json",
  title: "JSON Formatter & Validator",
  description:
    "Format, validate, minify, and explore JSON online. Auto-corrects common errors, interactive tree viewer, and syntax highlighting. Paste or type JSON to get started.",
  keywords: [
    "json formatter",
    "json validator",
    "json beautifier",
    "json minifier",
    "json viewer",
    "json tree",
    "json parser",
    "format json online",
    "pretty print json",
    "json lint",
  ],
});

export default function JsonPage() {
  const jsonLd = toolJsonLd("json");
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
      <JsonBeautifier />
    </>
  );
}
