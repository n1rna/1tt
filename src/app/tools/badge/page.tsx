import { BadgeGenerator } from "@/components/tools/badge-generator";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "badge",
  title: "Badge Generator - shields.io-style SVG Badges",
  description:
    "Generate shields.io-style SVG badges for README files, GitHub repos, and documentation. Choose from flat, plastic, for-the-badge, and social styles. Copy Markdown, HTML, or reStructuredText snippets instantly.",
  keywords: [
    "badge generator",
    "shields.io",
    "svg badge",
    "readme badge",
    "github badge",
    "flat badge",
    "status badge",
    "coverage badge",
    "build badge",
    "custom badge",
    "markdown badge",
  ],
});

export default function BadgePage() {
  const jsonLd = toolJsonLd("badge");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <BadgeGenerator />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is a status badge?</ToolInfo.H2>
          <ToolInfo.P>
            A status badge is a small SVG image that communicates a key metric or property of a project at a glance — build status, test coverage, license type, version number, and more. They are widely used in README files on GitHub, GitLab, and Bitbucket, and in project documentation. The de-facto standard format was popularised by <ToolInfo.Code>shields.io</ToolInfo.Code>.
          </ToolInfo.P>

          <ToolInfo.H2>How it works</ToolInfo.H2>
          <ToolInfo.P>
            Badge URLs encode the badge content directly in the path:
            <ToolInfo.Code>/badge/{"{label}"}-{"{message}"}-{"{color}"}.svg</ToolInfo.Code>.
            Spaces are written as <ToolInfo.Code>_</ToolInfo.Code>, literal underscores as <ToolInfo.Code>__</ToolInfo.Code>, and literal dashes as <ToolInfo.Code>--</ToolInfo.Code>. The server renders the SVG on each request using precise character-width measurements for Verdana 11px, and responds with aggressive cache headers so badges load instantly from CDN edges.
          </ToolInfo.P>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Type a <ToolInfo.Strong>label</ToolInfo.Strong> (left segment) and <ToolInfo.Strong>message</ToolInfo.Strong> (right segment) — the label can be left empty for a single-segment badge</li>
            <li>Pick a <ToolInfo.Strong>style</ToolInfo.Strong>: <ToolInfo.Code>flat</ToolInfo.Code>, <ToolInfo.Code>flat-square</ToolInfo.Code>, <ToolInfo.Code>plastic</ToolInfo.Code>, <ToolInfo.Code>for-the-badge</ToolInfo.Code>, or <ToolInfo.Code>social</ToolInfo.Code></li>
            <li>Choose a <ToolInfo.Strong>message color</ToolInfo.Strong> from the swatches or type a named color / bare hex value like <ToolInfo.Code>4c1</ToolInfo.Code></li>
            <li>The <ToolInfo.Strong>preview</ToolInfo.Strong> updates live — copy the <ToolInfo.Strong>Markdown</ToolInfo.Strong>, <ToolInfo.Strong>HTML</ToolInfo.Strong>, or <ToolInfo.Strong>reStructuredText</ToolInfo.Strong> snippet directly into your docs</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Adding a CI status badge — <ToolInfo.Code>build-passing-brightgreen</ToolInfo.Code> — to a GitHub README</li>
            <li>Showing test coverage as a dynamic percentage badge updated on each CI run</li>
            <li>Displaying the current version from a package registry: <ToolInfo.Code>npm-v1.2.3-blue</ToolInfo.Code></li>
            <li>License badges like <ToolInfo.Code>license-MIT-lightgrey</ToolInfo.Code> in open-source project READMEs</li>
            <li>Custom project or team badges for internal documentation portals</li>
          </ToolInfo.UL>

          <ToolInfo.H2>AI agent integration</ToolInfo.H2>
          <ToolInfo.P>
            A machine-readable <ToolInfo.Code>llms.txt</ToolInfo.Code> file is available at{" "}
            <ToolInfo.Code>/tools/badge/llms.txt</ToolInfo.Code> containing the full badge URL specification,
            all named colors, style options, logo slugs, and ready-to-use badge patterns for common use cases.
            Paste this file into your AI coding assistant (Claude, Cursor, GitHub Copilot, or any LLM-powered tool)
            and ask it to add badges to your project — it will construct the correct URLs automatically.
          </ToolInfo.P>
        </ToolInfo>
      </div>
    </>
  );
}
