import type { AppDefinition } from "../types";

function setDotPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function flattenDotPaths(
  obj: Record<string, unknown>,
  prefix = "",
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      flattenDotPaths(val as Record<string, unknown>, fullKey, result);
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

export const nextconfig: AppDefinition = {
  id: "nextconfig",
  name: "Next.js",
  configFileName: "next.config.js",
  version: "15.0",
  format: "json",
  icon: "Triangle",
  description: "Next.js framework configuration for builds, images, and experimental features.",
  docsUrl: "https://nextjs.org/docs/app/api-reference/config/next-config-js",
  sections: [
    {
      id: "general",
      label: "General",
      description: "Core framework behavior and build settings.",
      fields: [
        {
          id: "reactStrictMode",
          type: "boolean",
          label: "React Strict Mode",
          description: "Enable React strict mode for highlighting potential problems.",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "output",
          type: "select",
          label: "Output Mode",
          description: "Build output mode for deployment targets.",
          defaultValue: "",
          enabledByDefault: true,
          options: [
            { value: "", label: "Default" },
            { value: "standalone", label: "Standalone (Docker)" },
            { value: "export", label: "Static Export" },
          ],
        },
        {
          id: "basePath",
          type: "string",
          label: "Base Path",
          description: "URL prefix when hosting under a subpath.",
          defaultValue: "",
          placeholder: "/my-app",
        },
        {
          id: "trailingSlash",
          type: "boolean",
          label: "Trailing Slash",
          description: "Append trailing slashes to all URLs.",
          defaultValue: false,
        },
        {
          id: "poweredByHeader",
          type: "boolean",
          label: "X-Powered-By Header",
          description: "Include the X-Powered-By response header.",
          defaultValue: true,
        },
        {
          id: "compress",
          type: "boolean",
          label: "Compression",
          description: "Enable gzip compression for rendered content.",
          defaultValue: true,
        },
        {
          id: "distDir",
          type: "string",
          label: "Build Directory",
          description: "Output directory for the production build.",
          defaultValue: ".next",
        },
        {
          id: "cleanDistDir",
          type: "boolean",
          label: "Clean Build Directory",
          description: "Remove the build directory before each build.",
          defaultValue: true,
        },
        {
          id: "generateEtags",
          type: "boolean",
          label: "Generate ETags",
          description: "Generate ETag headers for rendered pages.",
          defaultValue: true,
        },
        {
          id: "pageExtensions",
          type: "string-array",
          label: "Page Extensions",
          description: "File extensions resolved as pages.",
          defaultValue: ["tsx", "ts", "jsx", "js"],
        },
      ],
    },
    {
      id: "images",
      label: "Images",
      description: "Image optimization and remote pattern configuration.",
      fields: [
        {
          id: "images.unoptimized",
          type: "boolean",
          label: "Disable Optimization",
          description: "Serve images without the built-in optimization pipeline.",
          defaultValue: false,
        },
        {
          id: "images.remotePatterns",
          type: "string-array",
          label: "Remote Hostnames",
          description: "Allowed hostnames for remote image optimization.",
          defaultValue: [],
          placeholder: "example.com",
        },
        {
          id: "images.formats",
          type: "multi-select",
          label: "Image Formats",
          description: "Accepted output formats for optimized images.",
          defaultValue: ["image/webp"],
          options: [
            { value: "image/avif", label: "AVIF" },
            { value: "image/webp", label: "WebP" },
          ],
        },
        {
          id: "images.minimumCacheTTL",
          type: "number",
          label: "Minimum Cache TTL",
          description: "Cache duration in seconds for optimized images.",
          defaultValue: 60,
          min: 0,
          max: 31536000,
        },
        {
          id: "images.deviceSizes",
          type: "string-array",
          label: "Device Sizes",
          description: "Device width breakpoints for responsive image srcsets.",
          defaultValue: ["640", "750", "828", "1080", "1200", "1920", "2048", "3840"],
        },
        {
          id: "images.imageSizes",
          type: "string-array",
          label: "Image Sizes",
          description: "Width values used when a sizes prop is set on next/image.",
          defaultValue: ["16", "32", "48", "64", "96", "128", "256", "384"],
        },
      ],
    },
    {
      id: "redirects-rewrites",
      label: "Redirects & Rewrites",
      description: "URL handling and middleware behavior.",
      fields: [
        {
          id: "skipTrailingSlashRedirect",
          type: "boolean",
          label: "Skip Trailing Slash Redirect",
          description: "Disable automatic trailing slash redirects.",
          defaultValue: false,
        },
        {
          id: "skipMiddlewareUrlNormalize",
          type: "boolean",
          label: "Skip Middleware URL Normalize",
          description: "Disable URL normalization in middleware.",
          defaultValue: false,
        },
      ],
    },
    {
      id: "typescript-eslint",
      label: "TypeScript & ESLint",
      description: "Type checking and linting behavior during builds.",
      fields: [
        {
          id: "typescript.ignoreBuildErrors",
          type: "boolean",
          label: "Ignore TypeScript Errors",
          description: "Skip type checking during production builds.",
          defaultValue: false,
        },
        {
          id: "eslint.ignoreDuringBuilds",
          type: "boolean",
          label: "Ignore ESLint Errors",
          description: "Skip ESLint checks during production builds.",
          defaultValue: false,
        },
        {
          id: "eslint.dirs",
          type: "string-array",
          label: "ESLint Directories",
          description: "Directories to run ESLint on during builds.",
          defaultValue: [],
          placeholder: "src",
        },
      ],
    },
    {
      id: "experimental",
      label: "Experimental",
      description: "Unstable and preview features that may change between releases.",
      fields: [
        {
          id: "experimental.ppr",
          type: "boolean",
          label: "Partial Prerendering",
          description: "Enable partial prerendering for streaming static shells.",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "experimental.reactCompiler",
          type: "boolean",
          label: "React Compiler",
          description: "Enable the React compiler for automatic memoization.",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "experimental.serverActions.bodySizeLimit",
          type: "string",
          label: "Server Actions Body Limit",
          description: "Maximum request body size for server actions.",
          defaultValue: "1mb",
          placeholder: "2mb",
        },
        {
          id: "experimental.optimizePackageImports",
          type: "string-array",
          label: "Optimize Package Imports",
          description: "Packages to tree-shake with optimized barrel file handling.",
          defaultValue: [],
          placeholder: "lucide-react",
          enabledByDefault: true,
        },
        {
          id: "experimental.turbo",
          type: "boolean",
          label: "Turbopack",
          description: "Enable Turbopack for the development server.",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "experimental.typedRoutes",
          type: "boolean",
          label: "Typed Routes",
          description: "Generate typed route definitions for Link components.",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "experimental.instrumentationHook",
          type: "boolean",
          label: "Instrumentation Hook",
          description: "Enable the instrumentation.ts lifecycle hook.",
          defaultValue: false,
        },
      ],
    },
    {
      id: "bundling",
      label: "Webpack & Bundling",
      description: "Package transpilation and server-side module resolution.",
      fields: [
        {
          id: "transpilePackages",
          type: "string-array",
          label: "Transpile Packages",
          description: "NPM packages to transpile from node_modules.",
          defaultValue: [],
          placeholder: "package-name",
        },
        {
          id: "serverExternalPackages",
          type: "string-array",
          label: "Server External Packages",
          description: "Packages excluded from server-side bundling.",
          defaultValue: [],
          placeholder: "package-name",
        },
      ],
    },
    {
      id: "environment",
      label: "Environment & Headers",
      description: "Asset delivery and CDN configuration.",
      fields: [
        {
          id: "assetPrefix",
          type: "string",
          label: "Asset Prefix",
          description: "CDN prefix for static assets.",
          defaultValue: "",
          placeholder: "https://cdn.example.com",
        },
      ],
    },
  ],

  serialize(values: Record<string, unknown>, enabledFields: Set<string>): string {
    const config: Record<string, unknown> = {};

    for (const fieldId of enabledFields) {
      const value = values[fieldId];

      // Skip output field when set to default (empty string)
      if (fieldId === "output" && value === "") continue;

      // Convert remote hostnames to pattern objects
      if (fieldId === "images.remotePatterns") {
        const hostnames = value as string[];
        if (hostnames.length > 0) {
          setDotPath(
            config,
            "images.remotePatterns",
            hostnames.map((hostname) => ({ hostname })),
          );
        }
        continue;
      }

      // Convert device/image size strings to numbers
      if (fieldId === "images.deviceSizes" || fieldId === "images.imageSizes") {
        const sizes = (value as string[]).map(Number).filter((n) => !Number.isNaN(n));
        if (sizes.length > 0) {
          setDotPath(config, fieldId, sizes);
        }
        continue;
      }

      // Nest serverActions.bodySizeLimit under experimental.serverActions
      if (fieldId === "experimental.serverActions.bodySizeLimit") {
        setDotPath(config, "experimental.serverActions", {
          bodySizeLimit: value,
        });
        continue;
      }

      setDotPath(config, fieldId, value);
    }

    return JSON.stringify(config, null, 2);
  },

  deserialize(raw: string): { values: Record<string, unknown>; enabledFields: string[] } {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { values: {}, enabledFields: [] };
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { values: {}, enabledFields: [] };
    }

    // Pre-process special nested structures before flattening
    // Convert images.remotePatterns from [{hostname}] to string[]
    const images = parsed.images as Record<string, unknown> | undefined;
    if (images?.remotePatterns && Array.isArray(images.remotePatterns)) {
      images.remotePatterns = (images.remotePatterns as { hostname?: string }[])
        .map((p) => p.hostname)
        .filter(Boolean);
    }

    // Convert images.deviceSizes and images.imageSizes from number[] to string[]
    if (images?.deviceSizes && Array.isArray(images.deviceSizes)) {
      images.deviceSizes = (images.deviceSizes as number[]).map(String);
    }
    if (images?.imageSizes && Array.isArray(images.imageSizes)) {
      images.imageSizes = (images.imageSizes as number[]).map(String);
    }

    // Flatten experimental.serverActions to dot-path key
    const experimental = parsed.experimental as Record<string, unknown> | undefined;
    if (experimental?.serverActions && typeof experimental.serverActions === "object") {
      const sa = experimental.serverActions as Record<string, unknown>;
      if (sa.bodySizeLimit !== undefined) {
        (experimental as Record<string, unknown>)["serverActions.bodySizeLimit"] = sa.bodySizeLimit;
      }
      delete experimental.serverActions;
    }

    const flat = flattenDotPaths(parsed);
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    for (const [key, val] of Object.entries(flat)) {
      values[key] = val;
      enabledFields.push(key);
    }

    // Ensure output field is present even when omitted from config
    if (!("output" in values)) {
      values.output = "";
    }

    return { values, enabledFields };
  },

  validate(raw: string): { valid: boolean; error?: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { valid: false, error: `Invalid JSON: ${(e as Error).message}` };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: "Config must be a JSON object." };
    }
    return { valid: true };
  },
};
