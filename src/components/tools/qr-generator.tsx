"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, QrCode } from "lucide-react";
import { ToolLayout } from "@/components/layout/tool-layout";
import { ColorPicker } from "@/components/ui/color-picker";

// ── Types ────────────────────────────────────────────────────────────────────

type InputType = "url" | "wifi" | "vcard" | "email" | "sms" | "phone";
type ErrorCorrection = "L" | "M" | "Q" | "H";
type WifiEncryption = "WPA" | "WEP" | "nopass";

interface UrlFields {
  text: string;
}

interface WifiFields {
  ssid: string;
  password: string;
  encryption: WifiEncryption;
  hidden: boolean;
}

interface VcardFields {
  name: string;
  phone: string;
  email: string;
  org: string;
  title: string;
  url: string;
}

interface EmailFields {
  to: string;
  subject: string;
  body: string;
}

interface SmsFields {
  phone: string;
  message: string;
}

interface PhoneFields {
  phone: string;
}

// ── QR content builders ──────────────────────────────────────────────────────

function buildContent(type: InputType, fields: Record<string, string | boolean>): string {
  switch (type) {
    case "url": {
      const f = fields as unknown as UrlFields;
      return f.text;
    }
    case "wifi": {
      const f = fields as unknown as WifiFields;
      const enc = f.encryption === "nopass" ? "nopass" : f.encryption;
      const hidden = f.hidden ? ";H:true" : "";
      return `WIFI:T:${enc};S:${escapeWifi(f.ssid)};P:${escapeWifi(f.password)}${hidden};;`;
    }
    case "vcard": {
      const f = fields as unknown as VcardFields;
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f.name ? `FN:${f.name}` : "",
        f.phone ? `TEL:${f.phone}` : "",
        f.email ? `EMAIL:${f.email}` : "",
        f.org ? `ORG:${f.org}` : "",
        f.title ? `TITLE:${f.title}` : "",
        f.url ? `URL:${f.url}` : "",
        "END:VCARD",
      ].filter(Boolean);
      return lines.join("\n");
    }
    case "email": {
      const f = fields as unknown as EmailFields;
      const params: string[] = [];
      if (f.subject) params.push(`subject=${encodeURIComponent(f.subject)}`);
      if (f.body) params.push(`body=${encodeURIComponent(f.body)}`);
      return `mailto:${f.to}${params.length ? "?" + params.join("&") : ""}`;
    }
    case "sms": {
      const f = fields as unknown as SmsFields;
      return `smsto:${f.phone}:${f.message}`;
    }
    case "phone": {
      const f = fields as unknown as PhoneFields;
      return `tel:${f.phone}`;
    }
    default:
      return "";
  }
}

