"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dices,
  Copy,
  Check,
  RefreshCw,
  X,
} from "lucide-react";
import {
  generate,
  GENERATOR_INFO,
  GENERATOR_TYPES,
  DEFAULT_CONFIG,
  type GeneratorType,
  type GeneratorConfig,
} from "@/lib/tools/random";

interface GeneratedItem {
  id: number;
  type: GeneratorType;
  value: string;
}

let nextId = 0;

function isValidType(t: string | null): t is GeneratorType {
  return !!t && GENERATOR_TYPES.includes(t as GeneratorType);
}

export function RandomGenerator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramType = searchParams.get("t");
  const [activeType, setActiveType] = useState<GeneratorType>(
    isValidType(paramType) ? paramType : "uuid"
  );

  // Sync state when URL param changes externally (e.g. via search launcher)
  useEffect(() => {
    if (isValidType(paramType) && paramType !== activeType) {
      setActiveType(paramType);
    }
  }, [paramType]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveTypeWithParam = useCallback(
    (type: GeneratorType) => {
      setActiveType(type);
      const params = new URLSearchParams(searchParams.toString());
      params.set("t", type);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );
  const [config, setConfig] = useState<GeneratorConfig>({ ...DEFAULT_CONFIG });
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [count, setCount] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(() => {
    const newItems: GeneratedItem[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push({
        id: nextId++,
        type: activeType,
        value: generate(activeType, config),
      });
    }
    setResults((prev) => [...newItems, ...prev]);
    setTimeout(() => {
      resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  }, [activeType, config, count]);

  const handleCopy = useCallback(async (item: GeneratedItem) => {
    await navigator.clipboard.writeText(item.value);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleCopyAll = useCallback(async () => {
    if (!results.length) return;
    await navigator.clipboard.writeText(
      results.map((r) => r.value).join("\n")
    );
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [results]);

  const handleClear = useCallback(() => {
    setResults([]);
  }, []);

  const handleRemove = useCallback((id: number) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateConfig = useCallback(
    <K extends keyof GeneratorConfig>(key: K, value: GeneratorConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Dices className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Random</span>

          <div className="flex items-center gap-1 ml-auto">
            {results.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAll}
                  className="h-6 px-2 text-xs"
                >
                  {copiedAll ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  {copiedAll ? "Copied" : `Copy all (${results.length})`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-6 px-2 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-auto" ref={resultsRef}>
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
          {/* Generator type tabs */}
          <div className="flex flex-wrap gap-1">
            {GENERATOR_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveTypeWithParam(type)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  activeType === type
                    ? "bg-foreground text-background font-medium"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {GENERATOR_INFO[type].label}
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {GENERATOR_INFO[activeType].description}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <TypeOptions
                type={activeType}
                config={config}
                updateConfig={updateConfig}
              />

              {/* Count */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Count
                </label>
                <Select value={String(count)} onValueChange={(v) => v && setCount(Number(v))}>
                  <SelectTrigger size="sm" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 5, 10, 25, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate button */}
              <Button onClick={handleGenerate} size="sm" className="h-8 gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Generate
              </Button>
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((item) => (
                <ResultRow
                  key={item.id}
                  item={item}
                  copied={copiedId === item.id}
                  onCopy={handleCopy}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground/50 text-sm">
              Click Generate to create random values
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TRUNCATE_LENGTH = 200;

function ResultRow({
  item,
  copied,
  onCopy,
  onRemove,
}: {
  item: GeneratedItem;
  copied: boolean;
  onCopy: (item: GeneratedItem) => void;
  onRemove: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.value.length > TRUNCATE_LENGTH;

  return (
    <div className="group bg-muted/40 rounded px-3 py-2 hover:bg-muted/60 transition-colors">
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-muted-foreground/50 uppercase w-14 shrink-0 pt-0.5">
          {GENERATOR_INFO[item.type].label}
        </span>
        <span className="font-mono text-sm flex-1 min-w-0 break-all select-all whitespace-pre-wrap">
          {isLong && !expanded
            ? item.value.slice(0, TRUNCATE_LENGTH) + "…"
            : item.value}
        </span>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(item)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 ml-16"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function TypeOptions({
  type,
  config,
  updateConfig,
}: {
  type: GeneratorType;
  config: GeneratorConfig;
  updateConfig: <K extends keyof GeneratorConfig>(
    key: K,
    value: GeneratorConfig[K]
  ) => void;
}) {
  switch (type) {
    case "uuid":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Version
          </label>
          <Select value={config.uuidVersion} onValueChange={(v) => v && updateConfig("uuidVersion", v as "v4" | "v7")}>
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="v4">v4 (random)</SelectItem>
              <SelectItem value="v7">v7 (time-ordered)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "password":
      return (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Length
            </label>
            <input
              type="number"
              min={4}
              max={128}
              value={config.passwordLength}
              onChange={(e) =>
                updateConfig("passwordLength", Number(e.target.value))
              }
              className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-16"
            />
          </div>
          <div className="flex items-center gap-3 py-1.5">
            {(
              [
                ["passwordUppercase", "A-Z"],
                ["passwordLowercase", "a-z"],
                ["passwordDigits", "0-9"],
                ["passwordSymbols", "!@#"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config[key]}
                  onChange={(e) => updateConfig(key, e.target.checked)}
                  className="rounded border-input"
                />
                <span className="font-mono text-muted-foreground">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Exclude
            </label>
            <input
              type="text"
              value={config.passwordExclude}
              onChange={(e) => updateConfig("passwordExclude", e.target.value)}
              placeholder="e.g. 0Ol1I"
              className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-24 font-mono"
            />
          </div>
        </>
      );

    case "secret":
      return (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Bytes
            </label>
            <input
              type="number"
              min={8}
              max={256}
              value={config.secretLength}
              onChange={(e) =>
                updateConfig("secretLength", Number(e.target.value))
              }
              className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-16"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Format
            </label>
            <Select value={config.secretFormat} onValueChange={(v) => v && updateConfig("secretFormat", v as "hex" | "base64" | "base64url")}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">Hex</SelectItem>
                <SelectItem value="base64">Base64</SelectItem>
                <SelectItem value="base64url">Base64url</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );

    case "hex":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Length (chars)
          </label>
          <input
            type="number"
            min={2}
            max={512}
            value={config.hexLength}
            onChange={(e) => updateConfig("hexLength", Number(e.target.value))}
            className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-16"
          />
        </div>
      );

    case "base64":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Bytes
          </label>
          <input
            type="number"
            min={4}
            max={256}
            value={config.base64ByteLength}
            onChange={(e) =>
              updateConfig("base64ByteLength", Number(e.target.value))
            }
            className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-16"
          />
        </div>
      );

    case "number":
      return (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Min
            </label>
            <input
              type="number"
              value={config.numberMin}
              onChange={(e) =>
                updateConfig("numberMin", Number(e.target.value))
              }
              className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Max
            </label>
            <input
              type="number"
              value={config.numberMax}
              onChange={(e) =>
                updateConfig("numberMax", Number(e.target.value))
              }
              className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-24"
            />
          </div>
        </>
      );

    case "lorem":
      return (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Count
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={config.loremCount}
              onChange={(e) =>
                updateConfig("loremCount", Number(e.target.value))
              }
              className="text-xs bg-transparent border border-input rounded px-2 py-1.5 outline-none focus:border-ring w-16"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Unit
            </label>
            <Select value={config.loremUnit} onValueChange={(v) => v && updateConfig("loremUnit", v as "words" | "sentences" | "paragraphs")}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="words">Words</SelectItem>
                <SelectItem value="sentences">Sentences</SelectItem>
                <SelectItem value="paragraphs">Paragraphs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
  }
}
