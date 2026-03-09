import { LogoGenerator } from "@/components/tools/logo-generator";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "logo",
  title: "Logo Generator — Minimal Text Logos, SVG, PNG, Favicon",
  description:
    "Create minimal text-based logos with customizable fonts, colors, and spacing. Export as SVG, PNG in any size, or favicon ICO.",
  keywords: [
    "logo generator",
    "text logo",
    "minimal logo",
    "favicon",
    "svg",
    "png",
    "brand",
    "typography",
    "icon generator",
  ],
});

export default function LogoPage() {
  const jsonLd = toolJsonLd("logo");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <LogoGenerator />
    </>
  );
}
