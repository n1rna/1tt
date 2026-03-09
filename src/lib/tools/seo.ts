import type { Metadata } from "next";
import { getToolBySlug, tools, categoryLabels } from "./registry";

const SITE_URL = "https://1two.dev";

interface ToolSeoOptions {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
}

export function toolMetadata({ slug, title, description, keywords }: ToolSeoOptions): Metadata {
  const url = `${SITE_URL}/tools/${slug}`;
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — 1two.dev`,
      description,
      url,
      type: "website",
      siteName: "1two.dev",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — 1two.dev`,
      description,
    },
  };
}

/**
 * Generates JSON-LD structured data for a tool page.
 * Includes WebApplication + BreadcrumbList for rich results.
 */
export function toolJsonLd(slug: string) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;

  const url = `${SITE_URL}/tools/${slug}`;
  const categoryLabel = categoryLabels[tool.category];

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.name,
      url,
      description: tool.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser",
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      author: {
        "@type": "Organization",
        name: "1two.dev",
        url: SITE_URL,
      },
      keywords: tool.keywords.join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: categoryLabel,
          item: `${SITE_URL}/#${tool.category}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: tool.name,
          item: url,
        },
      ],
    },
  ];
}

/**
 * JSON-LD for the homepage: WebSite (with SearchAction for sitelinks search box)
 * + ItemList of all tools.
 */
export function homepageJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "1two.dev",
      url: SITE_URL,
      description: "Tools that just work — the developer tools you actually need.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Developer Tools",
      description: "Free online developer tools",
      numberOfItems: tools.length,
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.name,
        url: `${SITE_URL}/tools/${tool.slug}`,
        description: tool.description,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "1two.dev",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      sameAs: ["https://github.com/n1rna/1two"],
    },
  ];
}
