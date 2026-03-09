// 1two.dev Tools — Chrome Extension Background (Omnibox Handler)
// Change this URL for local development (e.g., "http://localhost:3000")
const BASE_URL = "https://1two.dev";

// ---------- Tool registry (synced from src/lib/tools/registry.ts) ----------

const TOOLS = [
  { slug: "jwt", name: "JWT Parser", description: "Decode and inspect JWT tokens", category: "parsing", keywords: ["jwt", "token", "decode", "json web token", "auth", "bearer"] },
  { slug: "json", name: "JSON Tool", description: "Validate, auto-correct, format, and explore JSON", category: "formatting", keywords: ["json", "format", "beautify", "minify", "validate", "tree", "parse", "fix"] },
  { slug: "b64", name: "Base64 Encoder/Decoder", description: "Encode and decode Base64 strings", category: "encoding", keywords: ["base64", "encode", "decode", "binary", "data uri"] },
  { slug: "diff", name: "Diff Tool", description: "Compare texts side by side with diff highlighting", category: "text", keywords: ["diff", "compare", "merge", "text", "difference", "side by side"] },
  { slug: "cron", name: "Cron Builder", description: "Build and understand cron schedule expressions", category: "generators", keywords: ["cron", "crontab", "schedule", "timer", "job", "recurring", "interval"] },
  { slug: "timestamp", name: "Timestamp Tool", description: "Parse and convert Unix timestamps and datetime formats", category: "conversion", keywords: ["timestamp", "unix", "epoch", "iso", "rfc3339", "rfc2822", "datetime", "time", "date", "timezone", "utc", "convert"] },
  { slug: "color", name: "Color Tool", description: "Build themes with CSS variable tokens and color builder", category: "web", keywords: ["color", "colour", "picker", "palette", "hex", "rgb", "hsl", "oklch", "theme", "tokens", "css variables", "preset"] },
  { slug: "random", name: "Random Generator", description: "Generate UUIDs, passwords, secret keys, and random numbers", category: "generators", keywords: ["random", "uuid", "password", "secret", "hex", "generate", "key", "token", "number", "lorem", "ipsum", "text"] },
  { slug: "keyboard", name: "Keyboard Tester", description: "Test your keyboard with a visual key tester", category: "web", keywords: ["keyboard", "key", "test", "tester", "layout", "qwerty", "azerty", "dvorak", "colemak"] },
  { slug: "microphone", name: "Microphone Test", description: "Test your microphone and view audio levels", category: "web", keywords: ["microphone", "mic", "audio", "test", "record", "sound", "level", "spectrum"] },
  { slug: "webcam", name: "Webcam Test", description: "Test your webcam and capture frames", category: "web", keywords: ["webcam", "camera", "video", "test", "capture", "screenshot", "resolution"] },
  { slug: "video", name: "Video Player", description: "Play local or remote video files with metadata inspection", category: "media", keywords: ["video", "player", "media", "mp4", "webm", "stream", "hls", "play", "watch"] },
  { slug: "convert", name: "Video Converter", description: "Extract metadata, compress, and convert video formats", category: "media", keywords: ["video", "convert", "compress", "transcode", "metadata", "mp4", "webm", "mkv", "mov", "codec", "bitrate"] },
  { slug: "websocket", name: "WebSocket Tester", description: "Connect to WebSocket servers and inspect traffic", category: "web", keywords: ["websocket", "ws", "wss", "socket", "realtime", "test", "connect", "message", "api"] },
  { slug: "notifications", name: "Notification Tester", description: "Test push notifications and generate VAPID keys", category: "web", keywords: ["notification", "push", "firebase", "fcm", "vapid", "web push", "service worker", "subscribe", "test"] },
  { slug: "currency", name: "Finance Tool", description: "Live crypto prices, gold, exchange rates, and currency converter", category: "data", keywords: ["finance", "crypto", "bitcoin", "ethereum", "gold", "currency", "exchange rate", "forex", "convert", "usd", "eur", "market", "price"] },
  { slug: "workers", name: "Worker Inspector", description: "Inspect service workers and manage Cache Storage", category: "web", keywords: ["service worker", "worker", "cache", "cache storage", "pwa", "sw", "inspect", "unregister", "debug"] },
  { slug: "calendar", name: "Calendar", description: "Plan and visualize with multiple views and timeline summaries", category: "planning", keywords: ["calendar", "plan", "schedule", "milestone", "epic", "timeline", "date", "week", "month", "year", "quarter"] },
  { slug: "markdown", name: "Markdown Editor", description: "Write and preview markdown with live rendering", category: "text", keywords: ["markdown", "md", "editor", "preview", "write", "format", "text"] },
  { slug: "pomodoro", name: "Pomodoro Timer", description: "Focus timer with customizable work/break durations", category: "planning", keywords: ["pomodoro", "timer", "focus", "productivity", "break", "goals", "notification", "work"] },
  { slug: "hash", name: "Hash Generator", description: "Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes", category: "crypto", keywords: ["hash", "md5", "sha256", "sha512", "sha1", "sha384", "checksum", "digest", "file hash", "integrity"] },
  { slug: "logo", name: "Logo Generator", description: "Create minimal text logos and export as SVG, PNG, or favicon", category: "generators", keywords: ["logo", "text", "brand", "favicon", "icon", "svg", "png", "generate", "minimal", "typography"] },
  { slug: "image", name: "Image Tool", description: "Convert and resize images — PNG, JPEG, WebP, AVIF", category: "media", keywords: ["image", "convert", "resize", "png", "jpeg", "jpg", "webp", "avif", "compress", "format", "canvas", "width", "height"] },
  { slug: "worldclock", name: "World Clock", description: "Live clocks for multiple timezones and overlap finder", category: "conversion", keywords: ["world clock", "timezone", "time zone", "clock", "utc", "overlap", "meeting time", "schedule", "convert time", "international"] },
  { slug: "ip", name: "IP Address", description: "View your public IP address, geolocation, and network info", category: "web", keywords: ["ip", "ip address", "my ip", "geolocation", "location", "network", "curl", "whois"] },
  { slug: "dns", name: "DNS Lookup", description: "Look up DNS records for any domain", category: "web", keywords: ["dns", "lookup", "domain", "nameserver", "mx", "cname", "txt", "a record", "aaaa", "ns", "soa", "dig", "nslookup"] },
  { slug: "upload", name: "File Upload", description: "Upload, manage, and share files securely", category: "web", keywords: ["upload", "file", "share", "storage", "cloud", "send"] },
];

