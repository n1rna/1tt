import { Suspense } from "react";
import { RandomGenerator } from "@/components/tools/random-generator";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "random",
  title: "Random Generator — UUID, Password & More",
  description:
    "Generate random UUIDs (v4 & v7), secure passwords, secret keys, hex strings, Base64 tokens, numbers, and lorem ipsum text. Cryptographically secure generation.",
  keywords: [
    "uuid generator",
    "random password generator",
    "uuid v4",
    "uuid v7",
    "secret key generator",
    "random hex string",
    "random number generator",
    "lorem ipsum generator",
    "secure password",
    "token generator",
  ],
});

export default function RandomPage() {
  const jsonLd = toolJsonLd("random");
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
      <Suspense>
        <RandomGenerator />
      </Suspense>
    </>
  );
}
