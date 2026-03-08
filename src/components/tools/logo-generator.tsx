"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ToolLayout } from "@/components/layout/tool-layout";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Copy, Check, RotateCcw, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Lock, Unlock, Save, Share2, X, Link2 } from "lucide-react";
import {
  type HSVA,
  parseHex,
  formatHex,
  hsvaToRgba,
  rgbaToHsva,
  drawSVCanvas,
  contrastTextHex,
} from "@/lib/tools/color";

// ── Types ──────────────────────────────────────────────

type Shape = "square" | "circle" | "wide";
type ColorMode = "solid" | "gradient";
type GradientType = "linear" | "radial";
type BgMode = "solid" | "gradient" | "transparent";

interface GradientStop {
  id: string;
  position: number; // 0-100
  hex: string;
}

interface GradientConfig {
  type: GradientType;
  angle: number; // 0-360, linear only
  stops: GradientStop[];
}

interface ColorConfig {
  mode: ColorMode;
  hex: string;
  gradient: GradientConfig;
}

interface LogoConfig {
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  textColor: ColorConfig;
  bgMode: BgMode;
  bgColor: ColorConfig;
  paddingX: number;
  paddingY: number;
  borderRadius: number;
  shape: Shape;
}

// ── Constants ──────────────────────────────────────────

interface FontOption { value: string; label: string; google?: string }
interface FontGroup { label: string; fonts: FontOption[] }

const FONT_GROUPS: FontGroup[] = [
  {
    label: "Sans Serif",
    fonts: [
      { value: "Inter, sans-serif", label: "Inter", google: "Inter" },
      { value: "'Roboto', sans-serif", label: "Roboto", google: "Roboto" },
      { value: "'Open Sans', sans-serif", label: "Open Sans", google: "Open+Sans" },
      { value: "'Lato', sans-serif", label: "Lato", google: "Lato" },
      { value: "'Montserrat', sans-serif", label: "Montserrat", google: "Montserrat" },
      { value: "'Poppins', sans-serif", label: "Poppins", google: "Poppins" },
      { value: "'Nunito', sans-serif", label: "Nunito", google: "Nunito" },
      { value: "'Raleway', sans-serif", label: "Raleway", google: "Raleway" },
      { value: "'Work Sans', sans-serif", label: "Work Sans", google: "Work+Sans" },
      { value: "'DM Sans', sans-serif", label: "DM Sans", google: "DM+Sans" },
      { value: "'Plus Jakarta Sans', sans-serif", label: "Plus Jakarta Sans", google: "Plus+Jakarta+Sans" },
      { value: "'Manrope', sans-serif", label: "Manrope", google: "Manrope" },
      { value: "'Space Grotesk', sans-serif", label: "Space Grotesk", google: "Space+Grotesk" },
      { value: "'Outfit', sans-serif", label: "Outfit", google: "Outfit" },
      { value: "'Sora', sans-serif", label: "Sora", google: "Sora" },
      { value: "'Figtree', sans-serif", label: "Figtree", google: "Figtree" },
      { value: "'Geist', sans-serif", label: "Geist", google: "Geist" },
      { value: "'Oswald', sans-serif", label: "Oswald", google: "Oswald" },
      { value: "'Bebas Neue', sans-serif", label: "Bebas Neue", google: "Bebas+Neue" },
      { value: "Arial, Helvetica, sans-serif", label: "Arial" },
      { value: "system-ui, sans-serif", label: "System UI" },
    ],
  },
  {
    label: "Serif",
    fonts: [
      { value: "'Playfair Display', serif", label: "Playfair Display", google: "Playfair+Display" },
      { value: "'Merriweather', serif", label: "Merriweather", google: "Merriweather" },
      { value: "'Lora', serif", label: "Lora", google: "Lora" },
      { value: "'PT Serif', serif", label: "PT Serif", google: "PT+Serif" },
      { value: "'Libre Baskerville', serif", label: "Libre Baskerville", google: "Libre+Baskerville" },
      { value: "'Cormorant Garamond', serif", label: "Cormorant Garamond", google: "Cormorant+Garamond" },
      { value: "'Source Serif 4', serif", label: "Source Serif 4", google: "Source+Serif+4" },
      { value: "'DM Serif Display', serif", label: "DM Serif Display", google: "DM+Serif+Display" },
      { value: "'Fraunces', serif", label: "Fraunces", google: "Fraunces" },
      { value: "Georgia, serif", label: "Georgia" },
      { value: "'Times New Roman', serif", label: "Times New Roman" },
    ],
  },
  {
    label: "Monospace",
    fonts: [
      { value: "'JetBrains Mono', monospace", label: "JetBrains Mono", google: "JetBrains+Mono" },
      { value: "'Fira Code', monospace", label: "Fira Code", google: "Fira+Code" },
      { value: "'Source Code Pro', monospace", label: "Source Code Pro", google: "Source+Code+Pro" },
      { value: "'IBM Plex Mono', monospace", label: "IBM Plex Mono", google: "IBM+Plex+Mono" },
      { value: "'Space Mono', monospace", label: "Space Mono", google: "Space+Mono" },
      { value: "'Roboto Mono', monospace", label: "Roboto Mono", google: "Roboto+Mono" },
      { value: "ui-monospace, 'SF Mono', monospace", label: "SF Mono" },
      { value: "'Courier New', monospace", label: "Courier New" },
    ],
  },
  {
    label: "Display",
    fonts: [
      { value: "'Abril Fatface', serif", label: "Abril Fatface", google: "Abril+Fatface" },
      { value: "'Righteous', sans-serif", label: "Righteous", google: "Righteous" },
      { value: "'Archivo Black', sans-serif", label: "Archivo Black", google: "Archivo+Black" },
      { value: "'Anton', sans-serif", label: "Anton", google: "Anton" },
      { value: "'Bungee', sans-serif", label: "Bungee", google: "Bungee" },
      { value: "'Fredoka', sans-serif", label: "Fredoka", google: "Fredoka" },
      { value: "'Comfortaa', sans-serif", label: "Comfortaa", google: "Comfortaa" },
      { value: "'Pacifico', cursive", label: "Pacifico", google: "Pacifico" },
      { value: "'Permanent Marker', cursive", label: "Permanent Marker", google: "Permanent+Marker" },
      { value: "'Satisfy', cursive", label: "Satisfy", google: "Satisfy" },
      { value: "'Lobster', cursive", label: "Lobster", google: "Lobster" },
      { value: "'Dancing Script', cursive", label: "Dancing Script", google: "Dancing+Script" },
      { value: "'Caveat', cursive", label: "Caveat", google: "Caveat" },
    ],
  },
];

