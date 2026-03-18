export interface DocDefinition {
  slug: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  toolSlug?: string; // related tool slug
}

/** Find the doc page linked to a given tool slug */
export function getDocByToolSlug(toolSlug: string): DocDefinition | undefined {
  return docs.find((d) => d.toolSlug === toolSlug);
}

export const docs: DocDefinition[] = [
  {
    slug: "elasticsearch",
    title: "Elasticsearch Explorer",
    description:
      "Connect to clusters, browse indices, run queries with AI assistance, and monitor health",
    icon: "Database",
    toolSlug: "elasticsearch",
  },
  {
    slug: "og-images",
    title: "OG Image Builder",
    description:
      "Design, publish, and serve Open Graph images from permanent URLs with dynamic text support",
    icon: "Image",
    toolSlug: "og",
  },
  {
    slug: "redis",
    title: "Redis Studio",
    description:
      "Create hosted Redis databases, browse keys, inspect values, manage TTLs, and run commands",
    icon: "Database",
  },
];
