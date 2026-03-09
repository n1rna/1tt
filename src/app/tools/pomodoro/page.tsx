import { PomodoroTool } from "@/components/tools/pomodoro-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "pomodoro",
  title: "Pomodoro Timer with Goals & Notifications",
  description:
    "Stay focused with a Pomodoro timer featuring customizable work and break durations, daily goals with progress tracking, browser notifications, and service worker support for background alerts.",
  keywords: [
    "pomodoro timer",
    "focus timer",
    "productivity timer",
    "pomodoro technique",
    "work timer",
    "break timer",
    "goal tracker",
    "notifications",
    "focus sessions",
  ],
});

export default function PomodoroPage() {
  const jsonLd = toolJsonLd("pomodoro");
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
      <PomodoroTool />
    </>
  );
}
