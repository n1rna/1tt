import { ConfigGenerator } from "@/components/tools/config-generator";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";
import { apps } from "@/lib/tools/config-generator/apps";

export const metadata = toolMetadata({
  slug: "config",
  title: "Config File Generator",
  description:
    "Generate configuration files for popular tools and frameworks. Pick an app, tune the settings with a form, and get a ready-to-use config file. Supports JSON, YAML, TOML, INI, Nginx, .env, and more.",
  keywords: [
    "config file generator",
    "configuration generator",
    "tsconfig generator",
    "nginx config generator",
    "eslint config",
    "prettier config",
    "yaml generator",
    "toml generator",
    "env file generator",
    "devtools config",
  ],
});

const appIds = new Set(apps.map((a) => a.id));

export default async function ConfigPage({
  params,
}: {
  params: Promise<{ appId?: string[] }>;
}) {
  const { appId } = await params;
  const slug = appId?.[0] ?? undefined;

  // Determine if slug is a known app ID or a paste ID
  const isAppId = slug ? appIds.has(slug) : false;
  const initialAppId = isAppId ? slug : undefined;
  const pasteId = slug && !isAppId ? slug : undefined;

  const jsonLd = toolJsonLd("config");
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
      <ConfigGenerator initialAppId={initialAppId} pasteId={pasteId} />
    </>
  );
}