// Sub-items that link to specific tabs/modes within a tool
const SUB_ITEMS = [
  { slug: "random", name: "UUID Generator", description: "Generate random UUIDs (v4/v7)", href: "/tools/random?t=uuid", keywords: ["uuid", "guid", "unique id", "v4", "v7"], parent: "Random Generator" },
  { slug: "random", name: "Password Generator", description: "Generate secure random passwords", href: "/tools/random?t=password", keywords: ["password", "passphrase", "secure", "random password"], parent: "Random Generator" },
  { slug: "random", name: "Secret Key Generator", description: "Generate cryptographic secret keys", href: "/tools/random?t=secret", keywords: ["secret", "key", "api key", "token", "crypto"], parent: "Random Generator" },
  { slug: "random", name: "Hex String Generator", description: "Generate random hexadecimal strings", href: "/tools/random?t=hex", keywords: ["hex", "hexadecimal", "random hex"], parent: "Random Generator" },
  { slug: "random", name: "Base64 Generator", description: "Generate random Base64-encoded strings", href: "/tools/random?t=base64", keywords: ["base64", "random base64", "token"], parent: "Random Generator" },
  { slug: "random", name: "Random Number", description: "Generate random numbers in a range", href: "/tools/random?t=number", keywords: ["number", "integer", "random number", "range"], parent: "Random Generator" },
  { slug: "random", name: "Lorem Ipsum Generator", description: "Generate placeholder text", href: "/tools/random?t=lorem", keywords: ["lorem", "ipsum", "placeholder", "dummy text", "filler"], parent: "Random Generator" },
];

