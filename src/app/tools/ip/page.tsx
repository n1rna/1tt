import { headers } from "next/headers";
import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { IpTool, type IpInfo } from "@/components/tools/ip-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";
import { apiFetch } from "@/lib/api-fetch";

export const metadata = toolMetadata({
  slug: "ip",
  title: "What Is My IP Address - Geolocation & Network Info",
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

async function fetchIpData() {
  const hdrs = await headers();
  // cf-connecting-ip is the real client IP on Cloudflare; prefer it over x-forwarded-for
  const clientIp = hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for") || "";

  const forwardHeaders: Record<string, string> = {};
  if (clientIp) {
    forwardHeaders["x-forwarded-for"] = clientIp;
    forwardHeaders["x-real-ip"] = clientIp;
  }

  let ipv4: string | null = null;
  let ipv6: string | null = null;
  let info: IpInfo | null = null;
  let error: string | null = null;

  try {
    const [allRes, infoRes] = await Promise.all([
      apiFetch("/api/v1/ip/all", { headers: forwardHeaders }),
      apiFetch("/api/v1/ip/info", { headers: forwardHeaders }),
    ]);

    if (allRes.ok) {
      const data = await allRes.json();
      ipv4 = data.ipv4 || null;
      ipv6 = data.ipv6 || null;
      if (!ipv4 && !ipv6) {
        error = "Could not detect your IP address.";
      }
    } else {
      error = "Could not fetch IP information.";
    }

    if (infoRes.ok) {
      const infoJson = (await infoRes.json()) as IpInfo;
      if (infoJson.status !== "fail") {
        info = infoJson;
      }
    }
  } catch {
    error = "Could not fetch IP information.";
  }

  return { ipv4, ipv6, info, error };
}

export default async function IpPage() {
  const jsonLd = toolJsonLd("ip");
  const { ipv4, ipv6, info, error } = await fetchIpData();

  return (
    <ToolLayout slug="ip">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <IpTool ipv4={ipv4} ipv6={ipv6} info={info} error={error} />

      <ToolInfo>
        <ToolInfo.H2>What is an IP address?</ToolInfo.H2>
        <ToolInfo.P>
          An IP (Internet Protocol) address is a unique numerical identifier assigned to every device connected to a network. <ToolInfo.Code>IPv4</ToolInfo.Code> addresses use four octets (e.g., <ToolInfo.Code>192.168.1.1</ToolInfo.Code>), while <ToolInfo.Code>IPv6</ToolInfo.Code> addresses use a longer hexadecimal format. Your public IP address is how websites and services identify your connection.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          When you visit a website, your device sends requests from its public IP address, which is assigned by your Internet Service Provider (ISP). This tool queries a geolocation API to look up the location, ISP, and network details associated with your IP address.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Open the page to instantly see your <ToolInfo.Strong>public IP address</ToolInfo.Strong></li>
          <li>View <ToolInfo.Strong>geolocation data</ToolInfo.Strong> including city, region, country, and coordinates</li>
          <li>Check your <ToolInfo.Strong>ISP</ToolInfo.Strong> and network organization details</li>
          <li>Use <ToolInfo.Code>curl 1two.dev/ip</ToolInfo.Code> from a terminal to get your IP in plain text</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Checking your public IP when configuring firewalls or allowlists</li>
          <li>Verifying VPN or proxy connections are active</li>
          <li>Debugging network issues by confirming your visible IP address</li>
          <li>Quick IP lookup from the terminal with <ToolInfo.Code>curl</ToolInfo.Code></li>
        </ToolInfo.UL>
      </ToolInfo>
    </ToolLayout>
  );
}
