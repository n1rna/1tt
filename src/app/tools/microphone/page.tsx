import { MicrophoneTester } from "@/components/tools/microphone-tester";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "microphone",
  title: "Online Microphone Test",
  description:
    "Test your microphone online. View live audio levels, frequency spectrum, and device info. Record audio clips, play back, and download recordings. No installation required.",
  keywords: [
    "microphone test",
    "test microphone online",
    "mic test",
    "mic checker",
    "audio test",
    "microphone level",
    "sound test",
    "mic recording test",
    "audio device test",
    "check microphone",
  ],
});

export default function MicrophonePage() {
  const jsonLd = toolJsonLd("microphone");
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
      <MicrophoneTester />
    </>
  );
}
