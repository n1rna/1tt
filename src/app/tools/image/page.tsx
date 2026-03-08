import { ImageTool } from "@/components/tools/image-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "image",
  title: "Image Converter & Resizer — PNG, JPEG, WebP, AVIF",
  description:
    "Convert and resize images entirely in your browser. Supports PNG, JPEG, WebP, AVIF output with quality control, aspect-ratio locking, and fit or fill resize modes. No upload required.",
  keywords: [
    "image converter",
    "image resizer",
    "png to webp",
    "jpeg to png",
    "convert image",
    "resize image",
    "webp",
    "avif",
    "image compression",
    "canvas api",
    "browser image tool",
  ],
});

export default function ImagePage() {
  const jsonLd = toolJsonLd("image");
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ImageTool />
    </>
  );
}
