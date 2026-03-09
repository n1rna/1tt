import { CalendarTool } from "@/components/tools/calendar";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "calendar",
  title: "Calendar",
  description:
    "Plan and visualize with multiple views, day selection, markers for milestones and epics, and timeline summaries.",
  keywords: ["calendar", "planner", "schedule", "milestone", "timeline", "date picker", "week view"],
});

export default function CalendarPage() {
  const jsonLd = toolJsonLd("calendar");
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <CalendarTool />
    </>
  );
}
