import { ToolDefinition, ToolCategory, categoryLabels } from "./types";
import { guides } from "@/lib/guides/registry";

// Extend categoryLabels with non-tool categories used in search
(categoryLabels as Record<string, string>).guides = "Guides";

export const tools: ToolDefinition[] = [
  {
    slug: "jwt",
    name: "JWT Parser",
    description: "Decode and inspect JWT tokens - view header, payload, and verify signatures",
    category: "parsing",
    icon: "KeyRound",
    keywords: ["jwt", "token", "decode", "json web token", "auth", "bearer"],
  },
  {
    slug: "json",
    name: "JSON Tool",
    description: "Validate, auto-correct, format, and explore JSON with an interactive tree viewer",
    category: "formatting",
    icon: "Braces",
    keywords: ["json", "format", "beautify", "minify", "validate", "tree", "parse", "fix"],
  },
  {
    slug: "b64",
    name: "Base64 Encoder/Decoder",
    description: "Encode and decode Base64 strings with support for URL-safe encoding",
    category: "encoding",
    icon: "Binary",
    keywords: ["base64", "encode", "decode", "binary", "data uri"],
  },
  {
    slug: "diff",
    name: "Diff Tool",
    description: "Compare two or more texts side by side with line-by-line diff highlighting",
    category: "text",
    icon: "GitCompareArrows",
    keywords: ["diff", "compare", "merge", "text", "difference", "side by side"],
  },
  {
    slug: "cron",
    name: "Cron Builder",
    description: "Build, visualize, and understand cron schedule expressions",
    category: "generators",
    icon: "Clock",
    keywords: ["cron", "crontab", "schedule", "timer", "job", "recurring", "interval"],
  },
  {
    slug: "timestamp",
    name: "Timestamp Tool",
    description: "Parse and convert Unix timestamps, ISO 8601 / RFC 3339, and RFC 2822 datetime formats",
    category: "conversion",
    icon: "Clock3",
    keywords: ["timestamp", "unix", "epoch", "iso", "rfc3339", "rfc2822", "datetime", "time", "date", "timezone", "utc", "convert"],
  },
  {
    slug: "color",
    name: "Color Tool",
    description: "Build themes with CSS variable tokens, preset themes, live dashboard preview, and color builder",
    category: "web",
    icon: "Palette",
    keywords: ["color", "colour", "picker", "palette", "hex", "rgb", "hsl", "oklch", "theme", "tokens", "css variables", "preset"],
  },
  {
    slug: "random",
    name: "Random Generator",
    description: "Generate UUIDs, passwords, secret keys, hex strings, and random numbers",
    category: "generators",
    icon: "Dices",
    keywords: ["random", "uuid", "password", "secret", "hex", "generate", "key", "token", "number", "lorem", "ipsum", "text"],
  },
  {
    slug: "keyboard",
    name: "Keyboard Tester",
    description: "Test your keyboard with a visual key tester supporting multiple layouts and sizes",
    category: "web",
    icon: "Keyboard",
    keywords: ["keyboard", "key", "test", "tester", "layout", "qwerty", "azerty", "dvorak", "colemak", "60", "tkl", "split"],
  },
  {
    slug: "microphone",
    name: "Microphone Test",
    description: "Test your microphone, view audio levels and device info, and record clips",
    category: "web",
    icon: "Mic",
    keywords: ["microphone", "mic", "audio", "test", "record", "sound", "level", "spectrum"],
  },
  {
    slug: "webcam",
    name: "Webcam Test",
    description: "Test your webcam, view resolution and device info, and capture frames",
    category: "web",
    icon: "Camera",
    keywords: ["webcam", "camera", "video", "test", "capture", "screenshot", "resolution"],
  },
  {
    slug: "video",
    name: "Video Player",
    description: "Play local or remote video files with metadata inspection, custom controls, and media info",
    category: "media",
    icon: "Play",
    keywords: ["video", "player", "media", "mp4", "webm", "stream", "hls", "play", "watch"],
  },
  {
    slug: "convert",
    name: "Video Converter",
    description: "Extract video metadata, compress videos, and convert between formats",
    category: "media",
    icon: "FileVideo",
    keywords: ["video", "convert", "compress", "transcode", "metadata", "mp4", "webm", "mkv", "mov", "codec", "bitrate", "resolution"],
  },
  {
    slug: "websocket",
    name: "WebSocket Tester",
    description: "Connect to WebSocket servers, send and receive messages, and inspect traffic",
    category: "web",
    icon: "Cable",
    keywords: ["websocket", "ws", "wss", "socket", "realtime", "test", "connect", "message", "api"],
  },
  {
    slug: "notifications",
    name: "Notification Tester",
    description: "Test push notifications, generate VAPID keys, subscribe to push services, and inspect incoming notifications",
    category: "web",
    icon: "Bell",
    keywords: ["notification", "push", "firebase", "fcm", "vapid", "web push", "service worker", "subscribe", "test"],
  },
  {
    slug: "currency",
    name: "Finance Tool",
    description: "Live crypto prices, gold, exchange rates, currency converter, and market data with sparkline charts",
    category: "data",
    icon: "TrendingUp",
    keywords: ["finance", "crypto", "bitcoin", "ethereum", "gold", "currency", "exchange rate", "forex", "convert", "usd", "eur", "market", "price", "sparkline"],
  },
  {
    slug: "workers",
    name: "Worker Inspector",
    description: "Inspect service workers, view registration state, scope, and script. Browse and manage Cache Storage.",
    category: "web",
    icon: "Cog",
    keywords: ["service worker", "worker", "cache", "cache storage", "pwa", "sw", "inspect", "unregister", "debug"],
  },
  {
    slug: "calendar",
    name: "Calendar",
    description: "Plan and visualize with multiple views, day selection, markers for milestones and epics, and timeline summaries",
    category: "planning",
    icon: "CalendarDays",
    keywords: ["calendar", "plan", "schedule", "milestone", "epic", "timeline", "date", "week", "month", "year", "quarter"],
  },
  {
    slug: "markdown",
    name: "Markdown Editor",
    description: "Write and preview markdown with toolbar shortcuts and live rendering",
    category: "text",
    icon: "FileText",
    keywords: ["markdown", "md", "editor", "preview", "write", "format", "text"],
  },
  {
    slug: "regex",
    name: "Regex Tester",
    description: "Test and debug regular expressions with live match highlighting, capture groups, replace mode, and code generation",
    category: "text",
    icon: "RegexIcon",
    keywords: ["regex", "regexp", "regular expression", "pattern", "match", "test", "replace", "capture group", "flags"],
  },
  {
    slug: "pomodoro",
    name: "Pomodoro Timer",
    description: "Focus timer with customizable work/break durations, daily goals, progress tracking, and browser notifications",
    category: "planning",
    icon: "Timer",
    keywords: ["pomodoro", "timer", "focus", "productivity", "break", "goals", "notification", "work"],
  },
  {
    slug: "hash",
    name: "Hash Generator",
    description: "Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes for text or files",
    category: "crypto",
    icon: "Hash",
    keywords: ["hash", "md5", "sha256", "sha512", "sha1", "sha384", "checksum", "digest", "file hash", "integrity"],
  },
  {
    slug: "logo",
    name: "Logo Generator",
    description: "Create minimal text logos and export as SVG, PNG, or favicon in any size",
    category: "generators",
    icon: "Type",
    keywords: ["logo", "text", "brand", "favicon", "icon", "svg", "png", "generate", "minimal", "typography"],
  },
  {
    slug: "qr",
    name: "QR Code Generator",
    description: "Generate QR codes for URLs, WiFi credentials, vCard contacts, email, SMS, and more",
    category: "generators",
    icon: "QrCode",
    keywords: ["qr", "qr code", "qrcode", "generate", "url", "wifi", "vcard", "contact", "sms", "barcode", "scan"],
  },
  {
    slug: "image",
    name: "Image Tool",
    description: "Convert and resize images in the browser - PNG, JPEG, WebP, AVIF with quality control and aspect-ratio locking",
    category: "media",
    icon: "Image",
    keywords: ["image", "convert", "resize", "png", "jpeg", "jpg", "webp", "avif", "compress", "format", "canvas", "width", "height"],
  },
  {
    slug: "worldclock",
    name: "World Clock",
    description: "Live clocks for multiple timezones and a visual overlap finder to schedule meetings across time zones",
    category: "conversion",
    icon: "Globe",
    keywords: ["world clock", "timezone", "time zone", "clock", "utc", "overlap", "meeting time", "schedule", "convert time", "international"],
  },
  {
    slug: "ip",
    name: "IP Address",
    description: "View your public IP address, geolocation, and network info. Also available via curl.",
    category: "web",
    icon: "Globe",
    keywords: ["ip", "ip address", "my ip", "geolocation", "location", "network", "curl", "whois"],
  },
  {
    slug: "dns",
    name: "DNS Lookup",
    description: "Look up DNS records for any domain - A, AAAA, MX, CNAME, TXT, NS, and more",
    category: "web",
    icon: "Search",
    keywords: ["dns", "lookup", "domain", "nameserver", "mx", "cname", "txt", "a record", "aaaa", "ns", "soa", "dig", "nslookup"],
  },
  {
    slug: "og-checker",
    name: "OG Image Checker",
    description: "Check Open Graph images and meta tags for any URL",
    category: "web",
    icon: "Image",
    keywords: ["og", "open graph", "meta tags", "twitter card", "social media", "preview", "seo", "og:image"],
  },
  {
    slug: "ssl-checker",
    name: "SSL Certificate Checker",
    description: "Check SSL/TLS certificates for any domain - view certificate chain, expiry dates, and security details",
    category: "web",
    icon: "ShieldCheck",
    keywords: ["ssl", "tls", "certificate", "https", "security", "expiry", "certificate chain", "x509"],
  },
  {
    slug: "cors",
    name: "CORS Debugger",
    description: "Check CORS headers and debug cross-origin request issues",
    category: "web",
    icon: "Shield",
    keywords: ["cors", "cross-origin", "access-control", "preflight", "options", "allow-origin", "headers", "browser security"],
  },
  {
    slug: "invoice",
    name: "Invoice Creator",
    description: "Create professional invoices with EU/US standards, line items, tax calculations, and PDF export",
    category: "generators",
    icon: "Receipt",
    keywords: ["invoice", "bill", "pdf", "vat", "tax", "receipt", "billing", "payment", "eu", "us", "iban", "ein"],
  },
  {
    slug: "elasticsearch",
    name: "Elasticsearch Explorer",
    description: "Connect to Elasticsearch clusters, browse indices, run queries, manage documents, and monitor health",
    category: "data",
    icon: "Database",
    keywords: ["elasticsearch", "es", "elastic", "cluster", "index", "query", "search", "kibana", "opensearch", "dsl", "mapping"],
  },
  {
    slug: "sqlite",
    name: "SQLite Browser",
    description: "Open and explore SQLite databases in the browser - browse tables, run SQL queries, sort, filter, and export data",
    category: "data",
    icon: "Database",
    keywords: ["sqlite", "database", "sql", "query", "table", "browse", "db", "data", "explorer", "schema"],
  },
  {
    slug: "csv",
    name: "CSV Viewer",
    description: "View, edit, search, and export CSV files with data science split presets for train/test data",
    category: "data",
    icon: "FileSpreadsheet",
    keywords: ["csv", "tsv", "viewer", "editor", "spreadsheet", "data", "export", "train", "test", "split", "sample"],
  },
  {
    slug: "htpasswd",
    name: "htpasswd Generator",
    description: "Generate htpasswd password hashes for basic auth - bcrypt, SHA-256, SHA-512, MD5, SSHA",
    category: "crypto",
    icon: "Lock",
    keywords: ["htpasswd", "basic auth", "password", "bcrypt", "sha256", "sha512", "md5", "ssha", "apache", "nginx", "http auth"],
  },
  {
    slug: "mdtable",
    name: "Markdown Table",
    description: "Build markdown tables visually with inline editing, CSV paste support, and aligned output",
    category: "generators",
    icon: "Table",
    keywords: ["markdown", "table", "md", "csv", "generator", "columns", "rows", "paste", "align"],
  },
  {
    slug: "og",
    name: "OG Image Builder",
    description: "Create Open Graph images for social media with multiple layouts, sizes, and customizable themes",
    category: "generators",
    icon: "Image",
    keywords: ["og image", "open graph", "social media", "meta image", "twitter card", "facebook", "linkedin", "og builder", "social preview"],
  },
  {
    slug: "config",
    name: "Config Generator",
    description: "Generate config files for popular tools - tsconfig, ESLint, Prettier, Docker Compose, nginx, and more",
    category: "generators",
    icon: "Settings",
    keywords: ["config", "configuration", "tsconfig", "nginx", "eslint", "prettier", "docker", "gitignore", "generate", "yaml", "json", "toml"],
  },
  {
    slug: "llms-txt",
    name: "llms.txt Generator",
    description: "Generate llms.txt files from any website or docs",
    category: "generators",
    icon: "Bot",
    keywords: ["llms.txt", "llms", "ai", "documentation", "crawl", "generate", "context", "sitemap"],
    requiresAuth: true,
  },
  {
    slug: "paste",
    name: "Paste Bin",
    description: "Create and share text snippets with short, shareable links",
    category: "text",
    icon: "ClipboardPaste",
    keywords: ["paste", "pastebin", "snippet", "share", "text", "code", "gist"],
    requiresAuth: true,
  },
  {
    slug: "upload",
    name: "File Upload",
    description: "Upload, manage, and share files securely with your account",
    category: "web",
    icon: "Upload",
    keywords: ["upload", "file", "share", "storage", "cloud", "send"],
    requiresAuth: true,
  },
  {
    slug: "sql",
    name: "SQL Formatter",
    description: "Format, minify, and beautify SQL with dialect support, syntax highlighting, and AI-powered query generation from natural language",
    category: "formatting",
    icon: "Database",
    keywords: ["sql", "formatter", "format", "beautify", "minify", "postgres", "mysql", "sqlite", "dialect", "query", "ai", "natural language"],
  },
  {
    slug: "poker",
    name: "Planning Poker",
    description: "Real-time planning poker for agile teams — vote on story sizes together",
    icon: "Users",
    category: "planning",
    keywords: ["planning poker", "agile", "scrum", "story points", "estimation", "sprint", "fibonacci", "team", "vote", "realtime"],
    requiresAuth: true,
  },
];

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolsByCategory(): Record<ToolCategory, ToolDefinition[]> {
  const grouped = {} as Record<ToolCategory, ToolDefinition[]>;
  for (const tool of tools) {
    if (!grouped[tool.category]) {
      grouped[tool.category] = [];
    }
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export interface SearchItem {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  href: string;
  keywords: string[];
  /** Parent tool name for sub-items */
  parent?: string;
  /** Whether this tool requires authentication */
  requiresAuth?: boolean;
}

/** Sub-items that link to specific tabs/modes of a tool */
const SUB_ITEMS: Omit<SearchItem, "category" | "icon">[] = [
  { id: "random-uuid", name: "UUID Generator", description: "Generate random UUIDs (v4/v7)", href: "/tools/random/uuid", keywords: ["uuid", "guid", "unique id", "v4", "v7"], parent: "Random Generator" },
  { id: "random-password", name: "Password Generator", description: "Generate secure random passwords", href: "/tools/random/password", keywords: ["password", "passphrase", "secure", "random password"], parent: "Random Generator" },
  { id: "random-secret", name: "Secret Key Generator", description: "Generate cryptographic secret keys", href: "/tools/random/secret", keywords: ["secret", "key", "api key", "token", "crypto"], parent: "Random Generator" },
  { id: "random-hex", name: "Hex String Generator", description: "Generate random hexadecimal strings", href: "/tools/random/hex", keywords: ["hex", "hexadecimal", "random hex"], parent: "Random Generator" },
  { id: "random-base64", name: "Base64 Generator", description: "Generate random Base64-encoded strings", href: "/tools/random/base64", keywords: ["base64", "random base64", "token"], parent: "Random Generator" },
  { id: "random-number", name: "Random Number", description: "Generate random numbers in a range", href: "/tools/random/number", keywords: ["number", "integer", "random number", "range"], parent: "Random Generator" },
  { id: "random-lorem", name: "Lorem Ipsum Generator", description: "Generate placeholder text", href: "/tools/random/lorem", keywords: ["lorem", "ipsum", "placeholder", "dummy text", "filler"], parent: "Random Generator" },
  // Config Generator sub-items
  { id: "config-tsconfig", name: "tsconfig Generator", description: "Generate TypeScript tsconfig.json configuration", href: "/tools/config/tsconfig", keywords: ["tsconfig", "typescript", "tsconfig.json", "compiler options"], parent: "Config Generator" },
  { id: "config-eslint", name: "ESLint Config Generator", description: "Generate ESLint flat configuration", href: "/tools/config/eslint", keywords: ["eslint", "eslint config", "linter", "lint rules"], parent: "Config Generator" },
  { id: "config-prettier", name: "Prettier Config Generator", description: "Generate Prettier .prettierrc configuration", href: "/tools/config/prettier", keywords: ["prettier", "prettierrc", "formatter", "code format"], parent: "Config Generator" },
  { id: "config-nginx", name: "nginx Config Generator", description: "Generate nginx.conf server configuration", href: "/tools/config/nginx", keywords: ["nginx", "nginx.conf", "reverse proxy", "web server", "ssl"], parent: "Config Generator" },
  { id: "config-gitignore", name: ".gitignore Generator", description: "Generate .gitignore with presets for Node, Python, Rust, Go, and more", href: "/tools/config/gitignore", keywords: ["gitignore", "git ignore", "ignore file", "node", "python"], parent: "Config Generator" },
  { id: "config-kitty", name: "Kitty Config Generator", description: "Generate kitty.conf for the Kitty terminal emulator", href: "/tools/config/kitty", keywords: ["kitty", "kitty.conf", "terminal", "terminal emulator", "kitty config"], parent: "Config Generator" },
  { id: "config-alacritty", name: "Alacritty Config Generator", description: "Generate alacritty.toml for the Alacritty terminal", href: "/tools/config/alacritty", keywords: ["alacritty", "alacritty.toml", "terminal", "gpu terminal"], parent: "Config Generator" },
  { id: "config-ohmyzsh", name: "Oh My Zsh Config Generator", description: "Generate .zshrc with Oh My Zsh plugins and themes", href: "/tools/config/ohmyzsh", keywords: ["zsh", "oh my zsh", "zshrc", "shell", "plugins", "themes"], parent: "Config Generator" },
  { id: "config-zellij", name: "Zellij Config Generator", description: "Generate zellij config.kdl for the Zellij terminal multiplexer", href: "/tools/config/zellij", keywords: ["zellij", "multiplexer", "terminal", "tmux alternative", "kdl"], parent: "Config Generator" },
  { id: "config-bitcoin", name: "Bitcoin Config Generator", description: "Generate bitcoin.conf for Bitcoin Core", href: "/tools/config/bitcoin", keywords: ["bitcoin", "bitcoin.conf", "btc", "node", "blockchain", "bitcoin core"], parent: "Config Generator" },
  { id: "config-ssh", name: "SSH Config Generator", description: "Generate SSH client config file", href: "/tools/config/ssh", keywords: ["ssh", "ssh config", "ssh_config", "remote", "key", "proxy jump"], parent: "Config Generator" },
  { id: "config-nextconfig", name: "Next.js Config Generator", description: "Generate next.config.ts for Next.js projects", href: "/tools/config/nextconfig", keywords: ["nextjs", "next.config", "next.js", "react", "app router"], parent: "Config Generator" },
  { id: "config-tmux", name: "tmux Config Generator", description: "Generate .tmux.conf for tmux terminal multiplexer", href: "/tools/config/tmux", keywords: ["tmux", "tmux.conf", "terminal", "multiplexer", "session"], parent: "Config Generator" },
];

export function getSearchItems(): SearchItem[] {
  const items: SearchItem[] = tools.map((t) => ({
    id: t.slug,
    name: t.name,
    description: t.description,
    category: t.category,
    icon: t.icon,
    href: `/tools/${t.slug}`,
    keywords: t.keywords,
    requiresAuth: t.requiresAuth,
  }));

  for (const sub of SUB_ITEMS) {
    const parent = tools.find((t) => t.name === sub.parent);
    if (parent) {
      items.push({
        ...sub,
        category: parent.category,
        icon: parent.icon,
      });
    }
  }

  // Add guides as searchable items
  for (const guide of guides) {
    items.push({
      id: `guide:${guide.slug}`,
      name: guide.title,
      description: guide.description,
      category: "guides" as ToolCategory,
      icon: guide.icon,
      href: `/guides/${guide.slug}`,
      keywords: guide.keywords,
    });
  }

  return items;
}

/**
 * Fuzzy match score - higher is better, 0 means no match.
 * Rewards: exact match > word-start match > substring > fuzzy char sequence.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Starts with query
  if (t.startsWith(q)) return 90;

  // Word start match (e.g. "pass" matches "Password Generator")
  const words = t.split(/[\s\-_/]+/);
  for (const word of words) {
    if (word.startsWith(q)) return 80;
  }

  // Contains as substring
  if (t.includes(q)) return 60;

  // Fuzzy: all query chars appear in order
  let qi = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatchIdx + 1) consecutiveBonus += 5;
      lastMatchIdx = ti;
      qi++;
    }
  }
  if (qi === q.length) {
    return 30 + consecutiveBonus;
  }

  return 0;
}

export function searchItems(query: string, items: SearchItem[]): SearchItem[] {
  if (!query.trim()) return items;
  const q = query.trim().toLowerCase();

  const scored = items
    .map((item) => {
      const nameScore = fuzzyScore(q, item.name);
      const descScore = fuzzyScore(q, item.description) * 0.5;
      const keywordScore = Math.max(
        ...item.keywords.map((k) => fuzzyScore(q, k) * 0.7),
        0
      );
      const parentScore = item.parent ? fuzzyScore(q, item.parent) * 0.3 : 0;
      const score = Math.max(nameScore, descScore, keywordScore, parentScore);
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // If any sub-items of a parent matched, hide the parent
  const matchedParents = new Set(
    scored.filter((s) => s.item.parent).map((s) => s.item.parent)
  );

  return scored
    .filter((s) => !matchedParents.has(s.item.name))
    .map((s) => s.item);
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.toLowerCase();
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q))
  );
}

export { categoryLabels };
export type { ToolDefinition, ToolCategory };
