export interface DocDefinition {
  slug: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  toolSlug?: string; // related tool slug
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
];
