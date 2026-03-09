import { WebSocketTester } from "@/components/tools/websocket-tester";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "websocket",
  title: "WebSocket Tester",
  description:
    "Connect to WebSocket servers, send and receive messages, and inspect real-time traffic.",
  keywords: ["websocket tester", "ws client", "websocket client", "realtime", "socket", "wss"],
});

export default function WebSocketTesterPage() {
  const jsonLd = toolJsonLd("websocket");
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
      <WebSocketTester />
    </>
  );
}