const ALL_FONTS = FONT_GROUPS.flatMap((g) => g.fonts);

const SIZE_PRESETS = [
  { label: "16", size: 16 },
  { label: "32", size: 32 },
  { label: "48", size: 48 },
  { label: "180", size: 180 },
  { label: "512", size: 512 },
  { label: "1024", size: 1024 },
];

function makeGradient(stops: [string, number][], type: GradientType = "linear", angle = 135): GradientConfig {
  return {
    type,
    angle,
    stops: stops.map(([hex, position]) => ({ id: crypto.randomUUID(), hex, position })),
  };
}

function makeSolidColor(hex: string): ColorConfig {
  return {
    mode: "solid",
    hex,
    gradient: makeGradient([["#ffffff", 0], ["#000000", 100]]),
  };
}

function makeGradientColor(stops: [string, number][], type: GradientType = "linear", angle = 135): ColorConfig {
  return {
    mode: "gradient",
    hex: stops[0][0],
    gradient: makeGradient(stops, type, angle),
  };
}

const DEFAULT_CONFIG: LogoConfig = {
  text: "12.",
  fontFamily: "Inter, system-ui, sans-serif",
  fontWeight: 700,
  fontSize: 120,
  letterSpacing: -4,
  textColor: makeSolidColor("#ffffff"),
  bgMode: "solid",
  bgColor: makeSolidColor("#000000"),
  paddingX: 40,
  paddingY: 20,
  borderRadius: 0,
  shape: "square",
};

// ── Serialization & Persistence ────────────────────────

/** Compact config for serialization — strips gradient stop ids */
interface SerializableGradientStop { p: number; h: string }
interface SerializableGradient { t: GradientType; a: number; s: SerializableGradientStop[] }
interface SerializableColor { m: ColorMode; h: string; g: SerializableGradient }
interface SerializableConfig {
  t: string; ff: string; fw: number; fs: number; ls: number;
  tc: SerializableColor; bm: BgMode; bc: SerializableColor;
  px: number; py: number; br: number; sh: Shape;
}

function serializeConfig(c: LogoConfig): SerializableConfig {
  const serColor = (cc: ColorConfig): SerializableColor => ({
    m: cc.mode, h: cc.hex,
    g: {
      t: cc.gradient.type, a: cc.gradient.angle,
      s: cc.gradient.stops.map((s) => ({ p: s.position, h: s.hex })),
    },
  });
  return {
    t: c.text, ff: c.fontFamily, fw: c.fontWeight, fs: c.fontSize, ls: c.letterSpacing,
    tc: serColor(c.textColor), bm: c.bgMode, bc: serColor(c.bgColor),
    px: c.paddingX, py: c.paddingY, br: c.borderRadius, sh: c.shape,
  };
}

function deserializeConfig(s: SerializableConfig): LogoConfig {
  const deserColor = (sc: SerializableColor): ColorConfig => ({
    mode: sc.m, hex: sc.h,
    gradient: {
      type: sc.g.t, angle: sc.g.a,
      stops: sc.g.s.map((st) => ({ id: crypto.randomUUID(), position: st.p, hex: st.h })),
    },
  });
  return {
    text: s.t, fontFamily: s.ff, fontWeight: s.fw, fontSize: s.fs, letterSpacing: s.ls,
    textColor: deserColor(s.tc), bgMode: s.bm, bgColor: deserColor(s.bc),
    paddingX: s.px, paddingY: s.py, borderRadius: s.br, shape: s.sh,
  };
}

function encodeConfig(c: LogoConfig): string {
  const json = JSON.stringify(serializeConfig(c));
  return btoa(json);
}

function decodeConfig(encoded: string): LogoConfig | null {
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json);
    return deserializeConfig(parsed);
  } catch {
    return null;
  }
}

const SAVED_LOGOS_KEY = "1two-saved-logos";

interface SavedLogo {
  id: string;
  name: string;
  config: SerializableConfig;
  createdAt: number;
}