function escapeWifi(s: string): string {
  return s.replace(/[\\\";,:]/g, (c) => "\\" + c);
}

// ── Input form components ────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: "url", label: "Text / URL" },
  { value: "wifi", label: "WiFi" },
  { value: "vcard", label: "vCard" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "phone", label: "Phone" },
];

const EC_LEVELS: { value: ErrorCorrection; label: string; description: string }[] = [
  { value: "L", label: "L", description: "~7% recovery" },
  { value: "M", label: "M", description: "~15% recovery" },
  { value: "Q", label: "Q", description: "~25% recovery" },
  { value: "H", label: "H", description: "~30% recovery" },
];

export function QrGenerator() {
  const [inputType, setInputType] = useState<InputType>("url");
  const [fields, setFields] = useState<Record<string, string | boolean>>({ text: "" });
  const [exportSize, setExportSize] = useState(512);
  const [ecLevel, setEcLevel] = useState<ErrorCorrection>("M");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setField = useCallback((key: string, value: string | boolean) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTypeChange = useCallback((type: InputType) => {
    setInputType(type);
    // Reset fields for new type
    switch (type) {
      case "url":
        setFields({ text: "" });
        break;
      case "wifi":
        setFields({ ssid: "", password: "", encryption: "WPA", hidden: false });
        break;
      case "vcard":
        setFields({ name: "", phone: "", email: "", org: "", title: "", url: "" });
        break;
      case "email":
        setFields({ to: "", subject: "", body: "" });
        break;
      case "sms":
        setFields({ phone: "", message: "" });
        break;
      case "phone":
        setFields({ phone: "" });
        break;
    }
  }, []);

  const content = buildContent(inputType, fields);

  const DISPLAY_SIZE = 256;

  // Render QR to display canvas (fixed size)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!content.trim()) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      setError(null);
      return;
    }

    QRCode.toCanvas(canvas, content, {
      width: DISPLAY_SIZE,
      margin: 2,
      errorCorrectionLevel: ecLevel,
      color: {
        dark: fgColor,
        light: bgColor,
      },
    })
      .then(() => setError(null))
      .catch((err) => setError(err.message));
  }, [content, ecLevel, fgColor, bgColor]);

  const downloadPng = useCallback(async () => {
    if (!content.trim()) return;
    try {
      const offscreen = document.createElement("canvas");
      await QRCode.toCanvas(offscreen, content, {
        width: exportSize,
        margin: 2,
        errorCorrectionLevel: ecLevel,
        color: { dark: fgColor, light: bgColor },
      });
      const link = document.createElement("a");
      link.download = "qrcode.png";
      link.href = offscreen.toDataURL("image/png");
      link.click();
    } catch {
      // silently fail
    }
  }, [content, exportSize, ecLevel, fgColor, bgColor]);

  const downloadSvg = useCallback(async () => {
    if (!content.trim()) return;
    try {
      const svg = await QRCode.toString(content, {
        type: "svg",
        width: exportSize,
        margin: 2,
        errorCorrectionLevel: ecLevel,
        color: { dark: fgColor, light: bgColor },
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "qrcode.svg";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  }, [content, exportSize, ecLevel, fgColor, bgColor]);

  const copyToClipboard = useCallback(async () => {
    if (!content.trim()) return;
    try {
      const offscreen = document.createElement("canvas");
      await QRCode.toCanvas(offscreen, content, {
        width: exportSize,
        margin: 2,
        errorCorrectionLevel: ecLevel,
        color: { dark: fgColor, light: bgColor },
      });
      offscreen.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } catch {
      // silently fail
    }
  }, [content, exportSize, ecLevel, fgColor, bgColor]);

  const hasContent = content.trim().length > 0;

  return (
    <ToolLayout slug="qr">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: inputs */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Input type tabs */}
          <div>
            <div className="flex flex-wrap gap-1 p-1 border rounded-lg bg-muted/20 w-fit">
              {INPUT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTypeChange(t.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    inputType === t.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic fields */}
          <div className="space-y-3">
            {inputType === "url" && (
              <FieldRow label="Text or URL">
                <textarea
                  value={(fields.text as string) ?? ""}
                  onChange={(e) => setField("text", e.target.value)}
                  placeholder="https://example.com"
                  rows={4}
                  className={`${inputClass} resize-y font-mono`}
                />
              </FieldRow>
            )}

            {inputType === "wifi" && (
              <>
                <FieldRow label="Network Name (SSID)">
                  <input
                    type="text"
                    value={(fields.ssid as string) ?? ""}
                    onChange={(e) => setField("ssid", e.target.value)}
                    placeholder="MyNetwork"
                    className={inputClass}
                  />
                </FieldRow>
                <FieldRow label="Password">
                  <input
                    type="text"
                    value={(fields.password as string) ?? ""}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </FieldRow>
                <FieldRow label="Encryption">
                  <div className="flex gap-1 border rounded-lg p-0.5 w-fit">
                    {(["WPA", "WEP", "nopass"] as WifiEncryption[]).map((enc) => (
                      <button
                        key={enc}
                        onClick={() => setField("encryption", enc)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          fields.encryption === enc
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {enc === "nopass" ? "None" : enc}
                      </button>
                    ))}
                  </div>
                </FieldRow>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={(fields.hidden as boolean) ?? false}
                    onChange={(e) => setField("hidden", e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-muted-foreground">Hidden network</span>
                </label>
              </>
            )}

            {inputType === "vcard" && (
              <>
                <FieldRow label="Full Name">
                  <input type="text" value={(fields.name as string) ?? ""} onChange={(e) => setField("name", e.target.value)} placeholder="Jane Smith" className={inputClass} />
                </FieldRow>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Phone">
                    <input type="tel" value={(fields.phone as string) ?? ""} onChange={(e) => setField("phone", e.target.value)} placeholder="+1 555 000 0000" className={inputClass} />
                  </FieldRow>
                  <FieldRow label="Email">
                    <input type="email" value={(fields.email as string) ?? ""} onChange={(e) => setField("email", e.target.value)} placeholder="jane@example.com" className={inputClass} />
                  </FieldRow>
                  <FieldRow label="Organization">
                    <input type="text" value={(fields.org as string) ?? ""} onChange={(e) => setField("org", e.target.value)} placeholder="Acme Corp" className={inputClass} />
                  </FieldRow>
                  <FieldRow label="Title">
                    <input type="text" value={(fields.title as string) ?? ""} onChange={(e) => setField("title", e.target.value)} placeholder="Engineer" className={inputClass} />
                  </FieldRow>
                </div>
                <FieldRow label="Website">
                  <input type="url" value={(fields.url as string) ?? ""} onChange={(e) => setField("url", e.target.value)} placeholder="https://jane.dev" className={inputClass} />
                </FieldRow>
              </>
            )}

            {inputType === "email" && (
              <>
                <FieldRow label="To">
                  <input type="email" value={(fields.to as string) ?? ""} onChange={(e) => setField("to", e.target.value)} placeholder="recipient@example.com" className={inputClass} />
                </FieldRow>
                <FieldRow label="Subject">
                  <input type="text" value={(fields.subject as string) ?? ""} onChange={(e) => setField("subject", e.target.value)} placeholder="Hello" className={inputClass} />
                </FieldRow>
                <FieldRow label="Body">
                  <textarea value={(fields.body as string) ?? ""} onChange={(e) => setField("body", e.target.value)} placeholder="Message body..." rows={3} className={`${inputClass} resize-y`} />
                </FieldRow>
              </>
            )}

            {inputType === "sms" && (
              <>
                <FieldRow label="Phone Number">
                  <input type="tel" value={(fields.phone as string) ?? ""} onChange={(e) => setField("phone", e.target.value)} placeholder="+1 555 000 0000" className={inputClass} />
                </FieldRow>
                <FieldRow label="Message">
                  <textarea value={(fields.message as string) ?? ""} onChange={(e) => setField("message", e.target.value)} placeholder="Your message..." rows={3} className={`${inputClass} resize-y`} />
                </FieldRow>
              </>
            )}

            {inputType === "phone" && (
              <FieldRow label="Phone Number">
                <input type="tel" value={(fields.phone as string) ?? ""} onChange={(e) => setField("phone", e.target.value)} placeholder="+1 555 000 0000" className={inputClass} />
              </FieldRow>
            )}
          </div>

          {/* Customization */}
          <div className="space-y-4 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customization</p>

            {/* Export size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Export Size</label>
                <span className="text-xs font-mono text-muted-foreground">{exportSize}px</span>
              </div>
              <input
                type="range"
                min={128}
                max={2048}
                step={128}
                value={exportSize}
                onChange={(e) => setExportSize(Number(e.target.value))}
                className="w-full accent-foreground"
              />
            </div>

            {/* Error correction */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Error Correction</label>
              <div className="flex gap-1">
                {EC_LEVELS.map((ec) => (
                  <button
                    key={ec.value}
                    title={ec.description}
                    onClick={() => setEcLevel(ec.value)}
                    className={`flex-1 py-1 text-xs font-mono font-medium rounded-md border transition-colors ${
                      ecLevel === ec.value
                        ? "bg-foreground text-background border-foreground"
                        : "text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {ec.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {EC_LEVELS.find((e) => e.value === ecLevel)?.description}
              </p>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Foreground</label>
                <ColorPicker value={fgColor} onChange={setFgColor} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Background</label>
                <ColorPicker value={bgColor} onChange={setBgColor} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: QR preview */}
        <div className="lg:w-72 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-center p-4 rounded-xl border bg-muted/10 min-h-[280px]">
            {hasContent ? (
              <canvas
                ref={canvasRef}
                className="rounded-md"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="h-12 w-12 opacity-20" />
                <p className="text-xs">Enter content to generate a QR code</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-2">
            <button
              onClick={downloadPng}
              disabled={!hasContent}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <button
              onClick={downloadSvg}
              disabled={!hasContent}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4" />
              Download SVG
            </button>
            <button
              onClick={copyToClipboard}
              disabled={!hasContent}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy to Clipboard"}
            </button>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
