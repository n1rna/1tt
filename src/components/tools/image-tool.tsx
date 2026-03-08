"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Image as ImageIcon, Upload, X, Download, Lock, Unlock, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────

type OutputFormat = "image/png" | "image/jpeg" | "image/webp" | "image/avif";

interface ImageInfo {
  width: number;
  height: number;
  size: number;
  type: string;
  name: string;
}

interface ProcessedResult {
  dataUrl: string;
  blob: Blob | null;
  width: number;
  height: number;
  estimatedSize: number;
  format: OutputFormat;
}

// ── Constants ─────────────────────────────────────────

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/webp", label: "WebP" },
  { value: "image/avif", label: "AVIF" },
];

const ACCEPTED_TYPES =
  "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/avif";

const FORMAT_EXT: Record<OutputFormat, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

const SIZE_PRESETS = [
  { label: "0.25x", factor: 0.25 },
  { label: "0.5x", factor: 0.5 },
  { label: "1x", factor: 1 },
  { label: "2x", factor: 2 },
  { label: "3x", factor: 3 },
];

// ── Helpers ───────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Main component ────────────────────────────────────

export function ImageTool() {
  // Source image state
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [sourceInfo, setSourceInfo] = useState<ImageInfo | null>(null);
  const [sourceSrc, setSourceSrc] = useState("");
  const [dragging, setDragging] = useState(false);

  // Settings
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(90);
  const [targetWidth, setTargetWidth] = useState("");
  const [targetHeight, setTargetHeight] = useState("");
  const [lockAspect, setLockAspect] = useState(true);

  // Output state
  const [result, setResult] = useState<ProcessedResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processIdRef = useRef(0);

  // ── Load image from file ──────────────────────────

  const loadFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setSourceSrc(url);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setSourceImg(img);
      setSourceInfo({
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: file.size,
        type: file.type || "unknown",
        name: file.name,
      });
      setTargetWidth(String(img.naturalWidth));
      setTargetHeight(String(img.naturalHeight));
      setResult(null);
    };
    img.src = url;
  }, []);

  // ── Process image ─────────────────────────────────

  const processImage = useCallback(
    (
      img: HTMLImageElement,
      fmt: OutputFormat,
      qual: number,
      twStr: string,
      thStr: string,
    ) => {
      const id = ++processIdRef.current;
      setProcessing(true);

      setTimeout(() => {
        if (id !== processIdRef.current) return;

        const tw = parseInt(twStr, 10) || img.naturalWidth;
        const th = parseInt(thStr, 10) || img.naturalHeight;

        const canvas = canvasRef.current;
        if (!canvas) { setProcessing(false); return; }

        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setProcessing(false); return; }

        ctx.clearRect(0, 0, tw, th);
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, tw, th);

        const qualFraction = fmt === "image/png" ? undefined : qual / 100;
        const dataUrl = canvas.toDataURL(fmt, qualFraction);

        if (id !== processIdRef.current) return;

        const blob = dataUrlToBlob(dataUrl);
        setResult({
          dataUrl,
          blob,
          width: tw,
          height: th,
          estimatedSize: blob.size,
          format: fmt,
        });
        setProcessing(false);
      }, 0);
    },
    [],
  );

  // ── Debounced auto-process ────────────────────────

  useEffect(() => {
    if (!sourceImg) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      processImage(sourceImg, outputFormat, quality, targetWidth, targetHeight);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceImg, outputFormat, quality, targetWidth, targetHeight, processImage]);

  // ── Aspect ratio locking ──────────────────────────

  const handleWidthChange = useCallback(
    (val: string) => {
      setTargetWidth(val);
      if (lockAspect && sourceImg && val !== "") {
        const w = parseInt(val, 10);
        if (!isNaN(w) && w > 0) {
          const ratio = sourceImg.naturalHeight / sourceImg.naturalWidth;
          setTargetHeight(String(Math.round(w * ratio)));
        }
      }
    },
    [lockAspect, sourceImg],
  );

  const handleHeightChange = useCallback(
    (val: string) => {
      setTargetHeight(val);
      if (lockAspect && sourceImg && val !== "") {
        const h = parseInt(val, 10);
        if (!isNaN(h) && h > 0) {
          const ratio = sourceImg.naturalWidth / sourceImg.naturalHeight;
          setTargetWidth(String(Math.round(h * ratio)));
        }
      }
    },
    [lockAspect, sourceImg],
  );

  const applyPreset = useCallback(
    (factor: number) => {
      if (!sourceImg) return;
      const w = Math.round(sourceImg.naturalWidth * factor);
      const h = Math.round(sourceImg.naturalHeight * factor);
      setTargetWidth(String(w));
      setTargetHeight(String(h));
    },
    [sourceImg],
  );

  // ── File drop / pick ──────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) loadFile(file);
    },
    [loadFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const clearImage = useCallback(() => {
    if (sourceSrc) URL.revokeObjectURL(sourceSrc);
    setSourceImg(null);
    setSourceInfo(null);
    setSourceSrc("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [sourceSrc]);

  // ── Download ──────────────────────────────────────

  const handleDownload = useCallback(() => {
    if (!result || !sourceInfo) return;
    const ext = FORMAT_EXT[result.format];
    const baseName = stripExtension(sourceInfo.name);
    const fileName = `${baseName}_${result.width}x${result.height}.${ext}`;
    const a = document.createElement("a");
    a.href = result.dataUrl;
    a.download = fileName;
    a.click();
  }, [result, sourceInfo]);

  // ── Copy to clipboard ─────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!result?.blob) return;
    try {
      // ClipboardItem only supports PNG reliably across browsers
      let blobToCopy = result.blob;
      if (result.format !== "image/png") {
        // Re-encode as PNG for clipboard
        const canvas = canvasRef.current;
        if (canvas) {
          const pngDataUrl = canvas.toDataURL("image/png");
          blobToCopy = dataUrlToBlob(pngDataUrl);
        }
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobToCopy }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [result]);

  // Current preset match
  const currentPreset = sourceImg
    ? SIZE_PRESETS.find((p) => {
        const w = Math.round(sourceImg.naturalWidth * p.factor);
        const h = Math.round(sourceImg.naturalHeight * p.factor);
        return String(w) === targetWidth && String(h) === targetHeight;
      })
    : null;

  // ── Render ────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      <canvas ref={canvasRef} className="hidden" />

      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Image</span>
          {processing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />
          )}
          {result && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={handleDownload}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-5">
          {/* Drop zone */}
          {!sourceImg && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileInput}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`w-full flex flex-col items-center gap-3 px-6 py-16 rounded-lg border-2 border-dashed transition-colors ${
                  dragging
                    ? "border-foreground/50 bg-muted/30 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <Upload className="h-10 w-10" />
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium">Drop an image or click to browse</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Controls + preview */}
          {sourceImg && (
            <>
              {/* Settings */}
              <div className="space-y-3">
                {/* Row 1: Format badges + quality */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">Format</span>
                  <div className="flex items-center gap-1">
                    {OUTPUT_FORMATS.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setOutputFormat(f.value)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          outputFormat === f.value
                            ? "bg-foreground text-background border-foreground"
                            : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/50"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {(outputFormat === "image/jpeg" || outputFormat === "image/webp") && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-muted-foreground">Quality</span>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="w-24 h-1.5 accent-foreground cursor-pointer"
                      />
                      <span className="text-xs font-mono text-muted-foreground w-8">{quality}%</span>
                    </div>
                  )}

                  <button
                    onClick={clearImage}
                    className="p-1.5 rounded-md border text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    title="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Row 2: Size presets + dimensions */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">Size</span>
                  <div className="flex items-center gap-1">
                    {SIZE_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => applyPreset(p.factor)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          currentPreset?.factor === p.factor
                            ? "bg-foreground text-background border-foreground"
                            : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 ml-2">
                    <input
                      type="number"
                      min={1}
                      value={targetWidth}
                      onChange={(e) => handleWidthChange(e.target.value)}
                      className="w-20 h-7 px-2 text-xs rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      placeholder="W"
                    />
                    <button
                      onClick={() => setLockAspect((v) => !v)}
                      className={`p-1 rounded-md border transition-colors ${
                        lockAspect
                          ? "text-foreground border-foreground/50"
                          : "text-muted-foreground border-border"
                      }`}
                      title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    >
                      {lockAspect ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={targetHeight}
                      onChange={(e) => handleHeightChange(e.target.value)}
                      className="w-20 h-7 px-2 text-xs rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      placeholder="H"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                </div>
              </div>

              {/* Info bar */}
              {sourceInfo && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground px-3 py-2 rounded-lg border bg-muted/20">
                  <span>
                    <span className="text-foreground font-medium">Original</span>
                    {"  "}
                    {sourceInfo.width} × {sourceInfo.height}px · {formatBytes(sourceInfo.size)}
                    {sourceInfo.type !== "unknown"
                      ? ` · ${sourceInfo.type.replace("image/", "").toUpperCase()}`
                      : ""}
                  </span>
                  {result && !processing && (
                    <span>
                      <span className="text-foreground font-medium">Output</span>
                      {"  "}
                      {result.width} × {result.height}px · {formatBytes(result.estimatedSize)}
                      {" · "}
                      {result.format.replace("image/", "").toUpperCase()}
                    </span>
                  )}
                  {processing && <span>Processing...</span>}
                </div>
              )}

              {/* Side-by-side previews */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Original</p>
                  <div className="rounded-lg border bg-muted/10 overflow-hidden flex items-center justify-center min-h-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sourceSrc}
                      alt="Original"
                      className="max-w-full max-h-72 object-contain"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Output</p>
                  <div className="rounded-lg border bg-muted/10 overflow-hidden flex items-center justify-center min-h-40">
                    {processing ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : result ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.dataUrl}
                        alt="Output"
                        className="max-w-full max-h-72 object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Processing...</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
