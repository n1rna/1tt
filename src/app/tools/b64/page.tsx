import { ToolLayout } from "@/components/layout/tool-layout";
import { Base64Codec } from "@/components/tools/base64-codec";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "b64",
  title: "Base64 Encoder & Decoder",
  description:
    "Encode and decode Base64 strings online. Supports standard and URL-safe Base64 encoding. Convert text, data URIs, and binary data to and from Base64.",
  keywords: [
    "base64 encoder",
    "base64 decoder",
    "base64 encode online",
    "base64 decode online",
    "url safe base64",
    "data uri",
    "base64 converter",
    "text to base64",
    "base64 to text",
  ],
});

export default function Base64CodecPage() {
  const jsonLd = toolJsonLd("b64");
  return (
    <ToolLayout slug="b64">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <Base64Codec />
    </ToolLayout>
  );
}