function loadSavedLogos(): SavedLogo[] {
  try {
    const data = localStorage.getItem(SAVED_LOGOS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function persistSavedLogos(logos: SavedLogo[]) {
  localStorage.setItem(SAVED_LOGOS_KEY, JSON.stringify(logos));
}

// ── Color Presets ──────────────────────────────────────

interface ColorPreset {
  label: string;
  textColor: ColorConfig;
  bgMode: BgMode;
  bgColor: ColorConfig;
}

const COLOR_PRESETS: ColorPreset[] = [
  {
    label: "Classic Dark",
    textColor: makeSolidColor("#ffffff"),
    bgMode: "solid",
    bgColor: makeSolidColor("#000000"),
  },
  {
    label: "Classic Light",
    textColor: makeSolidColor("#000000"),
    bgMode: "solid",
    bgColor: makeSolidColor("#ffffff"),
  },
  {
    label: "Blue Brand",
    textColor: makeSolidColor("#ffffff"),
    bgMode: "solid",
    bgColor: makeSolidColor("#3b82f6"),
  },
  {
    label: "Purple Brand",
    textColor: makeSolidColor("#ffffff"),
    bgMode: "solid",
    bgColor: makeSolidColor("#8b5cf6"),
  },
  {
    label: "Coral Warm",
    textColor: makeSolidColor("#ffffff"),
    bgMode: "solid",
    bgColor: makeSolidColor("#ff6b6b"),
  },
  {
    label: "Dark Red",
    textColor: makeSolidColor("#fef3c7"),
    bgMode: "solid",
    bgColor: makeSolidColor("#7f1d1d"),
  },
  {
    label: "Teal Cool",
    textColor: makeSolidColor("#ffffff"),
    bgMode: "solid",
    bgColor: makeSolidColor("#14b8a6"),
  },
  {
    label: "Navy Cool",
    textColor: makeSolidColor("#bae6fd"),
    bgMode: "solid",
    bgColor: makeSolidColor("#0f172a"),
  },
  {
    label: "Sunset",
    textColor: makeSolidColor("#ffffff"),
    bgMode: "gradient",
    bgColor: makeGradientColor([["#f97316", 0], ["#ec4899", 100]], "linear", 135),
  },
  {
    label: "Ocean",
    textColor: makeSolidColor("#ffffff"),
    bgMode: "gradient",
    bgColor: makeGradientColor([["#3b82f6", 0], ["#14b8a6", 100]], "linear", 135),
  },
  {
    label: "Midnight",
    textColor: makeSolidColor("#e0e7ff"),
    bgMode: "gradient",
    bgColor: makeGradientColor([["#7c3aed", 0], ["#1e1b4b", 100]], "linear", 135),
  },
  {
    label: "Neon",
    textColor: makeSolidColor("#000000"),
    bgMode: "gradient",
    bgColor: makeGradientColor([["#22c55e", 0], ["#06b6d4", 100]], "linear", 135),
  },
];

// ── Color Utilities ────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const rgba = parseHex(hex);
  if (!rgba) return { r: 0, g: 0, b: 0 };
  return { r: rgba.r, g: rgba.g, b: rgba.b };
}

function gradientCss(gradient: GradientConfig): string {
  const stops = [...gradient.stops].sort((a, b) => a.position - b.position);
  const stopStr = stops.map((s) => `${s.hex} ${s.position}%`).join(", ");
  if (gradient.type === "radial") {
    return `radial-gradient(circle, ${stopStr})`;
  }
  return `linear-gradient(${gradient.angle}deg, ${stopStr})`;
}

function buildSvgGradient(id: string, gradient: GradientConfig, w: number, h: number): string {
  const stops = [...gradient.stops].sort((a, b) => a.position - b.position);
  const stopEls = stops
    .map((s) => `    <stop offset="${s.position}%" stop-color="${s.hex}"/>`)
    .join("\n");

  if (gradient.type === "radial") {
    return `  <radialGradient id="${id}" cx="50%" cy="50%" r="50%" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="${h}">\n${stopEls}\n  </radialGradient>`;
  }

  const angle = gradient.angle;
  const rad = (angle - 90) * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = w / 2;
  const halfH = h / 2;
  const len = Math.abs(halfW * cos) + Math.abs(halfH * sin);
  const x1 = halfW - len * cos;
  const y1 = halfH - len * sin;
  const x2 = halfW + len * cos;
  const y2 = halfH + len * sin;

  return `  <linearGradient id="${id}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" gradientUnits="userSpaceOnUse">\n${stopEls}\n  </linearGradient>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function checkerboard(): string {
  return `repeating-conic-gradient(rgba(128,128,128,0.18) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px`;
}

// ── Color Generation ───────────────────────────────────

function randomHue(): number {
  return Math.random() * 360;
}

function hsvToHex(h: number, s: number, v: number): string {
  return formatHex(hsvaToRgba({ h, s, v, a: 1 }));
}

function generateRandomSolidHex(): string {
  const h = randomHue();
  const s = 0.4 + Math.random() * 0.5; // 0.4-0.9
  const v = 0.4 + Math.random() * 0.5; // 0.4-0.9
  return hsvToHex(h, s, v);
}

function generateRandomSolid(): ColorConfig {
  return makeSolidColor(generateRandomSolidHex());
}

function generateRandomGradient(): ColorConfig {
  const h1 = randomHue();
  // Second hue: 30-120 degrees offset for pleasing gradients
  const offset = 30 + Math.random() * 90;
  const h2 = (h1 + offset) % 360;
  const s1 = 0.5 + Math.random() * 0.4;
  const s2 = 0.5 + Math.random() * 0.4;
  const v1 = 0.5 + Math.random() * 0.4;
  const v2 = 0.5 + Math.random() * 0.4;
  const hex1 = hsvToHex(h1, s1, v1);
  const hex2 = hsvToHex(h2, s2, v2);
  const angle = Math.round(Math.random() * 360);
  return makeGradientColor([[hex1, 0], [hex2, 100]], "linear", angle);
}

/** Generate a ColorConfig respecting the current mode (solid vs gradient) */
function generateColorConfig(mode: ColorMode): ColorConfig {
  return mode === "gradient" ? generateRandomGradient() : generateRandomSolid();
}

/** Get a contrasting text color for a given bg */
function generateContrastText(bgConfig: ColorConfig, bgMode: BgMode): ColorConfig {
  let refHex: string;
  if (bgMode === "transparent") {
    // For transparent bg, just pick a random color
    return generateRandomSolid();
  }
  if (bgConfig.mode === "gradient" && bgConfig.gradient.stops.length > 0) {
    // Use the midpoint stop or first stop as reference
    const sorted = [...bgConfig.gradient.stops].sort((a, b) => a.position - b.position);
    const mid = sorted[Math.floor(sorted.length / 2)];
    refHex = mid.hex;
  } else {
    refHex = bgConfig.hex;
  }
  const contrast = contrastTextHex(refHex);
  return makeSolidColor(contrast);
}

// ── SVG Builder ────────────────────────────────────────

function buildSvg(config: LogoConfig, exportW?: number, exportH?: number): string {
  const {
    text, fontFamily, fontWeight, fontSize, letterSpacing,
    textColor, bgMode, bgColor, paddingX, paddingY, borderRadius, shape,
  } = config;

  const isWide = shape === "wide";
  const isCircle = shape === "circle";

  // Rough text width estimation (canvas would be more accurate but SVG works for layout)
  const charWidth = fontSize * 0.62;
  const spacingPx = letterSpacing * Math.max(text.length - 1, 0);
  const textWidth = text.length * charWidth + spacingPx;
  const textHeight = fontSize;

  let naturalW = Math.ceil(textWidth + paddingX * 2);
  let naturalH = Math.ceil(textHeight + paddingY * 2);

  if (isWide) {
    // 2:1
    naturalW = Math.max(naturalW, naturalH * 2);
    naturalH = Math.ceil(naturalW / 2);
  } else {
    // 1:1 — make a square from the larger dimension
    const sq = Math.max(naturalW, naturalH);
    naturalW = sq;
    naturalH = sq;
  }

  const vw = exportW ?? naturalW;
  const vh = exportH ?? naturalH;

  // Determine fill references
  const defs: string[] = [];
  const clipId = isCircle ? "circleClip" : null;

  let textFill: string;
  if (textColor.mode === "gradient") {
    defs.push(buildSvgGradient("textGrad", textColor.gradient, naturalW, naturalH));
    textFill = "url(#textGrad)";
  } else {
    textFill = textColor.hex;
  }

  let bgFill: string = "";
  if (bgMode === "solid") {
    bgFill = bgColor.hex;
  } else if (bgMode === "gradient") {
    defs.push(buildSvgGradient("bgGrad", bgColor.gradient, naturalW, naturalH));
    bgFill = "url(#bgGrad)";
  }

  if (isCircle) {
    const cx = naturalW / 2;
    const cy = naturalH / 2;
    const r = Math.min(cx, cy);
    defs.push(`  <clipPath id="circleClip">\n    <circle cx="${cx}" cy="${cy}" r="${r}"/>\n  </clipPath>`);
  }

  const defsBlock = defs.length > 0 ? `<defs>\n${defs.join("\n")}\n</defs>\n` : "";

  let bgEl = "";
  if (bgMode !== "transparent") {
    if (isCircle) {
      const cx = naturalW / 2;
      const cy = naturalH / 2;
      const r = Math.min(cx, cy);
      bgEl = `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgFill}"/>`;
    } else {
      const rx = borderRadius > 0 ? borderRadius : 0;
      bgEl = `  <rect width="${naturalW}" height="${naturalH}" rx="${rx}" fill="${bgFill}"/>`;
    }
  }

  const clipAttr = clipId ? ` clip-path="url(#${clipId})"` : "";

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${naturalW} ${naturalH}" width="${vw}" height="${vh}">
${defsBlock}${bgEl ? bgEl + "\n" : ""}  <text${clipAttr}
    x="50%"
    y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    fill="${textFill}"
    font-family="${fontFamily}"
    font-weight="${fontWeight}"
    font-size="${fontSize}"
    letter-spacing="${letterSpacing}"
  >${escapeXml(text)}</text>
</svg>`;

  return svgContent;
}

// ── PNG Export ─────────────────────────────────────────

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function svgToPngBlob(config: LogoConfig, size: number): Promise<Blob> {
  const { shape } = config;
  const isWide = shape === "wide";
  const isCircle = shape === "circle";
  const canvasW = isWide ? size * 2 : size;
  const canvasH = size;

  const svg = buildSvg(config, canvasW, canvasH);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      // The SVG already contains the correct shape (rounded rect, circle clip, etc.)
      // so we just draw it directly — no extra canvas clipping needed.
      ctx.drawImage(img, 0, 0, canvasW, canvasH);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/png"
      );
    };
    img.onerror = reject;
    img.src = svgToDataUrl(svg);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}

// ── Local Color Picker Components ─────────────────────

function SVPicker({ hsva, onChange }: { hsva: HSVA; onChange: (s: number, v: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawSVCanvas(ctx, hsva.h, canvas.width, canvas.height);
  }, [hsva.h]);

  const pick = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      onChange(
        Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
      );
    },
    [onChange]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden cursor-crosshair border border-border/50"
      style={{ aspectRatio: "1 / 1" }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => dragging.current && pick(e.clientX, e.clientY)}
      onPointerUp={() => { dragging.current = false; }}
    >
      <canvas ref={canvasRef} width={200} height={200} className="w-full h-full" />
      <div
        className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)] pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%` }}
      />
    </div>
  );
}

function HueSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  return (
    <input
      type="range" min={0} max={360} step={1} value={hue}
      onChange={(e) => onChange(Number(e.target.value))}
      className="color-slider w-full h-3 rounded-lg appearance-none cursor-pointer"
      style={{ background: `linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))` }}
    />
  );
}

interface MiniPickerProps {
  hex: string;
  onChange: (hex: string) => void;
}

function MiniColorPicker({ hex, onChange }: MiniPickerProps) {
  const rgba = useMemo(() => parseHex(hex) ?? { r: 0, g: 0, b: 0, a: 1 }, [hex]);
  const [hsva, setHsva] = useState<HSVA>(() => rgbaToHsva(rgba));
  const [hexInput, setHexInput] = useState(hex);
  const skipSync = useRef(false);

  // Sync hsva → hex output
  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    const newRgba = hsvaToRgba(hsva);
    const newHex = formatHex(newRgba);
    setHexInput(newHex);
    onChange(newHex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsva]);

  // Sync incoming hex changes to hsva (e.g., from presets)
  useEffect(() => {
    const parsed = parseHex(hex);
    if (!parsed) return;
    const newHsva = rgbaToHsva(parsed);
    skipSync.current = true;
    setHsva(newHsva);
    setHexInput(hex);
  }, [hex]);

  const commitHex = useCallback(() => {
    const parsed = parseHex(hexInput);
    if (parsed) {
      skipSync.current = true;
      const newHsva = rgbaToHsva(parsed);
      setHsva(newHsva);
      onChange(formatHex(parsed));
    } else {
      setHexInput(hex);
    }
  }, [hexInput, hex, onChange]);

  return (
    <div className="space-y-2 pt-1">
      <SVPicker hsva={hsva} onChange={(s, v) => setHsva((p) => ({ ...p, s, v }))} />
      <HueSlider hue={hsva.h} onChange={(h) => setHsva((p) => ({ ...p, h }))} />
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md border border-border/50 shrink-0"
          style={{ background: hex }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => e.key === "Enter" && commitHex()}
          className="flex-1 rounded-md border bg-transparent px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ── Gradient Builder ───────────────────────────────────

interface GradientBuilderProps {
  gradient: GradientConfig;
  onChange: (g: GradientConfig) => void;
}

function GradientBuilder({ gradient, onChange }: GradientBuilderProps) {
  const [activeStop, setActiveStop] = useState<string | null>(null);

  const sortedStops = useMemo(
    () => [...gradient.stops].sort((a, b) => a.position - b.position),
    [gradient.stops]
  );

  const updateStop = useCallback(
    (id: string, patch: Partial<GradientStop>) => {
      onChange({
        ...gradient,
        stops: gradient.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      });
    },
    [gradient, onChange]
  );

  const addStop = useCallback(() => {
    if (gradient.stops.length >= 5) return;
    const positions = gradient.stops.map((s) => s.position);
    const maxPos = Math.max(...positions);
    const newPos = Math.min(100, maxPos + 20);
    const newStop: GradientStop = { id: crypto.randomUUID(), position: newPos, hex: "#888888" };
    onChange({ ...gradient, stops: [...gradient.stops, newStop] });
  }, [gradient, onChange]);

  const removeStop = useCallback(
    (id: string) => {
      if (gradient.stops.length <= 2) return;
      onChange({ ...gradient, stops: gradient.stops.filter((s) => s.id !== id) });
      if (activeStop === id) setActiveStop(null);
    },
    [gradient, onChange, activeStop]
  );

  const cssPreview = gradientCss(gradient);

  return (
    <div className="space-y-3">
      {/* Type + Angle */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border overflow-hidden shrink-0">
          {(["linear", "radial"] as GradientType[]).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...gradient, type: t })}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                gradient.type === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {t === "linear" ? "Linear" : "Radial"}
            </button>
          ))}
        </div>
        {gradient.type === "linear" && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">{gradient.angle}°</span>
            <input
              type="range" min={0} max={360} step={1} value={gradient.angle}
              onChange={(e) => onChange({ ...gradient, angle: Number(e.target.value) })}
              className="color-slider flex-1 h-2.5 rounded-lg appearance-none cursor-pointer bg-muted"
            />
          </div>
        )}
      </div>

      {/* Gradient bar */}
      <div
        className="h-6 rounded-md border border-border/50 cursor-pointer relative"
        style={{ background: cssPreview }}
      />

      {/* Stops */}
      <div className="space-y-1.5">
        {sortedStops.map((stop) => (
          <div key={stop.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                className={`w-6 h-6 rounded-md border-2 shrink-0 transition-all ${
                  activeStop === stop.id ? "border-ring" : "border-border/50"
                }`}
                style={{ background: stop.hex }}
                onClick={() => setActiveStop(activeStop === stop.id ? null : stop.id)}
                title="Click to edit stop color"
              />
              <input
                type="range" min={0} max={100} step={1} value={stop.position}
                onChange={(e) => updateStop(stop.id, { position: Number(e.target.value) })}
                className="color-slider flex-1 h-2.5 rounded-lg appearance-none cursor-pointer"
                style={{ background: gradientCss(gradient) }}
              />
              <span className="text-[11px] font-mono text-muted-foreground w-8 text-right shrink-0">
                {stop.position}%
              </span>
              <button
                onClick={() => removeStop(stop.id)}
                disabled={gradient.stops.length <= 2}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            {activeStop === stop.id && (
              <div className="pl-8 pr-8">
                <MiniColorPicker
                  hex={stop.hex}
                  onChange={(h) => updateStop(stop.id, { hex: h })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addStop}
        disabled={gradient.stops.length >= 5}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
      >
        <Plus className="h-3 w-3" /> Add stop
      </button>
    </div>
  );
}

// ── Color Control Panel ────────────────────────────────

interface ColorControlProps {
  label: string;
  colorConfig: ColorConfig;
  onChange: (c: ColorConfig) => void;
  allowTransparent?: boolean;
  isTransparent?: boolean;
  onTransparentToggle?: (v: boolean) => void;
  bgMode?: BgMode;
  onBgModeChange?: (m: BgMode) => void;
  onGenerate?: () => void;
  locked?: boolean;
  onLockToggle?: () => void;
}

function ColorControl({
  label,
  colorConfig,
  onChange,
  allowTransparent = false,
  bgMode,
  onBgModeChange,
  onGenerate,
  locked = false,
  onLockToggle,
}: ColorControlProps) {
  const [expanded, setExpanded] = useState(false);

  const effectiveMode = bgMode ?? (colorConfig.mode === "gradient" ? "gradient" : "solid");
  const isTransparent = bgMode === "transparent";

  const swatchBg = useMemo(() => {
    if (isTransparent) return checkerboard();
    if (colorConfig.mode === "gradient") return gradientCss(colorConfig.gradient);
    return colorConfig.hex;
  }, [isTransparent, colorConfig]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground flex-1">{label}</span>
        {/* Lock toggle */}
        {onLockToggle && (
          <button
            onClick={onLockToggle}
            className={`p-1 rounded transition-colors ${locked ? "text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"}`}
            title={locked ? "Locked — won't change on generate" : "Unlocked — will change on generate"}
          >
            {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
        )}
        {/* Generate button */}
        {onGenerate && !isTransparent && (
          <button
            onClick={onGenerate}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Generate random color"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
        {/* Mode pills */}
        <div className="flex rounded-md border overflow-hidden text-[10px]">
          {allowTransparent ? (
            <>
              {(["solid", "gradient", "transparent"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onBgModeChange?.(m)}
                  className={`px-2 py-0.5 font-medium transition-colors capitalize ${
                    effectiveMode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {m === "transparent" ? "None" : m}
                </button>
              ))}
            </>
          ) : (
            <>
              {(["solid", "gradient"] as ColorMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ ...colorConfig, mode: m })}
                  className={`px-2 py-0.5 font-medium transition-colors capitalize ${
                    colorConfig.mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </>
          )}
        </div>
        {/* Swatch toggle */}
        {!isTransparent && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 shrink-0"
          >
            <div
              className="w-6 h-6 rounded-md border border-border/50 shrink-0"
              style={{ background: swatchBg }}
            />
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      {expanded && !isTransparent && (
        <div className="pl-2 border-l border-border/50 space-y-2">
          {colorConfig.mode === "solid" ? (
            <MiniColorPicker
              hex={colorConfig.hex}
              onChange={(h) => onChange({ ...colorConfig, hex: h })}
            />
          ) : (
            <GradientBuilder
              gradient={colorConfig.gradient}
              onChange={(g) => onChange({ ...colorConfig, gradient: g })}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function LogoGenerator() {
  const [config, setConfig] = useState<LogoConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [textLocked, setTextLocked] = useState(false);
  const [bgLocked, setBgLocked] = useState(false);
  const [savedLogos, setSavedLogos] = useState<SavedLogo[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load saved logos + URL config on mount
  useEffect(() => {
    setMounted(true);
    setSavedLogos(loadSavedLogos());
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("c");
    if (encoded) {
      const decoded = decodeConfig(encoded);
      if (decoded) setConfig(decoded);
    }
  }, []);

  // Load Google Font when font changes
  useEffect(() => {
    const font = ALL_FONTS.find((f) => f.value === config.fontFamily);
    if (!font?.google) return;
    const id = `gfont-${font.google}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  }, [config.fontFamily]);

  const svg = useMemo(() => buildSvg(config), [config]);

  const update = useCallback(<K extends keyof LogoConfig>(key: K, value: LogoConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCopySvg = useCallback(async () => {
    await navigator.clipboard.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [svg]);

  const handleDownloadSvg = useCallback(() => {
    downloadText(svg, "logo.svg", "image/svg+xml");
  }, [svg]);

  const handleDownloadPng = useCallback(
    async (size: number) => {
      setExporting(`png-${size}`);
      try {
        const blob = await svgToPngBlob(config, size);
        const suffix = config.shape === "wide" ? `${size * 2}x${size}` : `${size}x${size}`;
        downloadBlob(blob, `logo-${suffix}.png`);
      } finally {
        setExporting(null);
      }
    },
    [config]
  );

  const handleDownloadFavicon = useCallback(async () => {
    setExporting("ico");
    try {
      const blob = await svgToPngBlob(config, 32);
      downloadBlob(blob, "favicon.png");
    } finally {
      setExporting(null);
    }
  }, [config]);

  const applyPreset = useCallback((preset: ColorPreset) => {
    setConfig((prev) => ({
      ...prev,
      textColor: preset.textColor,
      bgMode: preset.bgMode,
      bgColor: preset.bgColor,
    }));
  }, []);

  const handleGenerateText = useCallback(() => {
    const mode = config.textColor.mode;
    setConfig((prev) => ({ ...prev, textColor: generateColorConfig(mode) }));
  }, [config.textColor.mode]);

  const handleGenerateBg = useCallback(() => {
    if (config.bgMode === "transparent") return;
    const mode = config.bgColor.mode;
    setConfig((prev) => ({ ...prev, bgColor: generateColorConfig(mode) }));
  }, [config.bgColor.mode, config.bgMode]);

  const handleGenerateAll = useCallback(() => {
    setConfig((prev) => {
      let next = { ...prev };

      // Generate bg first (if unlocked) so we can derive text contrast
      if (!bgLocked && prev.bgMode !== "transparent") {
        next.bgColor = generateColorConfig(prev.bgColor.mode);
      }

      if (!textLocked) {
        // Auto-contrast: if text is solid, pick a contrasting color
        if (prev.textColor.mode === "solid") {
          next.textColor = generateContrastText(next.bgColor, next.bgMode);
        } else {
          next.textColor = generateColorConfig("gradient");
        }
      }

      return next;
    });
  }, [textLocked, bgLocked]);

  const handleSaveLogo = useCallback(() => {
    const name = config.text || "Logo";
    const saved: SavedLogo = {
      id: crypto.randomUUID(),
      name,
      config: serializeConfig(config),
      createdAt: Date.now(),
    };
    const updated = [saved, ...savedLogos];
    setSavedLogos(updated);
    persistSavedLogos(updated);
  }, [config, savedLogos]);

  const handleLoadLogo = useCallback((saved: SavedLogo) => {
    setConfig(deserializeConfig(saved.config));
  }, []);

  const handleDeleteLogo = useCallback((id: string) => {
    const updated = savedLogos.filter((l) => l.id !== id);
    setSavedLogos(updated);
    persistSavedLogos(updated);
  }, [savedLogos]);

  const handleShareLink = useCallback(async () => {
    const encoded = encodeConfig(config);
    const url = `${window.location.origin}${window.location.pathname}?c=${encoded}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [config]);

  const previewBg = useMemo(() => {
    if (config.bgMode === "transparent") return checkerboard();
    if (config.bgMode === "gradient") return gradientCss(config.bgColor.gradient);
    return config.bgColor.hex;
  }, [config.bgMode, config.bgColor]);

  const weightLabel = useMemo(() => {
    const map: Record<number, string> = {
      100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
      500: "Medium", 600: "Semibold", 700: "Bold", 800: "ExtraBold", 900: "Black",
    };
    return map[config.fontWeight] ?? String(config.fontWeight);
  }, [config.fontWeight]);

  return (
    <ToolLayout slug="logo">
      <div className="flex flex-col lg:flex-row h-full gap-0 overflow-hidden">
        {/* ── Left: Export + Preview ─────────────────────── */}
        <div className="flex flex-col lg:flex-1 min-w-0 border-b lg:border-b-0 lg:border-r">
          {/* Export buttons */}
          <div className="border-b p-2.5 flex flex-wrap gap-1.5 bg-background/80 backdrop-blur-sm shrink-0">
            <button
              onClick={handleDownloadSvg}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> SVG
            </button>
            <button
              onClick={handleCopySvg}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy SVG"}
            </button>
            <button
              onClick={handleDownloadFavicon}
              disabled={exporting === "ico"}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Favicon
            </button>
            <div className="h-5 w-px bg-border self-center mx-0.5" />
            <button
              onClick={handleSaveLogo}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              title="Save logo config"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button
              onClick={handleShareLink}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              title="Copy shareable link"
            >
              {linkCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
              {linkCopied ? "Copied!" : "Share"}
            </button>
            <div className="h-5 w-px bg-border self-center mx-0.5" />
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.size}
                onClick={() => handleDownloadPng(p.size)}
                disabled={exporting === `png-${p.size}`}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {p.label}
              </button>
            ))}
          </div>

          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden" style={{ background: checkerboard() }}>
            <div
              className="overflow-hidden flex items-center justify-center shadow-xl"
              style={{
                background: previewBg,
                borderRadius: config.shape === "circle"
                  ? "50%"
                  : `${config.borderRadius}px`,
                aspectRatio: config.shape === "wide" ? "2 / 1" : "1 / 1",
                maxWidth: config.shape === "wide" ? "480px" : "260px",
                width: "100%",
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: svg }}
                className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
              />
            </div>
          </div>
        </div>

        {/* ── Right: Controls ───────────────────────────── */}
        <div className="w-full lg:w-72 xl:w-80 overflow-y-auto shrink-0 bg-background">
          <div className="p-4 space-y-5">
            {/* ── Text ── */}
            <Section label="Text">
              <input
                type="text"
                value={config.text}
                onChange={(e) => update("text", e.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="12."
              />
            </Section>

            {/* ── Shape ── */}
            <Section label="Shape">
              <div className="flex rounded-md border overflow-hidden">
                {([
                  { value: "square", label: "Square" },
                  { value: "circle", label: "Circle" },
                  { value: "wide", label: "Wide" },
                ] as { value: Shape; label: string }[]).map((s) => (
                  <button
                    key={s.value}
                    onClick={() => update("shape", s.value)}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      config.shape === s.value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* ── Typography ── */}
            <Section label="Typography">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                <Select value={config.fontFamily} onValueChange={(v: string | null) => { if (v) update("fontFamily", v); }}>
                  <SelectTrigger className="w-full text-xs h-8">
                    <SelectValue placeholder="Choose font" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {FONT_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </SelectLabel>
                        {group.fonts.map((f) => (
                          <SelectItem key={f.value} value={f.value} className="text-xs">
                            <span style={{ fontFamily: f.value }}>{f.label}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => {
                    const font = ALL_FONTS[Math.floor(Math.random() * ALL_FONTS.length)];
                    update("fontFamily", font.value);
                  }}
                  className="p-1.5 rounded-md border hover:bg-muted transition-colors shrink-0"
                  title="Random font"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                </div>

                <SliderField
                  label={`Weight — ${weightLabel}`}
                  min={100} max={900} step={100}
                  value={config.fontWeight}
                  onChange={(v) => update("fontWeight", v)}
                />
                <SliderField
                  label={`Size — ${config.fontSize}px`}
                  min={16} max={300} step={1}
                  value={config.fontSize}
                  onChange={(v) => update("fontSize", v)}
                />
                <SliderField
                  label={`Spacing — ${config.letterSpacing}px`}
                  min={-20} max={40} step={1}
                  value={config.letterSpacing}
                  onChange={(v) => update("letterSpacing", v)}
                />
              </div>
            </Section>

            {/* ── Colors header with global generate ── */}
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
                Colors
              </div>
              <button
                onClick={handleGenerateAll}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                title="Generate all unlocked colors"
              >
                <RefreshCw className="h-3 w-3" /> Generate
              </button>
            </div>

            {/* ── Text Color ── */}
            <ColorControl
              label="Text fill"
              colorConfig={config.textColor}
              onChange={(c) => update("textColor", c)}
              onGenerate={handleGenerateText}
              locked={textLocked}
              onLockToggle={() => setTextLocked((v) => !v)}
            />

            {/* ── Background ── */}
            <ColorControl
              label="Background fill"
              colorConfig={config.bgColor}
              onChange={(c) => update("bgColor", c)}
              allowTransparent
              bgMode={config.bgMode}
              onBgModeChange={(m) => {
                update("bgMode", m);
                if (m === "solid") update("bgColor", { ...config.bgColor, mode: "solid" });
                if (m === "gradient") update("bgColor", { ...config.bgColor, mode: "gradient" });
              }}
              onGenerate={handleGenerateBg}
              locked={bgLocked}
              onLockToggle={() => setBgLocked((v) => !v)}
            />

            {/* ── Padding & Radius ── */}
            <Section label="Padding & Radius">
              <div className="space-y-3">
                <SliderField
                  label={`Pad X — ${config.paddingX}px`}
                  min={0} max={200} step={1}
                  value={config.paddingX}
                  onChange={(v) => update("paddingX", v)}
                />
                <SliderField
                  label={`Pad Y — ${config.paddingY}px`}
                  min={0} max={200} step={1}
                  value={config.paddingY}
                  onChange={(v) => update("paddingY", v)}
                />
                {config.shape !== "circle" && (
                  <SliderField
                    label={`Radius — ${config.borderRadius}px`}
                    min={0} max={200} step={1}
                    value={config.borderRadius}
                    onChange={(v) => update("borderRadius", v)}
                  />
                )}
              </div>
            </Section>

            {/* ── Presets ── */}
            <Section label="Presets">
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_PRESETS.map((preset) => {
                  const isGradientBg = preset.bgMode === "gradient";
                  const bgPreview = isGradientBg
                    ? gradientCss(preset.bgColor.gradient)
                    : preset.bgColor.hex;
                  const textRgb = hexToRgb(preset.textColor.hex);
                  return (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className="relative h-10 rounded-md border border-border/50 overflow-hidden hover:border-ring hover:scale-[1.02] transition-all text-left group"
                      style={{ background: bgPreview }}
                    >
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold px-1 text-center leading-tight"
                        style={{ color: preset.textColor.hex }}
                      >
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* ── Saved Logos ── */}
            {mounted && savedLogos.length > 0 && (
              <Section label="Saved Logos">
                <div className="space-y-1.5">
                  {savedLogos.map((saved) => {
                    const c = deserializeConfig(saved.config);
                    const bgPreview = c.bgMode === "transparent"
                      ? checkerboard()
                      : c.bgColor.mode === "gradient"
                        ? gradientCss(c.bgColor.gradient)
                        : c.bgColor.hex;
                    return (
                      <div
                        key={saved.id}
                        className="flex items-center gap-2 group"
                      >
                        <button
                          onClick={() => handleLoadLogo(saved)}
                          className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-border/50 p-1.5 hover:border-ring transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-[8px] font-bold overflow-hidden"
                            style={{
                              background: bgPreview,
                              color: c.textColor.hex,
                              borderRadius: c.shape === "circle" ? "50%" : `${Math.min(c.borderRadius, 8)}px`,
                            }}
                          >
                            {c.text.slice(0, 4)}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-xs font-medium truncate">{saved.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {c.shape} · {c.bgMode === "transparent" ? "transparent" : c.bgColor.mode}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeleteLogo(saved.id)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* ── Reset ── */}
            <button
              onClick={() => setConfig(DEFAULT_CONFIG)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
            </button>
          </div>
        </div>
      </div>

      {/* Slider styles (same pattern as color-tool) */}
      <style>{`
        .color-slider {
          -webkit-appearance: none;
          appearance: none;
          outline: none;
          border-radius: 0.5rem;
        }
        .color-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        .color-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        .color-slider::-moz-range-track {
          background: transparent;
          border: none;
        }
      `}</style>
    </ToolLayout>
  );
}

// ── Small UI helpers ────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function SliderField({
  label, min, max, step, value, onChange,
}: {
  label: string;
  min: number; max: number; step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5 rounded-full"
      />
    </div>
  );
}
