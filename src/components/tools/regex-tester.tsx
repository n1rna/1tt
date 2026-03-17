"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ToolLayout } from "@/components/layout/tool-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Share2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchResult {
  index: number;
  endIndex: number;
  fullMatch: string;
  groups: (string | undefined)[];
  namedGroups: Record<string, string | undefined> | null;
  matchIndex: number;
}

type RegexFlag = "g" | "i" | "m" | "s" | "u" | "y";

type CodeLang = "javascript" | "python" | "go";

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_FLAGS: { flag: RegexFlag; label: string; title: string }[] = [
  { flag: "g", label: "g", title: "Global — find all matches" },
  { flag: "i", label: "i", title: "Case insensitive" },
  { flag: "m", label: "m", title: "Multiline — ^ and $ match line boundaries" },
  { flag: "s", label: "s", title: "Dotall — . matches newline" },
  { flag: "u", label: "u", title: "Unicode — treat pattern as Unicode" },
  { flag: "y", label: "y", title: "Sticky — match only from lastIndex" },
];

const HIGHLIGHT_COLORS = [
  { bg: "bg-yellow-200/80 dark:bg-yellow-500/40", border: "border-yellow-400 dark:border-yellow-500" },
  { bg: "bg-blue-200/80 dark:bg-blue-500/40", border: "border-blue-400 dark:border-blue-500" },
  { bg: "bg-green-200/80 dark:bg-green-500/40", border: "border-green-400 dark:border-green-500" },
  { bg: "bg-pink-200/80 dark:bg-pink-500/40", border: "border-pink-400 dark:border-pink-500" },
  { bg: "bg-purple-200/80 dark:bg-purple-500/40", border: "border-purple-400 dark:border-purple-500" },
  { bg: "bg-orange-200/80 dark:bg-orange-500/40", border: "border-orange-400 dark:border-orange-500" },
];

