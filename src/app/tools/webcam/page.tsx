import { WebcamTester } from "@/components/tools/webcam-tester";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "webcam",
  title: "Online Webcam Test",
  description:
    "Test your webcam online. View live camera preview, check resolution, frame rate, and device info. Capture frames, download images, or copy to clipboard. No installation required.",
  keywords: [
    "webcam test",
    "test webcam online",
    "camera test",
    "webcam checker",
    "webcam resolution",
    "camera preview",
    "webcam capture",
    "video device test",
    "webcam online",
    "check webcam",
  ],
});

export default function WebcamPage() {
  const jsonLd = toolJsonLd("webcam");
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
      <WebcamTester />
    </>
  );
}
