// 1two.dev Tools — Popup
const BASE_URL = "https://1two.dev";

const CATEGORY_LABELS = {
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

const CATEGORY_ORDER = [
  "web", "generators", "media", "conversion", "text", "formatting",
  "parsing", "encoding", "crypto", "data", "planning",
];

const TOOLS = [
  { slug: "jwt", name: "JWT Parser", description: "Decode and inspect JWT tokens", category: "parsing", keywords: ["jwt", "token", "decode", "json web token", "auth", "bearer"] },
  { slug: "json", name: "JSON Tool", description: "Validate, auto-correct, format, and explore JSON", category: "formatting", keywords: ["json", "format", "beautify", "minify", "validate", "tree", "parse", "fix"] },
  { slug: "b64", name: "Base64 Encoder/Decoder", description: "Encode and decode Base64 strings", category: "encoding", keywords: ["base64", "encode", "decode", "binary", "data uri"] },
  { slug: "diff", name: "Diff Tool", description: "Compare texts side by side with diff highlighting", category: "text", keywords: ["diff", "compare", "merge", "text", "difference", "side by side"] },
  { slug: "cron", name: "Cron Builder", description: "Build and understand cron schedule expressions", category: "generators", keywords: ["cron", "crontab", "schedule", "timer", "job", "recurring", "interval"] },
  { slug: "timestamp", name: "Timestamp Tool", description: "Parse and convert Unix timestamps and datetime formats", category: "conversion", keywords: ["timestamp", "unix", "epoch", "iso", "rfc3339", "rfc2822", "datetime", "time", "date", "timezone", "utc", "convert"] },
  { slug: "color", name: "Color Tool", description: "Build themes with CSS variable tokens and color builder", category: "web", keywords: ["color", "colour", "picker", "palette", "hex", "rgb", "hsl", "oklch", "theme", "tokens", "css variables", "preset"] },
  { slug: "random", name: "Random Generator", description: "Generate UUIDs, passwords, secret keys, and random numbers", category: "generators", keywords: ["random", "uuid", "password", "secret", "hex", "generate", "key", "token", "number", "lorem", "ipsum", "text"] },
  { slug: "keyboard", name: "Keyboard Tester", description: "Test your keyboard with a visual key tester", category: "web", keywords: ["keyboard", "key", "test", "tester", "layout", "qwerty"] },
  { slug: "microphone", name: "Microphone Test", description: "Test your microphone and view audio levels", category: "web", keywords: ["microphone", "mic", "audio", "test", "record", "sound"] },
  { slug: "webcam", name: "Webcam Test", description: "Test your webcam and capture frames", category: "web", keywords: ["webcam", "camera", "video", "test", "capture"] },
  { slug: "video", name: "Video Player", description: "Play local or remote video files with metadata inspection", category: "media", keywords: ["video", "player", "media", "mp4", "webm", "stream", "hls"] },
  { slug: "convert", name: "Video Converter", description: "Extract metadata, compress, and convert video formats", category: "media", keywords: ["video", "convert", "compress", "transcode", "metadata"] },
  { slug: "websocket", name: "WebSocket Tester", description: "Connect to WebSocket servers and inspect traffic", category: "web", keywords: ["websocket", "ws", "wss", "socket", "realtime", "test", "connect"] },
  { slug: "notifications", name: "Notification Tester", description: "Test push notifications and generate VAPID keys", category: "web", keywords: ["notification", "push", "firebase", "vapid", "web push"] },
  { slug: "currency", name: "Finance Tool", description: "Live crypto prices, gold, exchange rates, and currency converter", category: "data", keywords: ["finance", "crypto", "bitcoin", "gold", "currency", "exchange rate", "forex"] },
  { slug: "workers", name: "Worker Inspector", description: "Inspect service workers and manage Cache Storage", category: "web", keywords: ["service worker", "worker", "cache", "pwa", "inspect"] },
  { slug: "calendar", name: "Calendar", description: "Plan and visualize with multiple views and timeline summaries", category: "planning", keywords: ["calendar", "plan", "schedule", "milestone", "epic", "timeline"] },
  { slug: "markdown", name: "Markdown Editor", description: "Write and preview markdown with live rendering", category: "text", keywords: ["markdown", "md", "editor", "preview", "write"] },
  { slug: "pomodoro", name: "Pomodoro Timer", description: "Focus timer with customizable work/break durations", category: "planning", keywords: ["pomodoro", "timer", "focus", "productivity", "break"] },
  { slug: "hash", name: "Hash Generator", description: "Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes", category: "crypto", keywords: ["hash", "md5", "sha256", "sha512", "checksum", "digest"] },
  { slug: "logo", name: "Logo Generator", description: "Create minimal text logos and export as SVG, PNG, or favicon", category: "generators", keywords: ["logo", "text", "brand", "favicon", "icon", "svg", "png"] },
  { slug: "image", name: "Image Tool", description: "Convert and resize images — PNG, JPEG, WebP, AVIF", category: "media", keywords: ["image", "convert", "resize", "png", "jpeg", "webp", "avif", "compress"] },
  { slug: "worldclock", name: "World Clock", description: "Live clocks for multiple timezones and overlap finder", category: "conversion", keywords: ["world clock", "timezone", "clock", "utc", "overlap", "meeting time"] },
  { slug: "ip", name: "IP Address", description: "View your public IP address, geolocation, and network info", category: "web", keywords: ["ip", "ip address", "my ip", "geolocation", "network"] },
  { slug: "dns", name: "DNS Lookup", description: "Look up DNS records for any domain", category: "web", keywords: ["dns", "lookup", "domain", "nameserver", "mx", "cname", "txt"] },
  { slug: "upload", name: "File Upload", description: "Upload, manage, and share files securely", category: "web", keywords: ["upload", "file", "share", "storage", "cloud"] },
];

const searchInput = document.getElementById("search");
const toolsList = document.getElementById("tools-list");

function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  const words = t.split(/[\s\-_/]+/);
  for (const w of words) { if (w.startsWith(q)) return 80; }
  if (t.includes(q)) return 60;
  let qi = 0, bonus = 0, last = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === last + 1) bonus += 5;
      last = ti;
      qi++;
    }
  }
  if (qi === q.length) return 30 + bonus;
  return 0;
}

