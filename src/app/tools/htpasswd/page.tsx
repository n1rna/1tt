import { HtpasswdTool } from "@/components/tools/htpasswd-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "htpasswd",
  title: "htpasswd Generator — bcrypt, SHA-256, SHA-512, MD5, SSHA",
  description:
    "Generate htpasswd password hashes for HTTP basic authentication. Supports bcrypt, SHA-256, SHA-512, MD5 (apr1), and SSHA with salt display and .htpasswd file download.",
  keywords: [
    "htpasswd",
    "basic auth",
    "password hash",
    "bcrypt",
    "sha256",
    "sha512",
    "md5",
    "ssha",
    "apache",
    "nginx",
    "http auth",
  ],
});

export default function HtpasswdPage() {
  const jsonLd = toolJsonLd("htpasswd");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <HtpasswdTool />
    </>
  );
}
