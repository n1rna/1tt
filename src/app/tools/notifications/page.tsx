import { NotificationTester } from "@/components/tools/notification-tester";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "notifications",
  title: "Notification Tester",
  description:
    "Test push notifications, generate VAPID keys, subscribe to push services, and inspect incoming notifications.",
  keywords: ["notification tester", "push notification", "vapid", "web push", "service worker", "fcm"],
});

export default function NotificationTesterPage() {
  const jsonLd = toolJsonLd("notifications");
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
      <NotificationTester />
    </>
  );
}