// ---------- Helpers ----------

/** XML-escape text for Chrome omnibox descriptions */
function esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fuzzy match score — higher is better, 0 means no match.
 * Exact match > starts with > word-start > substring > fuzzy char sequence.
 */
function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t === q) return 100;
  if (t.startsWith(q)) return 90;

  const words = t.split(/[\s\-_/]+/);
  for (const word of words) {
    if (word.startsWith(q)) return 80;
  }

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
  if (qi === q.length) return 30 + consecutiveBonus;

  return 0;
}

/** Score an item against the query across all its searchable fields */
function scoreItem(item, query) {
  const nameScore = fuzzyScore(query, item.name);
  const descScore = fuzzyScore(query, item.description) * 0.5;
  const keywordScore = Math.max(0, ...item.keywords.map((k) => fuzzyScore(query, k) * 0.7));
  const parentScore = item.parent ? fuzzyScore(query, item.parent) * 0.3 : 0;
  return Math.max(nameScore, descScore, keywordScore, parentScore);
}

/** Build the full URL for a tool or sub-item */
function itemUrl(item) {
  if (item.href) return BASE_URL + item.href;
  return `${BASE_URL}/tools/${item.slug}`;
}

/** Build all searchable items (tools + sub-items) */
function getAllItems() {
  const items = TOOLS.map((t) => ({
    ...t,
    href: null,
    parent: null,
  }));
  for (const sub of SUB_ITEMS) {
    items.push({
      ...sub,
      category: TOOLS.find((t) => t.slug === sub.slug)?.category || "generators",
    });
  }
  return items;
}

const ALL_ITEMS = getAllItems();

/** Search and return up to `limit` matching suggestions */
function searchTools(query, limit = 5) {
  const q = query.trim();

  if (!q) {
    // No query — return first tools alphabetically
    return ALL_ITEMS.slice(0, limit).map((item) => ({
      content: itemUrl(item),
      description: `<match>${esc(item.name)}</match> &mdash; <dim>${esc(item.description)}</dim>`,
    }));
  }

  const scored = ALL_ITEMS.map((item) => ({
    item,
    score: scoreItem(item, q),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // If sub-items matched, hide the parent tool
  const matchedParents = new Set(
    scored.filter((s) => s.item.parent).map((s) => s.item.parent)
  );
  const filtered = scored.filter((s) => !matchedParents.has(s.item.name));

  const results = filtered.slice(0, limit).map((s) => ({
    content: itemUrl(s.item),
    description: `<match>${esc(s.item.name)}</match> &mdash; <dim>${esc(s.item.description)}</dim>`,
  }));

  // Fallback if nothing matched
  if (results.length === 0) {
    results.push({
      content: BASE_URL,
      description: `Search 1two.dev for &quot;<match>${esc(q)}</match>&quot;`,
    });
  }

  return results;
}

// ---------- Omnibox event handlers ----------

chrome.omnibox.onInputStarted.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({
    description: "Search 1two.dev tools...",
  });
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const results = searchTools(text);
  suggest(results);
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // `text` is either a URL (if user selected a suggestion) or raw text
  let url;
  if (text.startsWith("http://") || text.startsWith("https://")) {
    url = text;
  } else {
    // User pressed Enter on raw text — try to find a matching tool
    const results = searchTools(text, 1);
    url = results.length > 0 ? results[0].content : BASE_URL;
  }

  switch (disposition) {
    case "currentTab":
      chrome.tabs.update({ url });
      break;
    case "newForegroundTab":
      chrome.tabs.create({ url });
      break;
    case "newBackgroundTab":
      chrome.tabs.create({ url, active: false });
      break;
  }
});
