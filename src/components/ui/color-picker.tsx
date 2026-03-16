"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Paintbrush } from "lucide-react";
import {
  type HSVA,
  hsvaToRgba,
  rgbaToHsva,
  formatHex,
  parseHex,
  drawSVCanvas,
  hsvaToSolidCss,
} from "@/lib/tools/color";

// ── SV Picker ──────────────────────────────────────────

export function SVPicker({
  hsva,
  onChange,
}: {
  hsva: HSVA;
  onChange: (s: number, v: number) => void;
}) {
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
      className="relative w-full aspect-square rounded-lg overflow-hidden cursor-crosshair border border-border/50"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => dragging.current && pick(e.clientX, e.clientY)}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        className="w-full h-full"
      />
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${hsva.s * 100}%`,
          top: `${(1 - hsva.v) * 100}%`,
        }}
      />
    </div>
  );
}

// ── Hue Slider ─────────────────────────────────────────

export function HueSlider({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={360}
      step={1}
      value={hue}
      onChange={(e) => onChange(Number(e.target.value))}
      className="color-picker-slider w-full h-3 rounded-lg appearance-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))`,
      }}
    />
  );
}

// ── Opacity Slider ─────────────────────────────────────

export function OpacitySlider({
  hsva,
  onChange,
}: {
  hsva: HSVA;
  onChange: (a: number) => void;
}) {
  return (
    <div
      className="relative h-3 rounded-lg overflow-hidden"
      style={{
        background: `repeating-conic-gradient(rgba(128,128,128,0.15) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px`,
      }}
    >
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(hsva.a * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="color-picker-slider absolute inset-0 w-full h-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, transparent, ${hsvaToSolidCss(hsva)})`,
        }}
      />
    </div>
  );
}

// ── Slider CSS ─────────────────────────────────────────

export const COLOR_PICKER_SLIDER_STYLES = `
  .color-picker-slider {
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    border-radius: 0.5rem;
  }
  .color-picker-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    border: 2px solid rgba(0,0,0,0.3);
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    cursor: pointer;
  }
  .color-picker-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    border: 2px solid rgba(0,0,0,0.3);
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    cursor: pointer;
  }
  .color-picker-slider::-moz-range-track {
    background: transparent;
    border: none;
  }
`;

// ── ColorPicker ────────────────────────────────────────

export interface ColorPickerProps {
  /** Hex color string, e.g. "#ff0000" */
  value: string;
  /** Called with hex string on change */
  onChange: (hex: string) => void;
  /** Show opacity slider (default: false) */
  showOpacity?: boolean;
  /** If provided, shows an "Advanced" button that calls this callback */
  onOpenBuilder?: () => void;
}

export function ColorPicker({
  value,
  onChange,
  showOpacity = false,
  onOpenBuilder,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hsva, setHsva] = useState<HSVA>(() => {
    const parsed = parseHex(value);
    return parsed
      ? rgbaToHsva(parsed)
      : { h: 0, s: 0, v: 0, a: 1 };
  });
  const [hexInput, setHexInput] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const lastEmittedHex = useRef(value);

  // Position the dropdown when opening
  useEffect(() => {
    if (!open || !containerRef.current) {
      setDropdownPos(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const pickerWidth = 224; // w-56 = 14rem = 224px
    const pickerHeight = 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < pickerHeight ? rect.top - pickerHeight - 4 : rect.bottom + 4;
    // Clamp horizontally so the picker stays within the viewport
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - pickerWidth - 8));
    setDropdownPos({ top, left });
  }, [open]);

  // Sync external value changes (skip if value matches what we last emitted)
  useEffect(() => {
    if (value.toLowerCase() === lastEmittedHex.current.toLowerCase()) return;
    lastEmittedHex.current = value;
    const parsed = parseHex(value);
    if (parsed) {
      setHsva(rgbaToHsva(parsed));
      setHexInput(value);
    }
  }, [value]);

  // Emit hex on hsva change
  const updateFromHsva = useCallback(
    (next: HSVA) => {
      setHsva(next);
      const hex = formatHex(hsvaToRgba(next));
      setHexInput(hex);
      lastEmittedHex.current = hex;
      onChange(hex);
    },
    [onChange]
  );

  const commitHex = useCallback(() => {
    const parsed = parseHex(hexInput);
    if (parsed) {
      const next = rgbaToHsva(parsed);
      setHsva(next);
      const hex = formatHex(parsed);
      lastEmittedHex.current = hex;
      onChange(hex);
    } else {
      setHexInput(value);
    }
  }, [hexInput, value, onChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <style>{COLOR_PICKER_SLIDER_STYLES}</style>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-6 h-6 rounded border border-border cursor-pointer shrink-0"
          style={{ background: value }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value);
            const parsed = parseHex(e.target.value);
            if (parsed) {
              const next = rgbaToHsva(parsed);
              setHsva(next);
              const hex = formatHex(parsed);
              lastEmittedHex.current = hex;
              onChange(hex);
            }
          }}
          onBlur={commitHex}
          onKeyDown={(e) => e.key === "Enter" && commitHex()}
          className="flex-1 min-w-0 text-xs bg-transparent border border-border rounded px-1.5 py-0.5 font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={showOpacity ? 9 : 7}
          spellCheck={false}
        />
      </div>

      {open &&
        dropdownPos &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[100] w-56 rounded-lg border bg-popover p-3 shadow-lg space-y-3"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SVPicker
              hsva={hsva}
              onChange={(s, v) => updateFromHsva({ ...hsva, s, v })}
            />
            <HueSlider
              hue={hsva.h}
              onChange={(h) => updateFromHsva({ ...hsva, h })}
            />
            {showOpacity && (
              <OpacitySlider
                hsva={hsva}
                onChange={(a) => updateFromHsva({ ...hsva, a })}
              />
            )}
            {onOpenBuilder && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenBuilder();
                }}
                className="flex items-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border cursor-pointer"
              >
                <Paintbrush className="h-3 w-3" />
                Color Builder
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