const COMMON_PATTERNS: { label: string; pattern: string; flags: string; description: string }[] = [
  { label: "Email", pattern: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}", flags: "gi", description: "Basic email address" },
  { label: "URL", pattern: "https?:\\/\\/(?:www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b[-a-zA-Z0-9()@:%_+.~#?&/=]*", flags: "gi", description: "HTTP/HTTPS URL" },
  { label: "IPv4", pattern: "\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b", flags: "g", description: "IPv4 address" },
  { label: "Hex Color", pattern: "#(?:[0-9a-fA-F]{3}){1,2}\\b", flags: "g", description: "CSS hex color (#fff or #ffffff)" },
  { label: "Date (YYYY-MM-DD)", pattern: "\\b(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b", flags: "g", description: "ISO 8601 date" },
  { label: "Phone (US)", pattern: "\\(?\\d{3}\\)?[\\s.\\-]?\\d{3}[\\s.\\-]?\\d{4}", flags: "g", description: "US phone number" },
  { label: "Slug", pattern: "[a-z0-9]+(?:-[a-z0-9]+)*", flags: "g", description: "URL slug" },
  { label: "Semver", pattern: "v?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[\\w.]+)?(?:\\+[\\w.]+)?", flags: "g", description: "Semantic version" },
  { label: "UUID", pattern: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", flags: "gi", description: "UUID v4" },
  { label: "JWT", pattern: "ey[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+", flags: "g", description: "JSON Web Token" },
  { label: "HTML Tag", pattern: "<([a-zA-Z][a-zA-Z0-9]*)(?:\\s[^>]*)?>", flags: "g", description: "HTML opening tag" },
  { label: "Credit Card", pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\\b", flags: "g", description: "Major credit card numbers" },
];

const CHEAT_SHEET: { group: string; items: { syntax: string; desc: string }[] }[] = [
  {
    group: "Character Classes",
    items: [
      { syntax: ".", desc: "Any character except newline" },
      { syntax: "\\w", desc: "Word character [a-zA-Z0-9_]" },
      { syntax: "\\W", desc: "Non-word character" },
      { syntax: "\\d", desc: "Digit [0-9]" },
      { syntax: "\\D", desc: "Non-digit" },
      { syntax: "\\s", desc: "Whitespace (space, tab, newline)" },
      { syntax: "\\S", desc: "Non-whitespace" },
      { syntax: "[abc]", desc: "Character set — a, b, or c" },
      { syntax: "[^abc]", desc: "Negated set — not a, b, or c" },
      { syntax: "[a-z]", desc: "Range — a through z" },
    ],
  },
  {
    group: "Anchors",
    items: [
      { syntax: "^", desc: "Start of string (or line with m flag)" },
      { syntax: "$", desc: "End of string (or line with m flag)" },
      { syntax: "\\b", desc: "Word boundary" },
      { syntax: "\\B", desc: "Non-word boundary" },
    ],
  },
  {
    group: "Quantifiers",
    items: [
      { syntax: "*", desc: "0 or more (greedy)" },
      { syntax: "+", desc: "1 or more (greedy)" },
      { syntax: "?", desc: "0 or 1 (optional)" },
      { syntax: "{n}", desc: "Exactly n times" },
      { syntax: "{n,}", desc: "n or more times" },
      { syntax: "{n,m}", desc: "Between n and m times" },
      { syntax: "*?", desc: "0 or more (lazy)" },
      { syntax: "+?", desc: "1 or more (lazy)" },
    ],
  },
  {
    group: "Groups & Lookaround",
    items: [
      { syntax: "(abc)", desc: "Capture group" },
      { syntax: "(?<name>abc)", desc: "Named capture group" },
      { syntax: "(?:abc)", desc: "Non-capturing group" },
      { syntax: "(?=abc)", desc: "Positive lookahead" },
      { syntax: "(?!abc)", desc: "Negative lookahead" },
      { syntax: "(?<=abc)", desc: "Positive lookbehind" },
      { syntax: "(?<!abc)", desc: "Negative lookbehind" },
      { syntax: "a|b", desc: "Alternation — a or b" },
    ],
  },
  {
    group: "Escapes",
    items: [
      { syntax: "\\n", desc: "Newline" },
      { syntax: "\\t", desc: "Tab" },
      { syntax: "\\r", desc: "Carriage return" },
      { syntax: "\\\\", desc: "Literal backslash" },
      { syntax: "\\.", desc: "Literal dot" },
    ],
  },
];

// ─── Code generation ─────────────────────────────────────────────────────────

function generateCode(pattern: string, flags: string, replace: string, replaceMode: boolean, lang: CodeLang): string {
  if (!pattern) return "";
  const escapedPattern = pattern.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

  if (lang === "javascript") {
    const lines: string[] = [];
    lines.push(`const regex = /${pattern.replace(/\//g, "\\/")}/${flags};`);
    lines.push(`const text = \`your string here\`;`);
    lines.push(``);
    if (replaceMode) {
      lines.push(`const result = text.replace(regex, ${JSON.stringify(replace)});`);
      lines.push(`console.log(result);`);
    } else if (flags.includes("g")) {
      lines.push(`const matches = [...text.matchAll(regex)];`);
      lines.push(`console.log(\`Found \${matches.length} match(es)\`);`);
      lines.push(`matches.forEach((m, i) => {`);
      lines.push(`  console.log(\`Match \${i + 1}: "\${m[0]}" at index \${m.index}\`);`);
      lines.push(`});`);
    } else {
      lines.push(`const match = text.match(regex);`);
      lines.push(`if (match) {`);
      lines.push(`  console.log(\`Match: "\${match[0]}" at index \${match.index}\`);`);
      lines.push(`}`);
    }
    return lines.join("\n");
  }

  if (lang === "python") {
    const pyFlags: string[] = [];
    if (flags.includes("i")) pyFlags.push("re.IGNORECASE");
    if (flags.includes("m")) pyFlags.push("re.MULTILINE");
    if (flags.includes("s")) pyFlags.push("re.DOTALL");
    const flagStr = pyFlags.length ? `, ${pyFlags.join(" | ")}` : "";
    const lines: string[] = [];
    lines.push(`import re`);
    lines.push(``);
    lines.push(`pattern = r"${pattern.replace(/"/g, '\\"')}"`);
    lines.push(`text = "your string here"`);
    lines.push(``);
    if (replaceMode) {
      lines.push(`result = re.sub(pattern, ${JSON.stringify(replace)}, text${flagStr})`);
      lines.push(`print(result)`);
    } else if (flags.includes("g")) {
      lines.push(`matches = re.findall(pattern, text${flagStr})`);
      lines.push(`print(f"Found {len(matches)} match(es): {matches}")`);
    } else {
      lines.push(`match = re.search(pattern, text${flagStr})`);
      lines.push(`if match:`);
      lines.push(`    print(f'Match: "{match.group()}" at index {match.start()}')`);
    }
    return lines.join("\n");
  }

  if (lang === "go") {
    const lines: string[] = [];
    lines.push(`package main`);
    lines.push(``);
    lines.push(`import (`);
    lines.push(`\t"fmt"`);
    lines.push(`\t"regexp"`);
    lines.push(`)`);
    lines.push(``);
    lines.push(`func main() {`);
    const goPattern = flags.includes("i")
      ? `(?i)${pattern.replace(/"/g, '\\"')}`
      : pattern.replace(/"/g, '\\"');
    lines.push(`\tre := regexp.MustCompile(\`${goPattern}\`)`);
    lines.push(`\ttext := "your string here"`);
    lines.push(``);
    if (replaceMode) {
      lines.push(`\tresult := re.ReplaceAllString(text, ${JSON.stringify(replace)})`);
      lines.push(`\tfmt.Println(result)`);
    } else if (flags.includes("g")) {
      lines.push(`\tmatches := re.FindAllString(text, -1)`);
      lines.push(`\tfmt.Printf("Found %d match(es): %v\\n", len(matches), matches)`);
    } else {
      lines.push(`\tmatch := re.FindString(text)`);
      lines.push(`\tif match != "" {`);
      lines.push(`\t\tfmt.Printf("Match: %q\\n", match)`);
      lines.push(`\t}`);
    }
    lines.push(`}`);
    return lines.join("\n");
  }

  return "";
}

// ─── Highlight Overlay ───────────────────────────────────────────────────────

interface HighlightSegment {
  text: string;
  type: "plain" | "match" | "group";
  colorIndex: number;
  groupIndex?: number;
}

function buildSegments(text: string, matches: MatchResult[], highlightGroups: boolean): HighlightSegment[] {
  if (!text || matches.length === 0) {
    return [{ text, type: "plain", colorIndex: -1 }];
  }

  // Build a map of character positions to highlight info
  // Priority: group > full match
  const segments: HighlightSegment[] = [];
  let pos = 0;

  // Collect all intervals sorted by start
  interface Interval {
    start: number;
    end: number;
    colorIndex: number;
    type: "match" | "group";
    groupIndex?: number;
  }
  const intervals: Interval[] = [];

  for (let mi = 0; mi < matches.length; mi++) {
    const m = matches[mi];
    // Full match always gets color 0
    intervals.push({ start: m.index, end: m.endIndex, colorIndex: 0, type: "match" });

    // Groups get colors 1+
    if (highlightGroups) {
      for (let gi = 0; gi < m.groups.length; gi++) {
        // We need group positions — use a workaround: re-exec to get indices
        // Actually we don't have group indices without the /d flag — skip precise group coloring
        // and just color the whole match for now with group count hint
      }
    }
  }

  // Sort and merge
  intervals.sort((a, b) => a.start - b.start || b.end - a.end);

  for (const iv of intervals) {
    if (iv.start > pos) {
      segments.push({ text: text.slice(pos, iv.start), type: "plain", colorIndex: -1 });
    }
    if (iv.end > pos) {
      segments.push({
        text: text.slice(Math.max(pos, iv.start), iv.end),
        type: iv.type,
        colorIndex: iv.colorIndex,
      });
      pos = iv.end;
    }
  }

  if (pos < text.length) {
    segments.push({ text: text.slice(pos), type: "plain", colorIndex: -1 });
  }

  return segments;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlagBadge({
  flag,
  title,
  active,
  onToggle,
}: {
  flag: string;
  title: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded text-xs font-mono font-semibold border transition-colors cursor-pointer select-none",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
      )}
    >
      {flag}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RegexTester() {
  // ── State ──
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState<Set<RegexFlag>>(new Set(["g"]));
  const [testString, setTestString] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceWith, setReplaceWith] = useState("");
  const [cheatOpen, setCheatOpen] = useState(false);
  const [codeLang, setCodeLang] = useState<CodeLang>("javascript");
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── URL hash sync ──
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    try {
      const decoded = JSON.parse(decodeURIComponent(hash));
      if (decoded.pattern !== undefined) setPattern(decoded.pattern);
      if (decoded.flags) setFlags(new Set(decoded.flags.split("") as RegexFlag[]));
      if (decoded.test !== undefined) setTestString(decoded.test);
      if (decoded.replace !== undefined) setReplaceWith(decoded.replace);
      if (decoded.replaceMode !== undefined) setReplaceMode(decoded.replaceMode);
    } catch {
      // ignore malformed hash
    }
  }, []);

  const shareUrl = useCallback(() => {
    const obj: Record<string, unknown> = {
      pattern,
      flags: [...flags].join(""),
      test: testString,
    };
    if (replaceMode) {
      obj.replaceMode = true;
      obj.replace = replaceWith;
    }
    const hash = encodeURIComponent(JSON.stringify(obj));
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", `#${hash}`);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }, [pattern, flags, testString, replaceMode, replaceWith]);

  // ── Regex computation ──
  const { matches, error, replacedText } = useMemo(() => {
    if (!pattern) return { matches: [], error: null, replacedText: "" };

    const flagStr = [...flags].join("");

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flagStr);
    } catch (e) {
      return { matches: [], error: (e as Error).message, replacedText: "" };
    }

    const results: MatchResult[] = [];

    if (flags.has("g") || flags.has("y")) {
      try {
        const iter = testString.matchAll(new RegExp(pattern, flagStr));
        let mi = 0;
        for (const m of iter) {
          results.push({
            index: m.index ?? 0,
            endIndex: (m.index ?? 0) + m[0].length,
            fullMatch: m[0],
            groups: m.slice(1),
            namedGroups: m.groups ? { ...m.groups } : null,
            matchIndex: mi++,
          });
          if (mi > 500) break; // safety cap
        }
      } catch (e) {
        return { matches: [], error: (e as Error).message, replacedText: "" };
      }
    } else {
      const m = testString.match(regex);
      if (m) {
        results.push({
          index: m.index ?? 0,
          endIndex: (m.index ?? 0) + m[0].length,
          fullMatch: m[0],
          groups: m.slice(1),
          namedGroups: m.groups ? { ...m.groups } : null,
          matchIndex: 0,
        });
      }
    }

    let replacedText = "";
    if (replaceMode && !error) {
      try {
        replacedText = testString.replace(new RegExp(pattern, flagStr), replaceWith);
      } catch {
        replacedText = "";
      }
    }

    return { matches: results, error: null, replacedText };
  }, [pattern, flags, testString, replaceMode, replaceWith]);

  // ── Highlight overlay sync scroll ──
  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // ── Segments for highlight ──
  const segments = useMemo(
    () => buildSegments(testString, matches, true),
    [testString, matches]
  );

  // ── Helpers ──
  const toggleFlag = (f: RegexFlag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
    setSelectedMatchIndex(null);
  };

  const applyPattern = (p: { pattern: string; flags: string }) => {
    setPattern(p.pattern);
    const newFlags = new Set<RegexFlag>();
    for (const ch of p.flags) {
      if (["g", "i", "m", "s", "u", "y"].includes(ch)) {
        newFlags.add(ch as RegexFlag);
      }
    }
    setFlags(newFlags);
    setSelectedMatchIndex(null);
  };

  const flagStr = [...flags].join("");
  const codeSnippet = useMemo(
    () => generateCode(pattern, flagStr, replaceWith, replaceMode, codeLang),
    [pattern, flagStr, replaceWith, replaceMode, codeLang]
  );

  // ── Render ──
  return (
    <ToolLayout slug="regex">
      <div className="flex flex-col gap-4">
        {/* ── Regex Input Row ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0 relative">
              {/* Delimiter decoration */}
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm select-none pointer-events-none">
                /
              </span>
              <input
                type="text"
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value);
                  setSelectedMatchIndex(null);
                }}
                placeholder="Enter regex pattern…"
                spellCheck={false}
                className={cn(
                  "w-full h-9 pl-6 pr-6 rounded-md border bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
                  error ? "border-destructive focus:ring-destructive/30" : "border-input"
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm select-none pointer-events-none">
                /
              </span>
            </div>

            {/* Flags */}
            <div className="flex items-center gap-1">
              {ALL_FLAGS.map(({ flag, label, title }) => (
                <FlagBadge
                  key={flag}
                  flag={label}
                  title={title}
                  active={flags.has(flag)}
                  onToggle={() => toggleFlag(flag)}
                />
              ))}
            </div>

            {/* Match count badge */}
            {pattern && !error && (
              <Badge
                variant={matches.length > 0 ? "default" : "secondary"}
                className="shrink-0 font-mono text-xs"
              >
                {matches.length} match{matches.length !== 1 ? "es" : ""}
              </Badge>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 ml-auto">
              {/* Common patterns dropdown */}
              <Select
                value=""
                onValueChange={(val) => {
                  const p = COMMON_PATTERNS[parseInt(val as string)];
                  if (p) applyPattern(p);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-auto gap-1.5 shrink-0">
                  <SelectValue placeholder="Patterns…" />
                </SelectTrigger>
                <SelectContent className="w-auto min-w-[280px]">
                  {COMMON_PATTERNS.map((p, i) => (
                    <SelectItem key={i} value={String(i)} className="text-xs">
                      <span className="font-medium">{p.label}</span>
                      <span className="text-muted-foreground ml-1.5">— {p.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => {
                  setPattern("");
                  setTestString("");
                  setReplaceWith("");
                  setFlags(new Set(["g"]));
                  setSelectedMatchIndex(null);
                  window.history.replaceState(null, "", window.location.pathname);
                }}
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={shareUrl}
              >
                {urlCopied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Share2 className="h-3 w-3" />
                )}
                Share
              </Button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-destructive font-mono px-1">
              Invalid pattern: {error}
            </p>
          )}
        </div>

        {/* ── Main Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Left: Test string + replace ── */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Test string with highlight overlay */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Test String</label>
                <span className="text-xs text-muted-foreground ml-auto">
                  {testString.length} chars
                </span>
              </div>
              <div className="relative rounded-md border border-input overflow-hidden bg-background focus-within:ring-2 focus-within:ring-ring">
                {/* Highlight overlay */}
                <div
                  ref={overlayRef}
                  aria-hidden="true"
                  className="absolute inset-0 p-3 font-mono text-sm whitespace-pre-wrap break-words pointer-events-none overflow-hidden z-10"
                  style={{ color: "transparent" }}
                >
                  {segments.map((seg, i) => {
                    if (seg.type === "plain") {
                      return <span key={i}>{seg.text}</span>;
                    }
                    const color = HIGHLIGHT_COLORS[seg.colorIndex % HIGHLIGHT_COLORS.length];
                    return (
                      <span
                        key={i}
                        className={cn(
                          "rounded-sm border-b-2",
                          color.bg,
                          color.border
                        )}
                      >
                        {seg.text}
                      </span>
                    );
                  })}
                </div>
                {/* Actual textarea */}
                <textarea
                  ref={textareaRef}
                  value={testString}
                  onChange={(e) => {
                    setTestString(e.target.value);
                    setSelectedMatchIndex(null);
                  }}
                  onScroll={syncScroll}
                  placeholder="Paste or type your test string here…"
                  spellCheck={false}
                  rows={10}
                  className="relative z-20 w-full bg-transparent p-3 font-mono text-sm resize-y focus:outline-none caret-foreground"
                  style={{ caretColor: "var(--foreground)" }}
                />
              </div>
            </div>

            {/* Replace mode */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReplaceMode((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors",
                    replaceMode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  )}
                >
                  Replace Mode
                </button>
                {replaceMode && (
                  <span className="text-xs text-muted-foreground">
                    Use <code className="bg-muted px-1 rounded">$1</code>,{" "}
                    <code className="bg-muted px-1 rounded">$2</code> for capture groups,{" "}
                    <code className="bg-muted px-1 rounded">$&amp;</code> for full match
                  </span>
                )}
              </div>

              {replaceMode && (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={replaceWith}
                    onChange={(e) => setReplaceWith(e.target.value)}
                    placeholder="Replacement string ($1, $2, $&…)"
                    spellCheck={false}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {replacedText !== undefined && testString && pattern && !error && (
                    <div className="relative rounded-md border border-border bg-muted/30 p-3 font-mono text-sm whitespace-pre-wrap break-words min-h-[60px] max-h-48 overflow-auto">
                      <span className="absolute top-2 right-2">
                        <CopyButton text={replacedText} />
                      </span>
                      <span className="text-xs font-sans text-muted-foreground block mb-1.5">Result:</span>
                      {replacedText || <span className="text-muted-foreground italic">(empty)</span>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Code snippet */}
            {pattern && !error && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Code</label>
                  <div className="flex gap-1 ml-auto">
                    {(["javascript", "python", "go"] as CodeLang[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setCodeLang(lang)}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded border transition-colors",
                          codeLang === lang
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {lang === "javascript" ? "JS" : lang === "python" ? "Python" : "Go"}
                      </button>
                    ))}
                  </div>
                  <CopyButton text={codeSnippet} />
                </div>
                <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
                  {codeSnippet}
                </pre>
              </div>
            )}
          </div>

          {/* ── Right: Match details panel ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Matches</label>
              {matches.length > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {matches.length > 100 ? "100+" : matches.length} shown
                </span>
              )}
            </div>

            {!pattern ? (
              <div className="text-xs text-muted-foreground italic text-center py-8">
                Enter a pattern to see matches
              </div>
            ) : error ? (
              <div className="text-xs text-destructive text-center py-8">
                Fix the pattern to see matches
              </div>
            ) : matches.length === 0 ? (
              <div className="text-xs text-muted-foreground italic text-center py-8">
                No matches found
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
                {matches.slice(0, 100).map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setSelectedMatchIndex(selectedMatchIndex === i ? null : i)
                    }
                    className={cn(
                      "text-left rounded-md border p-2.5 text-xs transition-colors w-full",
                      selectedMatchIndex === i
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-foreground truncate flex-1">
                        {JSON.stringify(m.fullMatch)}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        [{m.index}…{m.endIndex}]
                      </span>
                    </div>

                    {selectedMatchIndex === i && (
                      <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Start:</span>
                          <span className="font-mono">{m.index}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">End:</span>
                          <span className="font-mono">{m.endIndex}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Length:</span>
                          <span className="font-mono">{m.fullMatch.length}</span>
                        </div>

                        {m.groups.length > 0 && (
                          <>
                            <div className="text-muted-foreground mt-1 font-medium">Groups:</div>
                            {m.groups.map((g, gi) => {
                              const namedKey =
                                m.namedGroups
                                  ? Object.entries(m.namedGroups).find(([, v]) => v === g && v !== undefined)?.[0]
                                  : undefined;
                              return (
                                <div key={gi} className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    {namedKey ? `$${gi + 1} (${namedKey})` : `$${gi + 1}`}:
                                  </span>
                                  <span className="font-mono truncate max-w-[120px]">
                                    {g === undefined ? (
                                      <span className="italic text-muted-foreground">undefined</span>
                                    ) : (
                                      JSON.stringify(g)
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Cheat Sheet ── */}
        <Collapsible open={cheatOpen} onOpenChange={setCheatOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              {cheatOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Regex Cheat Sheet
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CHEAT_SHEET.map((section) => (
                <div key={section.group} className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold mb-2">{section.group}</p>
                  <div className="flex flex-col gap-1">
                    {section.items.map((item) => (
                      <div key={item.syntax} className="flex gap-2 items-baseline">
                        <button
                          type="button"
                          title="Click to use this pattern"
                          onClick={() => {
                            setPattern(item.syntax);
                            setSelectedMatchIndex(null);
                          }}
                          className="font-mono text-xs text-primary hover:underline shrink-0 min-w-[80px] text-left"
                        >
                          {item.syntax}
                        </button>
                        <span className="text-xs text-muted-foreground leading-tight">
                          {item.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ToolLayout>
  );
}
