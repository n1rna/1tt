import { ToolLayout } from "@/components/layout/tool-layout";
import { TimestampTool } from "@/components/tools/timestamp-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "timestamp",
  title: "Unix Timestamp Converter",
  description:
    "Convert Unix timestamps to human-readable dates and vice versa. Supports ISO 8601, RFC 3339, RFC 2822, and millisecond timestamps with timezone selection.",
  keywords: [
    "unix timestamp converter",
    "epoch converter",
    "timestamp to date",
    "date to timestamp",
    "iso 8601",
    "rfc 3339",
    "rfc 2822",
    "epoch time",
    "unix time",
    "datetime converter",
    "utc converter",
  ],
});

export default function TimestampPage() {
  const jsonLd = toolJsonLd("timestamp");
  return (
    <ToolLayout slug="timestamp">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <TimestampTool />
    </ToolLayout>
  );
}
