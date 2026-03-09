import { VideoPlayer } from "@/components/tools/video-player";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "video",
  title: "Video Player",
  description:
    "Play local or remote video files with metadata inspection, custom controls, and media info.",
  keywords: ["video player", "media player", "mp4", "webm", "hls", "stream", "play video online"],
});

export default function VideoPlayerPage() {
  const jsonLd = toolJsonLd("video");
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
      <VideoPlayer />
    </>
  );
}
