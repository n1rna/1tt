import { ToolLayout } from "@/components/layout/tool-layout";
import { UploadTool } from "@/components/tools/upload-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "upload",
  title: "File Upload",
  description:
    "Upload, manage, and share files securely with your account.",
  keywords: [
    "file upload",
    "file sharing",
    "cloud storage",
    "upload files",
    "file manager",
  ],
});

export default function UploadPage() {
  const jsonLd = toolJsonLd("upload");
  return (
    <ToolLayout slug="upload">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <UploadTool />
    </ToolLayout>
  );
}
