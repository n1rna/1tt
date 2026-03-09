import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";
import { WorldClockPage as WorldClockClient } from "@/components/tools/worldclock-tool";

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
  return <WorldClockClient jsonLd={jsonLd} />;
}
