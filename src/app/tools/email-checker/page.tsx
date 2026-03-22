import { EmailChecker } from "@/components/tools/email-checker";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "email-checker",
  title: "Email Configuration Checker - SPF, DKIM, DMARC & Deliverability",
  description:
    "Check email DNS records and deliverability for any domain. Verify SPF, DKIM, DMARC, MX records, reverse DNS, MTA-STS, BIMI, and TLS-RPT. Get a deliverability score and actionable recommendations.",
  keywords: [
    "email checker",
    "spf check",
    "dkim check",
    "dmarc check",
    "mx record",
    "email deliverability",
    "email security",
    "dns email records",
    "spam check",
    "email configuration",
    "mta-sts",
    "bimi",
    "reverse dns",
    "ptr record",
  ],
});

export default function EmailCheckerPage() {
  const jsonLd = toolJsonLd("email-checker");
  return (
    <EmailChecker>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What does this tool check?</ToolInfo.H2>
          <ToolInfo.P>
            This tool performs a comprehensive audit of the DNS records that control email delivery and security for a domain. It checks eight key configurations and produces a deliverability score from 0 to 100.
          </ToolInfo.P>

          <ToolInfo.H2>Checks performed</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>MX Records</ToolInfo.Strong> — verifies that the domain has mail exchange servers configured and that they resolve to valid IP addresses. Multiple MX records provide redundancy.</li>
            <li><ToolInfo.Strong>SPF (Sender Policy Framework)</ToolInfo.Strong> — checks for a <ToolInfo.Code>v=spf1</ToolInfo.Code> TXT record that lists the servers authorised to send mail for your domain. Warns on overly permissive <ToolInfo.Code>+all</ToolInfo.Code> or missing <ToolInfo.Code>-all</ToolInfo.Code>/<ToolInfo.Code>~all</ToolInfo.Code>.</li>
            <li><ToolInfo.Strong>DKIM (DomainKeys Identified Mail)</ToolInfo.Strong> — probes common DKIM selectors to find published public keys. DKIM lets receiving servers verify the cryptographic signature attached to each message.</li>
            <li><ToolInfo.Strong>DMARC</ToolInfo.Strong> — looks up the <ToolInfo.Code>_dmarc</ToolInfo.Code> TXT record and parses the policy (<ToolInfo.Code>none</ToolInfo.Code>, <ToolInfo.Code>quarantine</ToolInfo.Code>, <ToolInfo.Code>reject</ToolInfo.Code>), reporting addresses, and subdomain policy.</li>
            <li><ToolInfo.Strong>Reverse DNS (PTR)</ToolInfo.Strong> — checks whether the IP addresses of your MX servers have PTR records. Missing PTR records are a common spam signal.</li>
            <li><ToolInfo.Strong>MTA-STS</ToolInfo.Strong> — verifies the <ToolInfo.Code>_mta-sts</ToolInfo.Code> DNS record and fetches the HTTPS policy file to confirm TLS enforcement mode.</li>
            <li><ToolInfo.Strong>BIMI</ToolInfo.Strong> — checks for a Brand Indicators for Message Identification record that lets you display a verified logo in supported mail clients.</li>
            <li><ToolInfo.Strong>TLS-RPT</ToolInfo.Strong> — looks for a <ToolInfo.Code>_smtp._tls</ToolInfo.Code> TXT record that enables TLS failure reporting from receiving servers.</li>
          </ToolInfo.UL>

          <ToolInfo.H2>How the score works</ToolInfo.H2>
          <ToolInfo.P>
            The deliverability score weights each check by its real-world impact on email delivery. MX records (25 points) and SPF (20 points) are weighted highest because without them email simply does not work. DMARC (20 points) is next because Gmail, Outlook, and other major providers now require it. DKIM (15 points) and reverse DNS (10 points) are important spam-filtering signals. MTA-STS, BIMI, and TLS-RPT are bonus points for defence-in-depth.
          </ToolInfo.P>

          <ToolInfo.H2>Common issues</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>No DMARC record</ToolInfo.Strong> — as of 2024, Gmail and Yahoo require at least <ToolInfo.Code>p=none</ToolInfo.Code> for bulk senders. Start with <ToolInfo.Code>p=none</ToolInfo.Code> and aggregate reports, then move to <ToolInfo.Code>quarantine</ToolInfo.Code> or <ToolInfo.Code>reject</ToolInfo.Code>.</li>
            <li><ToolInfo.Strong>SPF with +all</ToolInfo.Strong> — allows any server to send mail as your domain. Replace with <ToolInfo.Code>-all</ToolInfo.Code> (hard fail) or <ToolInfo.Code>~all</ToolInfo.Code> (soft fail).</li>
            <li><ToolInfo.Strong>Missing PTR records</ToolInfo.Strong> — contact your hosting provider to set up forward-confirmed reverse DNS (FCrDNS) for your mail server IPs.</li>
            <li><ToolInfo.Strong>DKIM not found</ToolInfo.Strong> — this tool checks common selectors. If you use a custom selector, the check may show a false negative. Verify with your email provider.</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </EmailChecker>
  );
}
