import { ToolLayout } from "@/components/layout/tool-layout";
import { JwtParser } from "@/components/tools/jwt-parser";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "jwt",
  title: "JWT Parser & Decoder",
  description:
    "Decode and inspect JSON Web Tokens (JWT) online. View header, payload, claims, expiration, and verify signatures. Supports HS256, RS256, and ES256 algorithms.",
  keywords: [
    "jwt decoder",
    "jwt parser",
    "json web token",
    "jwt debugger",
    "decode jwt",
    "jwt claims",
    "jwt header",
    "jwt payload",
    "bearer token",
    "jwt online",
  ],
});

export default function JwtParserPage() {
  const jsonLd = toolJsonLd("jwt");
  return (
    <ToolLayout slug="jwt">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <JwtParser />
    </ToolLayout>
  );
}
