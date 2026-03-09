import { CronBuilder } from "@/components/tools/cron-builder";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "cron",
  title: "Cron Expression Builder & Parser",
  description:
    "Build, parse, and understand cron schedule expressions with a visual editor. See next run times, use presets, and generate crontab syntax for any schedule.",
  keywords: [
    "cron builder",
    "cron expression",
    "crontab generator",
    "cron parser",
    "cron schedule",
    "cron job",
    "crontab syntax",
    "cron next run",
    "cron visualizer",
    "schedule expression",
  ],
});

export default function CronPage() {
  const jsonLd = toolJsonLd("cron");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <style>{`body { overflow: hidden; }`}</style>
      <CronBuilder />
    </>
  );
}