function filterTools(query) {
  if (!query.trim()) return TOOLS;
  const q = query.trim();
  return TOOLS
    .map((tool) => {
      const nameScore = fuzzyScore(q, tool.name);
      const descScore = fuzzyScore(q, tool.description) * 0.5;
      const kwScore = Math.max(0, ...tool.keywords.map((k) => fuzzyScore(q, k) * 0.7));
      return { tool, score: Math.max(nameScore, descScore, kwScore) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.tool);
}

function render(query) {
  const filtered = filterTools(query || "");
  toolsList.innerHTML = "";

  if (filtered.length === 0) {
    toolsList.innerHTML = '<div class="no-results">No matching tools found</div>';
    return;
  }

  // Group by category
  const grouped = {};
  for (const tool of filtered) {
    if (!grouped[tool.category]) grouped[tool.category] = [];
    grouped[tool.category].push(tool);
  }

  // Render in category order
  for (const cat of CATEGORY_ORDER) {
    if (!grouped[cat]) continue;
    const group = document.createElement("div");
    group.className = "category-group";

    const label = document.createElement("div");
    label.className = "category-label";
    label.textContent = CATEGORY_LABELS[cat] || cat;
    group.appendChild(label);

    for (const tool of grouped[cat]) {
      const link = document.createElement("a");
      link.className = "tool-item";
      link.href = `${BASE_URL}/tools/${tool.slug}`;
      link.innerHTML = `
        <span class="tool-name">${escHtml(tool.name)}</span>
        <span class="tool-desc">${escHtml(tool.description)}</span>
      `;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: link.href });
      });
      group.appendChild(link);
    }

    toolsList.appendChild(group);
  }
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

searchInput.addEventListener("input", () => render(searchInput.value));
render("");
