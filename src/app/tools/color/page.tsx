import { ColorTool } from "@/components/tools/color-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "color",
  title: "Color Palette Builder & Theme Generator",
  description:
    "Build color palettes and themes with CSS variable tokens. Generate themes from presets, preview on a live dashboard, and export CSS custom properties. Supports HEX, RGB, HSL, and OKLCH.",
  keywords: [
    "color palette generator",
    "theme builder",
    "css color variables",
    "color picker",
    "hex to rgb",
    "hsl color",
    "oklch",
    "css custom properties",
    "color theme",
    "dark mode theme",
    "color converter",
  ],
});

export default function ColorToolPage() {
  const jsonLd = toolJsonLd("color");
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
      <ColorTool />
    </>
  );
}
