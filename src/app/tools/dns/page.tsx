import { ToolLayout } from "@/components/layout/tool-layout";
import { DnsTool } from "@/components/tools/dns-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "dns",
  title: "DNS Lookup",
  description:
    "Look up DNS records for any domain — A, AAAA, MX, CNAME, TXT, NS, SOA, SRV, CAA, and PTR.",
  keywords: [
    "dns lookup",
    "dns records",
    "domain lookup",
    "mx records",
    "nameserver lookup",
    "nslookup",
    "dig online",
    "txt records",
    "cname lookup",
  ],
});

export default function DnsPage() {
  const jsonLd = toolJsonLd("dns");
  return (
    <ToolLayout slug="dns">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <DnsTool />
    </ToolLayout>
  );
}
