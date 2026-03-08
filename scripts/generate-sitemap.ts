import { tools } from "../src/lib/tools/registry";
import { writeFileSync } from "fs";
import { join } from "path";

const SITE_URL = "https://1two.dev";
const today = new Date().toISOString().split("T")[0];

const urls = [
  { loc: SITE_URL, priority: "1.0" },
  ...tools.map((t) => ({
    loc: `${SITE_URL}/tools/${t.slug}`,
    priority: "0.8",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

writeFileSync(join(import.meta.dirname, "../public/sitemap.xml"), xml);
console.log(`Sitemap generated with ${urls.length} URLs`);
