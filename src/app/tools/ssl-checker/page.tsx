import { ToolInfo } from "@/components/layout/tool-info";
import { SslChecker } from "@/components/tools/ssl-checker";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "ssl-checker",
  title: "SSL Certificate Checker",
  description:
    "Check SSL/TLS certificates for any domain - view the full certificate chain, expiry dates, protocol version, cipher suite, and security details.",
  keywords: [
    "ssl checker",
    "tls certificate",
    "ssl certificate",
    "https",
    "certificate expiry",
    "certificate chain",
    "x509",
    "security",
    "tls 1.3",
    "san",
    "subject alternative names",
  ],
});

export default function SslCheckerPage() {
  const jsonLd = toolJsonLd("ssl-checker");
  return (
    <SslChecker>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <ToolInfo>
        <ToolInfo.H2>What is SSL/TLS?</ToolInfo.H2>
        <ToolInfo.P>
          SSL (Secure Sockets Layer) and its successor TLS (Transport Layer Security) are cryptographic protocols that secure communications between clients and servers. When a website uses <ToolInfo.Code>https://</ToolInfo.Code>, the server presents an X.509 certificate to prove its identity and establish an encrypted channel. Certificates are issued by Certificate Authorities (CAs) and form a chain of trust from the leaf certificate up to a trusted root CA.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          During the TLS handshake, the server sends its certificate chain to the client. Each certificate in the chain is signed by the one above it, ending at a root CA that browsers and operating systems trust by default. This tool connects to the domain, completes the TLS handshake, and extracts the full certificate chain along with the negotiated protocol version (e.g. <ToolInfo.Code>TLS 1.3</ToolInfo.Code>) and cipher suite. Certificate validity is determined by comparing the <ToolInfo.Code>notBefore</ToolInfo.Code> and <ToolInfo.Code>notAfter</ToolInfo.Code> fields against the current time.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Enter a <ToolInfo.Strong>domain name</ToolInfo.Strong> (e.g. <ToolInfo.Code>example.com</ToolInfo.Code>) and click <ToolInfo.Strong>Check</ToolInfo.Strong></li>
          <li>View the <ToolInfo.Strong>connection info</ToolInfo.Strong> - TLS protocol version and cipher suite</li>
          <li>Inspect each certificate in the <ToolInfo.Strong>chain</ToolInfo.Strong> - subject, issuer, validity window, and SANs</li>
          <li>Check the <ToolInfo.Strong>validity indicator</ToolInfo.Strong> - green for valid, amber if expiring within 30 days, red if expired</li>
          <li>Copy the <ToolInfo.Strong>SHA-256 fingerprint</ToolInfo.Strong> with the copy button for certificate pinning or verification</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Checking certificate expiry before renewals - avoid downtime from expired certs</li>
          <li>Verifying that the correct certificate was deployed after an update or migration</li>
          <li>Confirming Subject Alternative Names (SANs) cover all required subdomains and domains</li>
          <li>Inspecting the certificate chain to debug <ToolInfo.Code>SSL_ERROR_RX_RECORD_TOO_LONG</ToolInfo.Code> or chain trust errors</li>
          <li>Checking the negotiated protocol to confirm <ToolInfo.Code>TLS 1.3</ToolInfo.Code> is in use and older versions are disabled</li>
        </ToolInfo.UL>
      </ToolInfo>
    </SslChecker>
  );
}
