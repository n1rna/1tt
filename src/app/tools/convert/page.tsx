import { VideoConverter } from "@/components/tools/video-converter";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "convert",
  title: "Video Converter",
  description:
    "Extract video metadata, compress videos, and convert between MP4, WebM, MOV, MKV, and more.",
  keywords: ["video converter", "compress video", "transcode", "mp4", "webm", "mkv", "mov", "codec", "bitrate"],
});

export default function VideoConverterPage() {
  const jsonLd = toolJsonLd("convert");
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
      <VideoConverter />
    </>
  );
}
