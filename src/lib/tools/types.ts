export interface ToolDefinition {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string; // Lucide icon name
  keywords: string[];
  requiresAuth?: boolean;
}

export type ToolCategory =
  | "encoding"
  | "formatting"
  | "parsing"
  | "conversion"
  | "generators"
  | "crypto"
  | "text"
  | "web"
  | "data"
  | "media"
  | "planning";

export const categoryLabels: Record<ToolCategory, string> = {
  encoding: "Encoding / Decoding",
  formatting: "Formatting",
  parsing: "Parsing",
  conversion: "Conversion",
  generators: "Generators",
  crypto: "Crypto & Security",
  text: "Text Tools",
  web: "Web Tools",
  data: "Data Tools",
  media: "Media Tools",
  planning: "Planning",
};
