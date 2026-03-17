import RegexTester from "@/components/tools/regex-tester";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "regex",
  title: "Regex Tester — Test Regular Expressions Online",
  description:
    "Test regular expressions with live match highlighting, capture group details, replace mode, code generation in JS/Python/Go, and a built-in cheat sheet. Shareable via URL.",
  keywords: [
    "regex tester",
    "regular expression",
    "regexp",
    "pattern matching",
    "capture groups",
    "regex flags",
    "regex replace",
    "regex cheat sheet",
    "online regex",
  ],
});

export default function RegexPage() {
  const jsonLd = toolJsonLd("regex");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <RegexTester />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is a Regular Expression?</ToolInfo.H2>
          <ToolInfo.P>
            A regular expression (regex or regexp) is a sequence of characters that defines a search pattern. Regex patterns can match simple strings, complex character sequences, and structured formats like email addresses or URLs. They are supported natively in virtually every programming language and are a standard tool for text processing, validation, and data extraction.
          </ToolInfo.P>
          <ToolInfo.P>
            A regex is written as a pattern enclosed in delimiters — for example <ToolInfo.Code>/\d+/g</ToolInfo.Code> — where the part between slashes is the pattern and the trailing letters are flags that modify matching behavior.
          </ToolInfo.P>

          <ToolInfo.H2>How Regex Works</ToolInfo.H2>
          <ToolInfo.P>
            The regex engine scans a string character by character and attempts to match the pattern at each position. Special syntax controls how matching behaves:
          </ToolInfo.P>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>Character classes</ToolInfo.Strong> like <ToolInfo.Code>\d</ToolInfo.Code>, <ToolInfo.Code>\w</ToolInfo.Code>, <ToolInfo.Code>[a-z]</ToolInfo.Code> match sets of characters.</li>
            <li><ToolInfo.Strong>Quantifiers</ToolInfo.Strong> like <ToolInfo.Code>*</ToolInfo.Code>, <ToolInfo.Code>+</ToolInfo.Code>, <ToolInfo.Code>{"{n,m}"}</ToolInfo.Code> control how many times a token is matched.</li>
            <li><ToolInfo.Strong>Anchors</ToolInfo.Strong> like <ToolInfo.Code>^</ToolInfo.Code> and <ToolInfo.Code>$</ToolInfo.Code> assert a position rather than matching a character.</li>
            <li><ToolInfo.Strong>Capture groups</ToolInfo.Strong> wrapped in <ToolInfo.Code>()</ToolInfo.Code> extract sub-matches and enable back-references in replacements via <ToolInfo.Code>$1</ToolInfo.Code>, <ToolInfo.Code>$2</ToolInfo.Code>, etc.</li>
            <li><ToolInfo.Strong>Flags</ToolInfo.Strong> like <ToolInfo.Code>g</ToolInfo.Code> (global), <ToolInfo.Code>i</ToolInfo.Code> (case-insensitive), and <ToolInfo.Code>m</ToolInfo.Code> (multiline) change engine behavior.</li>
          </ToolInfo.UL>

          <ToolInfo.H2>How to Use This Tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>Enter a pattern</ToolInfo.Strong> in the regex field — matches update live as you type.</li>
            <li><ToolInfo.Strong>Toggle flags</ToolInfo.Strong> with the clickable badge buttons next to the pattern field.</li>
            <li><ToolInfo.Strong>Load a common pattern</ToolInfo.Strong> from the Patterns dropdown to quickly test email, URL, IPv4, date, and other common formats.</li>
            <li><ToolInfo.Strong>Click a match</ToolInfo.Strong> in the Matches panel to expand its start/end indices and capture group values.</li>
            <li><ToolInfo.Strong>Enable Replace Mode</ToolInfo.Strong> to preview the result of a substitution using <ToolInfo.Code>$1</ToolInfo.Code> back-references.</li>
            <li><ToolInfo.Strong>Switch the Code tab</ToolInfo.Strong> between JS, Python, and Go to generate a ready-to-use snippet.</li>
            <li><ToolInfo.Strong>Open the Cheat Sheet</ToolInfo.Strong> for a quick reference of syntax — click any item to insert it into the pattern field.</li>
            <li><ToolInfo.Strong>Share</ToolInfo.Strong> the current regex, flags, and test string via a URL hash link.</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common Use Cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Validating user input — <ToolInfo.Code>[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{"{2,}"}</ToolInfo.Code> for email addresses.</li>
            <li>Extracting structured data from logs — matching timestamps, error codes, or IP addresses with capture groups.</li>
            <li>Find-and-replace in editors like VS Code and JetBrains IDEs, both of which use <ToolInfo.Code>$1</ToolInfo.Code> back-reference syntax.</li>
            <li>Parsing version strings using a pattern like <ToolInfo.Code>(\d+)\.(\d+)\.(\d+)</ToolInfo.Code> to capture major, minor, and patch components.</li>
            <li>Stripping HTML tags from a string using <ToolInfo.Code>{"<[^>]+>"}</ToolInfo.Code> with the global flag.</li>
            <li>Tokenizing source code or config files during build tooling or linting pipelines.</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}
