import { ToolInfo } from "@/components/layout/tool-info";
import { CorsDebugger } from "@/components/tools/cors-debugger";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "cors",
  title: "CORS Debugger",
  description:
    "Check CORS headers and debug cross-origin request issues. Inspect preflight and actual response headers with pass/fail analysis.",
  keywords: [
    "cors debugger",
    "cors checker",
    "cross-origin resource sharing",
    "access-control-allow-origin",
    "preflight request",
    "cors headers",
    "cors error",
    "cors test",
    "options request",
  ],
});

export default function CorsPage() {
  const jsonLd = toolJsonLd("cors");
  return (
    <CorsDebugger>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <ToolInfo>
        <ToolInfo.H2>What is CORS?</ToolInfo.H2>
        <ToolInfo.P>
          Cross-Origin Resource Sharing (CORS) is a browser security mechanism that controls how web pages can request resources from a different origin (domain, protocol, or port). Without CORS headers, browsers block cross-origin requests to protect users from malicious sites reading data from other domains.
        </ToolInfo.P>
        <ToolInfo.P>
          Servers opt in to cross-origin access by including <ToolInfo.Code>Access-Control-Allow-Origin</ToolInfo.Code> and related headers in their responses. For non-simple requests the browser sends an <ToolInfo.Code>OPTIONS</ToolInfo.Code> preflight request first to verify permission before making the actual request.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          When a browser makes a cross-origin request with a custom method or headers, it first sends a preflight <ToolInfo.Code>OPTIONS</ToolInfo.Code> request containing <ToolInfo.Code>Origin</ToolInfo.Code>, <ToolInfo.Code>Access-Control-Request-Method</ToolInfo.Code>, and <ToolInfo.Code>Access-Control-Request-Headers</ToolInfo.Code>. The server must respond with matching <ToolInfo.Code>Access-Control-Allow-*</ToolInfo.Code> headers. If the preflight passes, the browser proceeds with the actual request and checks the response headers again. This tool makes both requests server-side (bypassing browser restrictions) and reports what the browser would see.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Enter a <ToolInfo.Strong>target URL</ToolInfo.Strong> to check its CORS configuration</li>
          <li>Expand <ToolInfo.Strong>Advanced options</ToolInfo.Strong> to simulate requests from a specific origin or with a specific HTTP method</li>
          <li>Review the <ToolInfo.Strong>preflight (OPTIONS)</ToolInfo.Strong> and <ToolInfo.Strong>actual (GET)</ToolInfo.Strong> response headers separately</li>
          <li>Click any header row to expand a plain-English explanation and the raw header value</li>
          <li>The <ToolInfo.Strong>overall verdict</ToolInfo.Strong> summarises whether requests from the simulated origin would succeed</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Diagnosing <ToolInfo.Code>No 'Access-Control-Allow-Origin' header</ToolInfo.Code> browser errors when calling APIs</li>
          <li>Verifying that a REST API allows requests from a specific frontend domain</li>
          <li>Checking whether <ToolInfo.Code>Access-Control-Allow-Credentials: true</ToolInfo.Code> is correctly paired with a non-wildcard origin for cookie-based auth</li>
          <li>Confirming CDN or reverse proxy CORS configuration without needing a browser dev-tools session</li>
          <li>Testing that <ToolInfo.Code>Access-Control-Max-Age</ToolInfo.Code> is set to reduce unnecessary preflight overhead</li>
        </ToolInfo.UL>
      </ToolInfo>
    </CorsDebugger>
  );
}
