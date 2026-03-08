import { ToolLayout } from "@/components/layout/tool-layout";
import { WorldClockTool } from "@/components/tools/worldclock-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "worldclock",
  title: "World Clock & Timezone Overlap Finder",
  description:
    "Live clocks for your favorite timezones and a visual 24-hour overlap finder to schedule meetings across time zones.",
  keywords: [
    "world clock",
    "timezone converter",
    "meeting time finder",
    "timezone overlap",
    "utc converter",
    "international time",
    "schedule meeting",
    "time zone",
  ],
});

export default function WorldClockPage() {
  const jsonLd = toolJsonLd("worldclock");
  return (
    <ToolLayout slug="worldclock">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <WorldClockTool />
    </ToolLayout>
  );
}
