import { HashTool } from "@/components/tools/hash-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "hash",
  title: "Hash Generator — MD5, SHA-1, SHA-256, SHA-384, SHA-512",
  description:
    "Generate cryptographic hashes for text or files using MD5, SHA-1, SHA-256, SHA-384, and SHA-512. Compute all algorithms at once, copy results, and verify file integrity.",
  keywords: [
    "hash generator",
    "md5",
    "sha256",
    "sha512",
    "sha1",
    "sha384",
    "checksum",
    "file hash",
    "crypto hash",
    "digest",
    "integrity",
  ],
});

export default function HashPage() {
  const jsonLd = toolJsonLd("hash");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <HashTool />
    </>
  );
}
