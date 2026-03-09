import { WorkerInspector } from "@/components/tools/worker-inspector";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "workers",
  title: "Service Worker & Cache Inspector",
  description:
    "Inspect registered service workers, view their state, scope, and script URL. Browse Cache Storage entries. Unregister workers and delete caches directly from the browser.",
  keywords: [
    "service worker inspector",
    "service worker",
    "cache storage",
    "web worker",
    "unregister service worker",
    "cache api",
    "pwa debug",
    "sw inspector",
    "browser worker",
    "worker state",
  ],
});

export default function WorkersPage() {
  const jsonLd = toolJsonLd("workers");
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
      <WorkerInspector />
    </>
  );
}
