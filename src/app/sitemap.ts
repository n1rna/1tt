import type { MetadataRoute } from "next";
import { tools, getSearchItems } from "@/lib/tools/registry";
import { guides } from "@/lib/guides/registry";
import { docs } from "@/lib/docs/registry";

const SITE_URL = "https://1tt.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const toolPages = tools.map((tool) => ({
    url: `${SITE_URL}/tools/${tool.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Sub-pages within tools (e.g. /tools/config/ssh)
  const subPages = getSearchItems()
    .filter((item) => item.href.startsWith("/tools/") && item.href.split("/").length > 3)
    .map((item) => ({
      url: `${SITE_URL}${item.href}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const guidePages = guides.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const docPages = docs.map((doc) => ({
    url: `${SITE_URL}/docs/${doc.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const staticPages = ["/guides", "/terms", "/privacy", "/support"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...toolPages,
    ...subPages,
    ...guidePages,
    ...docPages,
    ...staticPages,
  ];
}
