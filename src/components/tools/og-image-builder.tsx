"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { renderOgImage } from "@/lib/og/render";
import { useSyncedState } from "@/lib/sync";
import { SyncToggle } from "@/components/ui/sync-toggle";
import {
  Image as ImageIcon,
  Download,
  Plus,
  Trash2,
  ChevronDown,
  Layers,
  X,
  Type,
  Save,
  FolderOpen,
  Loader2,
  Globe,
  Copy,
  Check,
  Code,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { ColorBuilderSheet } from "@/components/ui/color-builder-sheet";

// ── Types ────────────────────────────────────────────────

import type {
  LayoutTemplate,
  GradientDirection,
  ExportFormat,
  FontWeight,
  Theme,
  CustomElement,
  OgImage,
  SavedCustomLayout,
  OgBuilderState,
  OgCollectionSummary,
} from "@/lib/og/types";

const SAVED_LAYOUTS_KEY = "og-custom-layouts";
const BUILDER_STATE_KEY = "og-builder-state";

function loadBuilderState(): Partial<OgBuilderState> | null {
  try {
    const raw = localStorage.getItem(BUILDER_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<OgBuilderState>;
  } catch {
    return null;
  }
}

// ── Constants ─────────────────────────────────────────────

const LAYOUT_LABELS: Record<LayoutTemplate, string> = {
  centered: "Centered",
  editorial: "Editorial",
  headline: "Headline",
  cards: "Cards",
  corners: "Corners",
  minimal: "Minimal",
  custom: "Custom",
};

const FONT_FAMILIES = [
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: "system-ui, sans-serif", label: "System UI" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: '"Times New Roman", serif', label: "Times New Roman" },
  { value: '"Courier New", monospace', label: "Courier New" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: '"Trebuchet MS", sans-serif', label: "Trebuchet MS" },
  { value: "Impact, sans-serif", label: "Impact" },
];

const FONT_WEIGHTS: { value: FontWeight; label: string }[] = [
  { value: "300", label: "Light" },
  { value: "400", label: "Normal" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extrabold" },
];

const GRADIENT_DIRECTIONS: { value: GradientDirection; label: string }[] = [
  { value: "to-right", label: "→ Horizontal" },
  { value: "to-bottom", label: "↓ Vertical" },
  { value: "to-bottom-right", label: "↘ Diagonal" },
  { value: "to-bottom-left", label: "↙ Diagonal" },
  { value: "radial", label: "◎ Radial" },
];

const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/webp", label: "WebP" },
];

const FORMAT_EXT: Record<ExportFormat, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const DEFAULT_PRESETS: Omit<OgImage, "title" | "subtitle" | "layout">[] = [
  { id: "og", label: "Open Graph", width: 1200, height: 630, enabled: true, isCustom: false },
  { id: "tw", label: "Twitter Card", width: 1200, height: 628, enabled: true, isCustom: false },
  { id: "tw-large", label: "Twitter Banner", width: 1500, height: 500, enabled: false, isCustom: false },
  { id: "ig", label: "Instagram Square", width: 1080, height: 1080, enabled: false, isCustom: false },
  { id: "pin", label: "Pinterest", width: 1000, height: 1500, enabled: false, isCustom: false },
  { id: "wa", label: "WhatsApp", width: 400, height: 400, enabled: false, isCustom: false },
];

const DEFAULT_THEME: Theme = {
  bgColor: "#0f0f0f",
  useGradient: false,
  gradientColor1: "#1a1a2e",
  gradientColor2: "#16213e",
  gradientDirection: "to-bottom-right",
  textColor: "#ffffff",
  accentColor: "#6366f1",
  fontFamily: "Inter, system-ui, sans-serif",
  titleSize: 64,
  subtitleSize: 28,
  titleWeight: "700",
  padding: 64,
  borderRadius: 0,
};

// ── Preview component (div-based, matches Satori output) ──


function defaultCustomElements(title: string, subtitle: string, theme: Theme): CustomElement[] {
  const els: CustomElement[] = [
    {
      id: "title",
      text: title,
      x: 0.5,
      y: 0.42,
      fontSize: theme.titleSize,
      fontWeight: theme.titleWeight,
      color: "theme",
      opacity: 1,
      textAlign: "center",
      maxWidth: 0.8,
    },
  ];
  if (subtitle) {
    els.push({
      id: "subtitle",
      text: subtitle,
      x: 0.5,
      y: 0.58,
      fontSize: theme.subtitleSize,
      fontWeight: "400",
      color: "theme",
      opacity: 0.65,
      textAlign: "center",
      maxWidth: 0.7,
    });
  }
  return els;
}

// ── Preview component (renders same JSX as Satori) ────────

function PreviewImage({ img, theme, maxWidth }: { img: OgImage; theme: Theme; maxWidth: number }) {
  const scale = maxWidth / img.width;
  const displayH = img.height * scale;

  return (
    <div
      style={{
        width: maxWidth,
        height: displayH,
        overflow: "hidden",
        borderRadius: theme.borderRadius > 0 ? Math.min(theme.borderRadius * scale, 12) : undefined,
      }}
    >
      <div
        style={{
          width: img.width,
          height: img.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {renderOgImage(img, theme)}
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1.5">
      {children}
    </div>
  );
}

function ControlRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}


function RangeInput({
  min,
  max,
  value,
  onChange,
  unit = "",
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-foreground cursor-pointer"
      />
      <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
        {value}{unit}
      </span>
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Layout Picker (visual thumbnails) ──────────────────────

const LAYOUT_THUMBS: { key: LayoutTemplate; label: string; icon: React.ReactNode }[] = [
  {
    key: "centered",
    label: "Centered",
    icon: (
      <svg viewBox="0 0 48 28" className="w-full h-full">
        {/* thin accent line above title */}
        <rect x="18" y="7" width="12" height="1.5" rx="0.75" fill="currentColor" opacity="0.6" />
        <rect x="10" y="12" width="28" height="3" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="15" y="18" width="18" height="2" rx="1" fill="currentColor" opacity="0.35" />
      </svg>
    ),
  },
  {
    key: "editorial",
    label: "Editorial",
    icon: (
      <svg viewBox="0 0 48 28" className="w-full h-full">
        {/* small uppercase label */}
        <rect x="4" y="13" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
        {/* big left-aligned title at bottom */}
        <rect x="4" y="17" width="26" height="3.5" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="4" y="22" width="18" height="3.5" rx="1" fill="currentColor" opacity="0.9" />
      </svg>
    ),
  },
  {
    key: "headline",
    label: "Headline",
    icon: (
      <svg viewBox="0 0 48 28" className="w-full h-full">
        {/* pill tag top-right */}
        <rect x="32" y="4" width="12" height="5" rx="2.5" fill="currentColor" opacity="0.18" />
        <rect x="34" y="5.5" width="8" height="2" rx="1" fill="currentColor" opacity="0.4" />
        {/* big title */}
        <rect x="4" y="11" width="38" height="5" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="4" y="18" width="24" height="5" rx="1" fill="currentColor" opacity="0.9" />
      </svg>
    ),
  },
  {
    key: "cards",
    label: "Cards",
    icon: (
      <svg viewBox="0 0 48 28" className="w-full h-full">
        {/* frosted card */}
        <rect x="5" y="5" width="38" height="18" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.8" />
        <rect x="10" y="10" width="20" height="3" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="10" y="16" width="14" height="2" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
  {
    key: "corners",
    label: "Corners",
    icon: (
      <svg viewBox="0 0 48 28" className="w-full h-full">
        {/* top-left L */}
        <rect x="4" y="4" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.55" />
        <rect x="4" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" opacity="0.55" />
        {/* bottom-right L */}
        <rect x="36" y="22.5" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.55" />
        <rect x="42.5" y="15.5" width="1.5" height="8" rx="0.5" fill="currentColor" opacity="0.55" />
        {/* title bottom-left */}
        <rect x="4" y="19" width="22" height="3" rx="1" fill="currentColor" opacity="0.9" />
        {/* subtitle top-right */}
        <rect x="26" y="7" width="16" height="2" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
  {
    key: "minimal",
    label: "Minimal",
    icon: (
      <svg viewBox="0 0 48 28" className="w-full h-full">
        <rect x="5" y="11" width="38" height="6" rx="1.5" fill="currentColor" opacity="0.85" />
      </svg>
    ),
  },
  {
    key: "custom",
    label: "Custom",
    icon: (
      <svg viewBox="0 0 48 28" className="w-full h-full">
        {/* crosshair dots */}
        <circle cx="18" cy="11" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="30" cy="18" r="1.5" fill="currentColor" opacity="0.35" />
        <rect x="13" y="9" width="10" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="2 1.5" />
        <rect x="24" y="15.5" width="12" height="3" rx="1" fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="2 1.5" />
      </svg>
    ),
  },
];

function LayoutPicker({
  value,
  onChange,
  onCustom,
}: {
  value: LayoutTemplate;
  onChange: (v: LayoutTemplate) => void;
  onCustom?: () => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {LAYOUT_THUMBS.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => {
            if (key === "custom" && onCustom) {
              onCustom();
            } else {
              onChange(key);
            }
          }}
          title={label}
          className={`aspect-video rounded border p-0.5 transition-all cursor-pointer ${
            value === key
              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
              : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// ── Image card ─────────────────────────────────────────────

interface ImageCardProps {
  img: OgImage;
  theme: Theme;
  onUpdate: (patch: Partial<OgImage>) => void;
  onExport: () => void;
  onDelete: () => void;
  savedLayouts: SavedCustomLayout[];
  setSavedLayouts: (value: SavedCustomLayout[] | ((prev: SavedCustomLayout[]) => SavedCustomLayout[])) => void;
}

function ImageCard({ img, theme, onUpdate, onExport, onDelete, savedLayouts, setSavedLayouts }: ImageCardProps) {
  const [open, setOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const previewW = 340;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden break-inside-avoid">
      {/* Preview */}
      <div
        className="bg-muted/30 flex items-center justify-center p-3"
        style={{ minHeight: 100 }}
      >
        <div
          className="overflow-hidden shadow-md rounded"
          style={{ width: previewW, height: (img.height / img.width) * previewW }}
        >
          <PreviewImage img={img} theme={theme} maxWidth={previewW} />
        </div>
      </div>

      {/* Info + controls */}
      <div className="px-3 py-2 space-y-2 border-t border-border">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-foreground">{img.label}</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {img.width} × {img.height}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {img.layout === "custom" ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setCustomDialogOpen(true)}
              >
                Customize
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setOpen((v) => !v)}
              >
                Edit
                <ChevronDown
                  className={`ml-1 h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={onExport}
            >
              <Download className="h-3 w-3" />
            </Button>
            {img.isCustom && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Layout picker - always visible */}
        <LayoutPicker
          value={img.layout}
          onChange={(v) => onUpdate({ layout: v })}
          onCustom={() => {
            if (!img.customElements) {
              onUpdate({
                layout: "custom",
                customElements: defaultCustomElements(img.title, img.subtitle, theme),
              });
            } else {
              onUpdate({ layout: "custom" });
            }
            setCustomDialogOpen(true);
          }}
        />

        {open && img.layout !== "custom" && (
          <div className="space-y-2 pt-1 border-t border-border">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <input
                type="text"
                value={img.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Enter title…"
                className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Subtitle</label>
              <input
                type="text"
                value={img.subtitle}
                onChange={(e) => onUpdate({ subtitle: e.target.value })}
                placeholder="Enter subtitle…"
                className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Title size</label>
                {img.titleSize != null && (
                  <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onUpdate({ titleSize: undefined })}>Reset</button>
                )}
              </div>
              <RangeInput
                min={24}
                max={120}
                value={img.titleSize ?? theme.titleSize}
                onChange={(v) => onUpdate({ titleSize: v })}
                unit="px"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Subtitle size</label>
                {img.subtitleSize != null && (
                  <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onUpdate({ subtitleSize: undefined })}>Reset</button>
                )}
              </div>
              <RangeInput
                min={12}
                max={60}
                value={img.subtitleSize ?? theme.subtitleSize}
                onChange={(v) => onUpdate({ subtitleSize: v })}
                unit="px"
              />
            </div>
          </div>
        )}
      </div>

      {customDialogOpen && (
        <CustomLayoutDialog
          img={img}
          theme={theme}
          onUpdate={onUpdate}
          onClose={() => setCustomDialogOpen(false)}
          savedLayouts={savedLayouts}
          setSavedLayouts={setSavedLayouts}
        />
      )}
    </div>
  );
}

// ── Custom layout builder dialog ───────────────────────────

function CustomLayoutDialog({
  img,
  theme,
  onUpdate,
  onClose,
  savedLayouts,
  setSavedLayouts,
}: {
  img: OgImage;
  theme: Theme;
  onUpdate: (patch: Partial<OgImage>) => void;
  onClose: () => void;
  savedLayouts: SavedCustomLayout[];
  setSavedLayouts: (value: SavedCustomLayout[] | ((prev: SavedCustomLayout[]) => SavedCustomLayout[])) => void;
}) {
  const elements = img.customElements ?? defaultCustomElements(img.title, img.subtitle, theme);
  const [selectedId, setSelectedId] = useState<string | null>(elements[0]?.id ?? null);
  const [colorBuilderOpen, setColorBuilderOpen] = useState(false);
  const [colorBuilderElId, setColorBuilderElId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Canvas preview size
  const previewW = 600;
  const aspect = img.width / img.height;
  const previewH = previewW / aspect;

  const updateElement = (id: string, patch: Partial<CustomElement>) => {
    const updated = elements.map((el) => (el.id === id ? { ...el, ...patch } : el));
    onUpdate({ customElements: updated });
  };

  const addElement = () => {
    const newEl: CustomElement = {
      id: crypto.randomUUID(),
      text: "New text",
      x: 0.5,
      y: 0.5,
      fontSize: 24,
      fontWeight: "400",
      color: "theme",
      opacity: 1,
      textAlign: "center",
    };
    onUpdate({ customElements: [...elements, newEl] });
    setSelectedId(newEl.id);
  };

  const removeElement = (id: string) => {
    const updated = elements.filter((el) => el.id !== id);
    onUpdate({ customElements: updated });
    if (selectedId === id) setSelectedId(updated[0]?.id ?? null);
  };

  const saveLayout = () => {
    // Strip text content - store as template with placeholder text
    const templateElements = elements.map((el, i) => ({
      ...el,
      id: crypto.randomUUID(),
      text: el.text || `Text ${i + 1}`,
    }));
    setSavedLayouts((prev) => {
      const name = `Layout ${prev.length + 1}`;
      const layout: SavedCustomLayout = { id: crypto.randomUUID(), name, elements: templateElements };
      return [...prev, layout];
    });
  };

  const loadLayout = (layout: SavedCustomLayout) => {
    // Apply template, giving each element a fresh id
    const newElements = layout.elements.map((el) => ({ ...el, id: crypto.randomUUID() }));
    onUpdate({ customElements: newElements, layout: "custom" });
    setSelectedId(newElements[0]?.id ?? null);
    setShowSaved(false);
  };

  const deleteLayout = (id: string) => {
    setSavedLayouts((prev) => prev.filter((l) => l.id !== id));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const el = elements.find((el) => el.id === id);
    if (!el) return;

    const elPxX = el.x * previewW;
    const elPxY = el.y * previewH;
    dragRef.current = {
      id,
      offsetX: e.clientX - rect.left - elPxX,
      offsetY: e.clientY - rect.top - elPxY,
    };
    setSelectedId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left - dragRef.current.offsetX) / previewW));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top - dragRef.current.offsetY) / previewH));
    updateElement(dragRef.current.id, { x, y });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const selected = elements.find((el) => el.id === selectedId);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex max-h-[90vh]">
        {/* Canvas area */}
        <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
          <span className="text-sm font-semibold">Custom Layout Builder</span>

          <div
            ref={containerRef}
            className="relative select-none bg-muted/30 rounded-lg overflow-hidden border border-border"
            style={{ width: previewW, height: previewH }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={() => setSelectedId(null)}
          >
            <div style={{ width: previewW, height: previewH, overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ width: img.width, height: img.height, transform: `scale(${previewW / img.width})`, transformOrigin: "top left" }}>
                {renderOgImage({ ...img, customElements: elements }, theme)}
              </div>
            </div>
            {/* Drag handles - sized by rendering actual text */}
            {elements.map((el) => {
              const scale = previewW / img.width;
              const px = el.x * previewW;
              const py = el.y * previewH;
              const isSelected = el.id === selectedId;

              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => handlePointerDown(e, el.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                  style={{
                    position: "absolute",
                    left: px,
                    top: py,
                    transform: `translate(${el.textAlign === "center" ? "-50%" : el.textAlign === "right" ? "-100%" : "0"}, 0)`,
                    maxWidth: el.maxWidth ? el.maxWidth * previewW : undefined,
                    cursor: "move",
                    border: isSelected ? "1.5px solid rgba(99,102,241,0.8)" : "1px dashed rgba(255,255,255,0.3)",
                    borderRadius: 3,
                    background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
                    transition: "border-color 0.15s",
                    pointerEvents: "all",
                    padding: "2px 4px",
                  }}
                >
                  {/* Invisible text that gives the handle its natural size */}
                  <span
                    style={{
                      fontSize: el.fontSize * scale,
                      fontWeight: Number(el.fontWeight),
                      lineHeight: 1.3,
                      color: "transparent",
                      whiteSpace: el.maxWidth ? "normal" : "nowrap",
                      display: "block",
                      textAlign: el.textAlign,
                    }}
                  >
                    {el.text || "\u00A0"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-64 border-l border-border p-3 space-y-3 overflow-y-auto overflow-x-hidden shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Elements</span>
            <div className="flex items-center gap-2">
              <button onClick={addElement} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          </div>

          {/* Element list */}
          <div className="space-y-1">
            {elements.map((el) => (
              <div
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                  el.id === selectedId ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                }`}
              >
                <Type className="h-3 w-3 shrink-0 opacity-50" />
                <span className="flex-1 min-w-0 truncate">{el.text || "Empty"}</span>
                {elements.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeElement(el.id); }}
                    className="p-0.5 hover:bg-muted rounded opacity-50 hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Selected element properties */}
          {selected && (
            <>
              <div className="border-t border-border pt-3 space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>

                <div>
                  <label className="text-[11px] text-muted-foreground">Text</label>
                  <input
                    type="text"
                    value={selected.text}
                    onChange={(e) => updateElement(selected.id, { text: e.target.value })}
                    className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">Font size</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="range"
                      min={12}
                      max={160}
                      value={selected.fontSize}
                      onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={12}
                      max={160}
                      value={selected.fontSize}
                      onChange={(e) => updateElement(selected.id, { fontSize: Math.max(12, Math.min(160, Number(e.target.value) || 12)) })}
                      className="w-12 text-[11px] font-mono text-right bg-background border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">Max width</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      onClick={() => updateElement(selected.id, { maxWidth: selected.maxWidth ? undefined : 0.8 })}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors shrink-0 ${
                        selected.maxWidth != null
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {selected.maxWidth != null ? "On" : "Off"}
                    </button>
                    {selected.maxWidth != null && (
                      <>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          value={Math.round(selected.maxWidth * 100)}
                          onChange={(e) => updateElement(selected.id, { maxWidth: Number(e.target.value) / 100 })}
                          className="flex-1"
                        />
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={Math.round(selected.maxWidth * 100)}
                          onChange={(e) => updateElement(selected.id, { maxWidth: Math.max(10, Math.min(100, Number(e.target.value) || 10)) / 100 })}
                          className="w-12 text-[11px] font-mono text-right bg-background border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">Weight</label>
                  <select
                    value={selected.fontWeight}
                    onChange={(e) => updateElement(selected.id, { fontWeight: e.target.value })}
                    className="mt-0.5 w-full text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="300">Light</option>
                    <option value="400">Normal</option>
                    <option value="500">Medium</option>
                    <option value="600">Semibold</option>
                    <option value="700">Bold</option>
                    <option value="800">Extra Bold</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">Align</label>
                  <div className="flex gap-1 mt-0.5">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => updateElement(selected.id, { textAlign: a })}
                        className={`flex-1 text-xs py-0.5 rounded border transition-colors ${
                          selected.textAlign === a
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">Opacity</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(selected.opacity * 100)}
                      onChange={(e) => updateElement(selected.id, { opacity: Number(e.target.value) / 100 })}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(selected.opacity * 100)}
                      onChange={(e) => updateElement(selected.id, { opacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })}
                      className="w-12 text-[11px] font-mono text-right bg-background border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">Color</label>
                  <div className="mt-0.5 space-y-1.5">
                    <button
                      onClick={() => updateElement(selected.id, { color: selected.color === "theme" ? theme.textColor : "theme" })}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        selected.color === "theme"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {selected.color === "theme" ? "Using theme color" : "Use theme color"}
                    </button>
                    {selected.color !== "theme" && (
                      <div className="min-w-0">
                        <ColorPicker
                          value={selected.color}
                          onChange={(hex) => updateElement(selected.id, { color: hex })}
                          onOpenBuilder={() => {
                            setColorBuilderElId(selected.id);
                            setColorBuilderOpen(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground">X position</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(selected.x * 100)}
                        onChange={(e) => updateElement(selected.id, { x: Number(e.target.value) / 100 })}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(selected.x * 100)}
                        onChange={(e) => updateElement(selected.id, { x: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })}
                        className="w-12 text-[11px] font-mono text-right bg-background border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Y position</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(selected.y * 100)}
                        onChange={(e) => updateElement(selected.id, { y: Number(e.target.value) / 100 })}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(selected.y * 100)}
                        onChange={(e) => updateElement(selected.id, { y: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })}
                        className="w-12 text-[11px] font-mono text-right bg-background border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={saveLayout}>
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={() => setShowSaved((v) => !v)}
                disabled={savedLayouts.length === 0}
              >
                <FolderOpen className="h-3 w-3 mr-1" /> Load
              </Button>
            </div>

            {showSaved && savedLayouts.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {savedLayouts.map((layout) => (
                  <div
                    key={layout.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted text-xs cursor-pointer group"
                  >
                    <button
                      className="flex-1 text-left truncate"
                      onClick={() => loadLayout(layout)}
                    >
                      {layout.name}
                      <span className="text-muted-foreground ml-1">({layout.elements.length})</span>
                    </button>
                    <button
                      onClick={() => deleteLayout(layout.id)}
                      className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button size="sm" className="w-full h-7 text-xs" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      {colorBuilderElId && (
        <ColorBuilderSheet
          open={colorBuilderOpen}
          onOpenChange={(open) => {
            setColorBuilderOpen(open);
            if (!open) setColorBuilderElId(null);
          }}
          value={elements.find((el) => el.id === colorBuilderElId)?.color === "theme" ? theme.textColor : (elements.find((el) => el.id === colorBuilderElId)?.color ?? theme.textColor)}
          onChange={(hex) => updateElement(colorBuilderElId, { color: hex })}
          title="Element Color"
          description="Fine-tune the color for this text element."
        />
      )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Custom size modal ──────────────────────────────────────

interface CustomSizeDialogProps {
  onAdd: (label: string, w: number, h: number) => void;
  onClose: () => void;
}

function CustomSizeDialog({ onAdd, onClose }: CustomSizeDialogProps) {
  const [label, setLabel] = useState("Custom");
  const [w, setW] = useState(1200);
  const [h, setH] = useState(630);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-72 p-4 space-y-3">
        <div className="text-sm font-semibold text-foreground">Add Custom Size</div>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Width</label>
              <input
                type="number"
                value={w}
                onChange={(e) => setW(Number(e.target.value))}
                className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Height</label>
              <input
                type="number"
                value={h}
                onChange={(e) => setH(Number(e.target.value))}
                className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => { onAdd(label, w, h); onClose(); }}
            disabled={!label || w < 1 || h < 1}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────

// ── Publish info panel ──────────────────────────────────

const OG_CDN_BASE = typeof window !== "undefined"
  ? `${window.location.origin}/og/s`
  : "/og/s";

function CopyUrlButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded hover:bg-muted transition-colors shrink-0"
      aria-label="Copy URL"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

function PublishInfoDialog({
  slug,
  images,
  open,
  onOpenChange,
  onUnpublish,
}: {
  slug: string;
  images: OgImage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnpublish: () => void;
}) {
  const enabledImages = images.filter((img) => img.enabled);
  const baseUrl = `${OG_CDN_BASE}/${slug}`;

  function variantSlug(img: OgImage): string {
    return img.label.toLowerCase().replace(/\s+/g, "-");
  }

  const ogImage = enabledImages.find((img) => img.id === "og") ?? enabledImages[0];
  const twImage = enabledImages.find((img) => img.id === "tw" || img.id === "tw-large");
  const ogUrl = ogImage ? `${baseUrl}/${variantSlug(ogImage)}.png` : null;
  const twUrl = twImage ? `${baseUrl}/${variantSlug(twImage)}.png` : null;

  const metaTags = [
    ogUrl && `<meta property="og:image" content="${ogUrl}" />`,
    ogUrl && ogImage && `<meta property="og:image:width" content="${ogImage.width}" />`,
    ogUrl && ogImage && `<meta property="og:image:height" content="${ogImage.height}" />`,
    twUrl && `<meta name="twitter:card" content="summary_large_image" />`,
    twUrl && `<meta name="twitter:image" content="${twUrl}" />`,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <div className="space-y-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500/10">
              <Globe className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Collection Published</h3>
              <p className="text-xs text-muted-foreground">Your OG images are live and accessible via the URLs below.</p>
            </div>
          </div>

          {/* URL list */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Image URLs
            </div>
            {enabledImages.map((img) => {
              const url = `${baseUrl}/${variantSlug(img)}.png`;
              return (
                <div key={img.id} className="flex items-center gap-2 group min-w-0">
                  <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">
                    {img.label}
                  </span>
                  <code className="text-xs text-foreground font-mono truncate flex-1 min-w-0 bg-muted/50 rounded px-1.5 py-0.5">
                    {url}
                  </code>
                  <CopyUrlButton text={url} />
                </div>
              );
            })}
          </div>

          {/* Dynamic URL example */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dynamic text via query params
            </div>
            {ogUrl && (
              <div className="flex items-center gap-2 min-w-0">
                <code className="text-xs text-foreground font-mono truncate flex-1 min-w-0 bg-muted/50 rounded px-1.5 py-0.5">
                  {ogUrl}?title=Hello+World
                </code>
                <CopyUrlButton text={`${ogUrl}?title=Hello+World`} />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Override text with <code className="bg-muted rounded px-1">?title=</code> and <code className="bg-muted rounded px-1">?subtitle=</code> query parameters.
            </p>
          </div>

          {/* Meta tags */}
          {metaTags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  HTML meta tags
                </div>
                <CopyUrlButton text={metaTags.join("\n")} />
              </div>
              <pre className="text-[11px] font-mono text-foreground bg-muted/50 rounded-md px-3 py-2 overflow-x-auto whitespace-pre max-w-full">
{metaTags.join("\n")}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => { onUnpublish(); onOpenChange(false); }}
            >
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_TITLE = "Your Title Goes Here";
const DEFAULT_SUBTITLE = "A short description of your page or project";

function makeDefaultImages(): OgImage[] {
  return DEFAULT_PRESETS.map((p) => ({
    ...p,
    title: DEFAULT_TITLE,
    subtitle: DEFAULT_SUBTITLE,
    layout: "centered" as LayoutTemplate,
  }));
}

interface OgImageBuilderProps {
  /** When editing an existing collection */
  collectionId?: string;
  initialState?: OgBuilderState;
  initialName?: string;
  initialSlug?: string;
  initialPublished?: boolean;
}

export function OgImageBuilder({
  collectionId,
  initialState,
  initialName,
  initialSlug,
  initialPublished,
}: OgImageBuilderProps = {}) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const router = useRouter();

  const {
    data: savedLayouts,
    setData: setSavedLayouts,
    syncToggleProps,
  } = useSyncedState<SavedCustomLayout[]>(SAVED_LAYOUTS_KEY, []);
  const [theme, setTheme] = useState<Theme>(initialState?.theme ?? DEFAULT_THEME);
  const [images, setImages] = useState<OgImage[]>(initialState?.images ?? makeDefaultImages);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(initialState?.exportFormat ?? "image/png");
  const [jpegQuality, setJpegQuality] = useState(initialState?.jpegQuality ?? 92);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [defaultTitle, setDefaultTitle] = useState(initialState?.defaultTitle ?? DEFAULT_TITLE);
  const [colorBuilderOpen, setColorBuilderOpen] = useState(false);
  const [colorBuilderField, setColorBuilderField] = useState<keyof Theme | null>(null);
  const [defaultSubtitle, setDefaultSubtitle] = useState(initialState?.defaultSubtitle ?? DEFAULT_SUBTITLE);

  // Collection state
  const [collName, setCollName] = useState(initialName ?? "Untitled");
  const [collSlug] = useState(initialSlug ?? null);
  const [collPublished, setCollPublished] = useState(initialPublished ?? false);
  const [saving, setSaving] = useState(false);
  const [showPublishInfo, setShowPublishInfo] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [collections, setCollections] = useState<OgCollectionSummary[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);
  const collectionsRef = useRef<HTMLDivElement>(null);
  const isCollection = !!collectionId;

  // Build current state snapshot
  const getState = useCallback((): OgBuilderState => ({
    theme,
    images,
    exportFormat,
    jpegQuality,
    defaultTitle,
    defaultSubtitle,
  }), [theme, images, exportFormat, jpegQuality, defaultTitle, defaultSubtitle]);

  // Load state from localStorage on mount (only for new builder, not collections)
  useEffect(() => {
    if (isCollection) {
      hydrated.current = true;
      return;
    }
    const saved = loadBuilderState();
    if (saved) {
      if (saved.theme) setTheme(saved.theme);
      if (saved.images) setImages(saved.images);
      if (saved.exportFormat) setExportFormat(saved.exportFormat);
      if (saved.jpegQuality != null) setJpegQuality(saved.jpegQuality);
      if (saved.defaultTitle != null) setDefaultTitle(saved.defaultTitle);
      if (saved.defaultSubtitle != null) setDefaultSubtitle(saved.defaultSubtitle);
    }
    hydrated.current = true;
  }, [isCollection]);

  // Persist state (localStorage for new builder, API for collections)
  useEffect(() => {
    if (!hydrated.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const state = getState();
      if (isCollection) {
        // Auto-save to API
        fetch(`/api/proxy/og/collections/${collectionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: state }),
          credentials: "include",
        }).catch(() => {});
      } else {
        localStorage.setItem(BUILDER_STATE_KEY, JSON.stringify(state));
      }
    }, 500);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [theme, images, exportFormat, jpegQuality, defaultTitle, defaultSubtitle, isCollection, collectionId, getState]);

  // Close collections popover on outside click
  useEffect(() => {
    if (!showCollections) return;
    const handler = (e: MouseEvent) => {
      if (collectionsRef.current && !collectionsRef.current.contains(e.target as Node)) {
        setShowCollections(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCollections]);

  // Save as new collection
  const saveAsCollection = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/proxy/og/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: defaultTitle || "Untitled", config: getState() }),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/tools/og/${data.id}`);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [getState, defaultTitle, router]);

  // Explicit save for existing collection
  const saveCollection = useCallback(async () => {
    if (!collectionId) return;
    setSaving(true);
    try {
      await fetch(`/api/proxy/og/collections/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: collName, config: getState() }),
        credentials: "include",
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [collectionId, collName, getState]);

  // Toggle published
  const togglePublished = useCallback(async () => {
    if (!collectionId) return;
    const next = !collPublished;
    setCollPublished(next);
    if (next) setShowPublishInfo(true);
    else setShowPublishInfo(false);
    await fetch(`/api/proxy/og/collections/${collectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
      credentials: "include",
    }).catch(() => {});
  }, [collectionId, collPublished]);

  // Fetch collection list
  const fetchCollections = useCallback(async () => {
    setLoadingCollections(true);
    try {
      const res = await fetch("/api/proxy/og/collections", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCollections(false);
    }
  }, []);

  const updateTheme = useCallback((patch: Partial<Theme>) => {
    setTheme((t) => ({ ...t, ...patch }));
  }, []);

  const openColorBuilder = useCallback((field: keyof Theme) => {
    setColorBuilderField(field);
    setColorBuilderOpen(true);
  }, []);

  const handleColorBuilderChange = useCallback(
    (hex: string) => {
      if (colorBuilderField) {
        setTheme((t) => ({ ...t, [colorBuilderField]: hex }));
      }
    },
    [colorBuilderField]
  );

  const updateImage = useCallback((id: string, patch: Partial<OgImage>) => {
    setImages((imgs) =>
      imgs.map((img) => (img.id === id ? { ...img, ...patch } : img))
    );
  }, []);

  const toggleImage = useCallback((id: string) => {
    setImages((imgs) =>
      imgs.map((img) =>
        img.id === id ? { ...img, enabled: !img.enabled } : img
      )
    );
  }, []);

  const addCustomSize = useCallback(
    (label: string, w: number, h: number) => {
      const id = `custom-${Date.now()}`;
      setImages((imgs) => [
        ...imgs,
        {
          id,
          label,
          width: w,
          height: h,
          enabled: true,
          isCustom: true,
          title: defaultTitle,
          subtitle: defaultSubtitle,
          layout: "centered",
        },
      ]);
    },
    [defaultTitle, defaultSubtitle]
  );

  const deleteImage = useCallback((id: string) => {
    setImages((imgs) => imgs.filter((img) => img.id !== id));
  }, []);

  // Apply default title/subtitle to all images when they change
  const applyDefaults = useCallback(() => {
    setImages((imgs) =>
      imgs.map((img) => ({
        ...img,
        title: defaultTitle,
        subtitle: defaultSubtitle,
      }))
    );
  }, [defaultTitle, defaultSubtitle]);

  const exportImage = useCallback(
    async (img: OgImage) => {
      const ext = FORMAT_EXT[exportFormat];
      const slug = img.label.toLowerCase().replace(/\s+/g, "-");
      try {
        const res = await fetch("/og/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: img, theme }),
        });
        if (!res.ok) throw new Error("Render failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `og-${slug}-${img.width}x${img.height}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Export failed:", e);
      }
    },
    [theme, exportFormat]
  );

  const exportAll = useCallback(() => {
    const enabled = images.filter((img) => img.enabled);
    enabled.forEach((img, i) => {
      setTimeout(() => exportImage(img), i * 120);
    });
  }, [images, exportImage]);

  const enabledImages = useMemo(() => images.filter((img) => img.enabled), [images]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          {isCollection ? (
            <input
              type="text"
              value={collName}
              onChange={(e) => {
                setCollName(e.target.value);
                if (saveTimer.current) clearTimeout(saveTimer.current);
                saveTimer.current = setTimeout(() => {
                  fetch(`/api/proxy/og/collections/${collectionId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: e.target.value }),
                    credentials: "include",
                  }).catch(() => {});
                }, 500);
              }}
              className="text-sm font-medium text-foreground bg-transparent border-none outline-none focus:ring-0 w-48"
              placeholder="Collection name..."
            />
          ) : (
            <span className="text-sm font-medium text-foreground">OG Image Builder</span>
          )}
          <span className="hidden sm:inline text-xs text-muted-foreground">
            - {enabledImages.length} image{enabledImages.length !== 1 ? "s" : ""} enabled
          </span>
          {!isCollection && <SyncToggle {...syncToggleProps} />}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/docs/og-images"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Docs</span>
          </Link>
          <NativeSelect
            value={exportFormat}
            onChange={(v) => setExportFormat(v as ExportFormat)}
            options={EXPORT_FORMATS}
          />
          {exportFormat === "image/jpeg" && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Q</span>
              <input
                type="range"
                min={50}
                max={100}
                value={jpegQuality}
                onChange={(e) => setJpegQuality(Number(e.target.value))}
                className="w-16 h-1 accent-foreground cursor-pointer"
              />
              <span className="text-xs text-muted-foreground tabular-nums w-7">{jpegQuality}%</span>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={exportAll}
            disabled={enabledImages.length === 0}
          >
            <Download className="h-3 w-3" />
            Export All
          </Button>
          {isLoggedIn && !isCollection && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={saveAsCollection}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          )}
          {isLoggedIn && isCollection && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={saveCollection}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          )}
          {isLoggedIn && (
            <div className="relative" ref={collectionsRef}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  const next = !showCollections;
                  setShowCollections(next);
                  if (next) fetchCollections();
                }}
              >
                <FolderOpen className="h-3 w-3" />
                Collections
              </Button>
              {showCollections && (
                <div className="absolute right-0 top-full mt-1 w-72 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground">OG Image Collections</span>
                  </div>
                  {loadingCollections ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </div>
                  ) : collections.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No saved collections yet.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {collections.map((c) => (
                        <div
                          key={c.id}
                          className={`group flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0 ${
                            c.id === collectionId ? "bg-accent/30" : ""
                          }`}
                        >
                          <button
                            className="flex-1 min-w-0 text-left"
                            onClick={() => {
                              setShowCollections(false);
                              router.push(`/tools/og/${c.id}`);
                            }}
                          >
                            <p className="text-xs font-medium truncate">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              {c.published && (
                                <span className="text-green-600 dark:text-green-400">Published</span>
                              )}
                              <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                            </p>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await fetch(`/api/proxy/og/collections/${c.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              fetchCollections();
                              if (c.id === collectionId) {
                                setShowCollections(false);
                                router.push("/tools/og");
                              }
                            }}
                            className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete collection"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isCollection && (
                    <div className="px-3 py-2 border-t border-border/50">
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs gap-1.5"
                        onClick={() => {
                          setShowCollections(false);
                          saveAsCollection();
                        }}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Save as New Collection
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {isCollection && !collPublished && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={togglePublished}
            >
              <Globe className="h-3 w-3" />
              Publish
            </Button>
          )}
          {isCollection && collPublished && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1.5"
              onClick={() => setShowPublishInfo(true)}
            >
              <Globe className="h-3 w-3" />
              Published
            </Button>
          )}
        </div>
      </div>

      {/* Published URLs dialog */}
      {isCollection && collSlug && (
        <PublishInfoDialog
          slug={collSlug}
          images={images}
          open={showPublishInfo}
          onOpenChange={setShowPublishInfo}
          onUnpublish={togglePublished}
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto bg-card/30">
          {/* Default text */}
          <SectionLabel>Default Content</SectionLabel>
          <div className="px-3 pb-2 space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <input
                type="text"
                value={defaultTitle}
                onChange={(e) => setDefaultTitle(e.target.value)}
                className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Title for all images…"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Subtitle</label>
              <input
                type="text"
                value={defaultSubtitle}
                onChange={(e) => setDefaultSubtitle(e.target.value)}
                className="mt-0.5 w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Subtitle for all images…"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-6 text-xs"
              onClick={applyDefaults}
            >
              Apply to All Images
            </Button>
          </div>

          <div className="border-t border-border" />

          {/* Theme */}
          <SectionLabel>Theme</SectionLabel>

          {/* Background */}
          <div className="px-3 pb-1">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="useGradient"
                checked={theme.useGradient}
                onChange={(e) => updateTheme({ useGradient: e.target.checked })}
                className="h-3 w-3 rounded"
              />
              <label htmlFor="useGradient" className="text-xs text-muted-foreground cursor-pointer">
                Use gradient background
              </label>
            </div>
          </div>

          {!theme.useGradient ? (
            <ControlRow label="Background">
              <ColorPicker value={theme.bgColor} onChange={(v) => updateTheme({ bgColor: v })} onOpenBuilder={() => openColorBuilder("bgColor")} />
            </ControlRow>
          ) : (
            <>
              <ControlRow label="Color 1">
                <ColorPicker value={theme.gradientColor1} onChange={(v) => updateTheme({ gradientColor1: v })} onOpenBuilder={() => openColorBuilder("gradientColor1")} />
              </ControlRow>
              <ControlRow label="Color 2">
                <ColorPicker value={theme.gradientColor2} onChange={(v) => updateTheme({ gradientColor2: v })} onOpenBuilder={() => openColorBuilder("gradientColor2")} />
              </ControlRow>
              <ControlRow label="Direction">
                <NativeSelect
                  value={theme.gradientDirection}
                  onChange={(v) => updateTheme({ gradientDirection: v as GradientDirection })}
                  options={GRADIENT_DIRECTIONS}
                />
              </ControlRow>
            </>
          )}

          <ControlRow label="Text">
            <ColorPicker value={theme.textColor} onChange={(v) => updateTheme({ textColor: v })} onOpenBuilder={() => openColorBuilder("textColor")} />
          </ControlRow>
          <ControlRow label="Accent">
            <ColorPicker value={theme.accentColor} onChange={(v) => updateTheme({ accentColor: v })} onOpenBuilder={() => openColorBuilder("accentColor")} />
          </ControlRow>

          <div className="border-t border-border mt-1" />
          <SectionLabel>Typography</SectionLabel>

          <ControlRow label="Font">
            <NativeSelect
              value={theme.fontFamily}
              onChange={(v) => updateTheme({ fontFamily: v })}
              options={FONT_FAMILIES}
            />
          </ControlRow>
          <ControlRow label="Weight">
            <NativeSelect
              value={theme.titleWeight}
              onChange={(v) => updateTheme({ titleWeight: v as FontWeight })}
              options={FONT_WEIGHTS}
            />
          </ControlRow>
          <ControlRow label="Title size">
            <RangeInput
              min={24}
              max={120}
              value={theme.titleSize}
              onChange={(v) => updateTheme({ titleSize: v })}
              unit="px"
            />
          </ControlRow>
          <ControlRow label="Sub size">
            <RangeInput
              min={12}
              max={60}
              value={theme.subtitleSize}
              onChange={(v) => updateTheme({ subtitleSize: v })}
              unit="px"
            />
          </ControlRow>

          <div className="border-t border-border mt-1" />
          <SectionLabel>Layout</SectionLabel>

          <ControlRow label="Padding">
            <RangeInput
              min={16}
              max={120}
              value={theme.padding}
              onChange={(v) => updateTheme({ padding: v })}
              unit="px"
            />
          </ControlRow>
          <ControlRow label="Radius">
            <RangeInput
              min={0}
              max={32}
              value={theme.borderRadius}
              onChange={(v) => updateTheme({ borderRadius: v })}
              unit="px"
            />
          </ControlRow>

          <div className="border-t border-border mt-1" />

          {/* Size list */}
          <SectionLabel>Sizes</SectionLabel>
          <div className="px-3 pb-2 space-y-1">
            {images.map((img) => (
              <label
                key={img.id}
                className="flex items-center gap-2 cursor-pointer py-0.5"
              >
                <input
                  type="checkbox"
                  checked={img.enabled}
                  onChange={() => toggleImage(img.id)}
                  className="h-3 w-3 rounded"
                />
                <span className="text-xs text-foreground flex-1">{img.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {img.width}×{img.height}
                </span>
              </label>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-6 text-xs mt-1 gap-1"
              onClick={() => setShowCustomDialog(true)}
            >
              <Plus className="h-3 w-3" />
              Add Custom Size
            </Button>
          </div>
        </div>

        {/* Main preview area */}
        <div className="flex-1 overflow-y-auto p-4">
          {enabledImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Layers className="h-10 w-10 opacity-30" />
              <p className="text-sm">Enable at least one size in the sidebar</p>
            </div>
          ) : (
            <div className="columns-1 xl:columns-2 gap-4 max-w-5xl [&>*]:mb-4">
              {enabledImages.map((img) => (
                <ImageCard
                  key={img.id}
                  img={img}
                  theme={theme}
                  onUpdate={(patch) => updateImage(img.id, patch)}
                  onExport={() => exportImage(img)}
                  onDelete={() => deleteImage(img.id)}
                  savedLayouts={savedLayouts}
                  setSavedLayouts={setSavedLayouts}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCustomDialog && (
        <CustomSizeDialog
          onAdd={addCustomSize}
          onClose={() => setShowCustomDialog(false)}
        />
      )}

      {colorBuilderField && (
        <ColorBuilderSheet
          open={colorBuilderOpen}
          onOpenChange={(open) => {
            setColorBuilderOpen(open);
            if (!open) setColorBuilderField(null);
          }}
          value={theme[colorBuilderField] as string}
          onChange={handleColorBuilderChange}
          title={`Edit - ${colorBuilderField.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}`}
          description="Use the color builder to fine-tune your color."
        />
      )}

    </div>
  );
}
