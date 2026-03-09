import { ToolLayout } from "@/components/layout/tool-layout";
import { IpTool } from "@/components/tools/ip-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "ip",
  title: "What Is My IP Address — Geolocation & Network Info",
  description:
    "View your public IP address, geolocation, ISP, and network details. Also available via curl 1two.dev/ip from your terminal.",
  keywords: [
    "ip address",
    "what is my ip",
    "my ip",
    "ip lookup",
    "geolocation",
    "ip location",
    "isp",
    "network info",
    "curl ip",
  ],
});

export default function IpPage() {
  const jsonLd = toolJsonLd("ip");
  return (
    <ToolLayout slug="ip">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <IpTool />
    </ToolLayout>
  );
}
