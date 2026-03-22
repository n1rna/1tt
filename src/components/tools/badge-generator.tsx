"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Check, ExternalLink, BookOpen } from "lucide-react";
import { ToolLayout } from "@/components/layout/tool-layout";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeStyle = "flat" | "flat-square" | "plastic" | "for-the-badge" | "social";

const STYLES: { value: BadgeStyle; label: string }[] = [
  { value: "flat", label: "flat" },
  { value: "flat-square", label: "flat-square" },
  { value: "plastic", label: "plastic" },
  { value: "for-the-badge", label: "for-the-badge" },
  { value: "social", label: "social" },
];

const NAMED_COLORS: { label: string; value: string; hex: string }[] = [
  { label: "brightgreen", value: "brightgreen", hex: "#4c1" },
  { label: "green", value: "green", hex: "#97ca00" },
  { label: "yellow", value: "yellow", hex: "#dfb317" },
  { label: "orange", value: "orange", hex: "#fe7d37" },
  { label: "red", value: "red", hex: "#e05d44" },
  { label: "blue", value: "blue", hex: "#007ec6" },
  { label: "lightgrey", value: "lightgrey", hex: "#9f9f9f" },
  { label: "grey", value: "grey", hex: "#555" },
];

// ── Encoding ──────────────────────────────────────────────────────────────────

// Encodes a badge segment using shields.io conventions:
//   space  → _
//   _      → __
//   -      → --
function encodeBadgeSegment(s: string): string {
  return s
    .replace(/_/g, "__")
    .replace(/-/g, "--")
    .replace(/ /g, "_");
}

// ── URL builder ───────────────────────────────────────────────────────────────

interface BadgeConfig {
  label: string;
  message: string;
  color: string;
  style: BadgeStyle;
  labelColor: string;
  logo: string;
  logoColor: string;
}

function buildBadgeUrl(config: BadgeConfig, base: string): string {
  const { label, message, color, style, labelColor, logo, logoColor } = config;

  const msgEncoded = encodeBadgeSegment(message || "badge");
  const colorEncoded = encodeBadgeSegment(color || "blue");

  let spec: string;
  if (label.trim()) {
    const labelEncoded = encodeBadgeSegment(label);
    spec = `${labelEncoded}-${msgEncoded}-${colorEncoded}`;
  } else {
    spec = `${msgEncoded}-${colorEncoded}`;
  }

  const params = new URLSearchParams();
  if (style !== "flat") params.set("style", style);
  if (labelColor && labelColor !== "grey" && labelColor !== "#555") {
    params.set("labelColor", labelColor.replace(/^#/, ""));
  }
  if (logo.trim()) params.set("logo", logo.trim());
  if (logoColor.trim()) params.set("logoColor", logoColor.trim().replace(/^#/, ""));

  const qs = params.toString();
  return `${base}/badge/${spec}.svg${qs ? "?" + qs : ""}`;
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silently fail
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border hover:bg-muted transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}

// ── Snippet row ───────────────────────────────────────────────────────────────

function SnippetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton text={value} />
      </div>
      <pre className="text-[11px] font-mono bg-muted/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
        {value}
      </pre>
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-1.5 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50";

// ── Color swatch picker ───────────────────────────────────────────────────────

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {NAMED_COLORS.map((c) => (
        <button
          key={c.value}
          title={c.label}
          onClick={() => onChange(c.value)}
          className={`w-5 h-5 rounded-sm border-2 transition-all ${
            value === c.value ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/50"
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BadgeGenerator() {
  const [label, setLabel] = useState("build");
  const [message, setMessage] = useState("passing");
  const [color, setColor] = useState("brightgreen");
  const [style, setStyle] = useState<BadgeStyle>("flat");
  const [labelColor, setLabelColor] = useState("grey");
  const [logo, setLogo] = useState("");
  const [logoColor, setLogoColor] = useState("");

  // The live preview URL (debounced to avoid hammering the backend while typing)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const origin = mounted ? window.location.origin : "";

  const config: BadgeConfig = { label, message, color, style, labelColor, logo, logoColor };
  const badgeUrl = mounted ? buildBadgeUrl(config, origin) : "";
  const shareUrl = badgeUrl;

  // Debounce preview updates
  useEffect(() => {
    if (!mounted) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewUrl(buildBadgeUrl(config, origin));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, message, color, style, labelColor, logo, logoColor, mounted]);

  const markdownSnippet = `![${label || message}](${shareUrl})`;
  const htmlSnippet = `<img src="${shareUrl}" alt="${label || message}">`;
  const rstSnippet = `.. image:: ${shareUrl}\n   :alt: ${label || message}`;

  return (
    <ToolLayout slug="badge">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Left: configuration ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Label + Message */}
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Label (left)">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="build"
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label="Message (right)">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="passing"
                className={inputClass}
              />
            </FieldRow>
          </div>

          {/* Style selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Style</label>
            <div className="flex flex-wrap gap-1 p-1 border rounded-lg bg-muted/20 w-fit">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    style === s.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Message color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="brightgreen or 4c1"
                className={`${inputClass} flex-1`}
              />
            </div>
            <ColorSwatches value={color} onChange={setColor} />
          </div>

          {/* Label color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Label color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
                placeholder="grey or 555"
                className={`${inputClass} flex-1`}
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {NAMED_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setLabelColor(c.value)}
                  className={`w-5 h-5 rounded-sm border-2 transition-all ${
                    labelColor === c.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:border-muted-foreground/50"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Logo fields */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <FieldRow label="Logo (simple-icons slug)">
              <input
                type="text"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="github"
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label="Logo color">
              <input
                type="text"
                value={logoColor}
                onChange={(e) => setLogoColor(e.target.value)}
                placeholder="white"
                className={inputClass}
              />
            </FieldRow>
          </div>
          <p className="text-xs text-muted-foreground -mt-3">
            Logo slugs from{" "}
            <a
              href="https://simpleicons.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground inline-flex items-center gap-0.5"
            >
              simpleicons.org <ExternalLink className="h-2.5 w-2.5" />
            </a>
            {" "}— logo rendering requires a future server-side integration.
          </p>
        </div>

        {/* ── Right: preview + snippets ── */}
        <div className="lg:w-80 flex flex-col gap-5">

          {/* Preview */}
          <div className="rounded-xl border bg-muted/10 p-5 flex flex-col gap-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Preview
            </p>
            <div className="flex items-center justify-center min-h-[48px] rounded-lg bg-muted/20 p-4">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={label || message}
                  className="max-w-full"
                  key={previewUrl}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Loading preview...</span>
              )}
            </div>

            {/* Badge URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Badge URL</span>
                <CopyButton text={shareUrl} />
              </div>
              <div className="text-[11px] font-mono bg-muted/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {shareUrl}
              </div>
            </div>
          </div>

          {/* llms.txt reference */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">For AI agents and coding assistants</p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Paste the llms.txt file into your AI assistant to let it generate badges automatically for your projects.
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <a
                href="/tools/badge/llms.txt"
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2"
              >
                <BookOpen className="h-3 w-3" />
                llms.txt
              </a>
              <CopyButton text={mounted ? `${origin}/tools/badge/llms.txt` : ""} label="Copy URL" />
            </div>
          </div>

        </div>
      </div>
    </ToolLayout>
  );
}
