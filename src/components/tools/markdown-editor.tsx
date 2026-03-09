"use client";

import { useState, useCallback, useRef, useMemo, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  X,
  ClipboardPaste,
  FileText,
  Download,
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Link,
  Image,
  Table,
  Minus,
  Globe,
  FolderOpen,
  ExternalLink,
  Pencil,
  Loader2,
} from "lucide-react";
import { EditorScrollbar } from "./editor-scrollbar";
import { useSession } from "@/lib/auth-client";
import { PublishDialog } from "@/components/layout/publish-dialog";

interface PublishedPaste {
  id: string;
  title: string;
  format: string;
  visibility: string;
  size: number;
  createdAt: string;
  url: string;
}

export function MarkdownEditor() {
  const [markdown, setMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [publishedPastes, setPublishedPastes] = useState<PublishedPaste[]>([]);
  const [loadingPastes, setLoadingPastes] = useState(false);
  const { data: session } = useSession();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState([50, 50]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => markdown.split("\n"), [markdown]);
  const lineCount = lines.length;

  const handleCopy = useCallback(async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdown]);

  const handleClear = useCallback(() => {
    setMarkdown("");
    textareaRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    setMarkdown(text);
  }, []);

  const handleDownload = useCallback(() => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown]);

  // Insert markdown syntax at cursor position
  const insertAtCursor = useCallback(
    (before: string, after: string = "", placeholder: string = "") => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = markdown.substring(start, end);
      const text = selected || placeholder;
      const newValue =
        markdown.substring(0, start) +
        before +
        text +
        after +
        markdown.substring(end);
      setMarkdown(newValue);
      // Restore focus and selection
      requestAnimationFrame(() => {
        ta.focus();
        const cursorStart = start + before.length;
        const cursorEnd = cursorStart + text.length;
        ta.setSelectionRange(cursorStart, cursorEnd);
      });
    },
    [markdown]
  );

  // Insert at line start (for headings, lists, etc.)
  const insertAtLineStart = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const lineStart = markdown.lastIndexOf("\n", start - 1) + 1;
      const newValue =
        markdown.substring(0, lineStart) + prefix + markdown.substring(lineStart);
      setMarkdown(newValue);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + prefix.length, start + prefix.length);
      });
    },
    [markdown]
  );

  const insertBlock = useCallback(
    (block: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = ta.selectionStart;
      const needsNewline = pos > 0 && markdown[pos - 1] !== "\n";
      const insert = (needsNewline ? "\n" : "") + block + "\n";
      const newValue = markdown.substring(0, pos) + insert + markdown.substring(pos);
      setMarkdown(newValue);
      requestAnimationFrame(() => {
        ta.focus();
        const cursor = pos + insert.length;
        ta.setSelectionRange(cursor, cursor);
      });
    },
    [markdown]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "b") {
        e.preventDefault();
        insertAtCursor("**", "**", "bold");
      } else if (mod && e.key === "i") {
        e.preventDefault();
        insertAtCursor("*", "*", "italic");
      } else if (mod && e.key === "k") {
        e.preventDefault();
        insertAtCursor("[", "](url)", "link text");
      } else if (mod && e.key === "`") {
        e.preventDefault();
        insertAtCursor("`", "`", "code");
      } else if (e.key === "Tab") {
        e.preventDefault();
        insertAtCursor("  ");
      }
    },
    [insertAtCursor]
  );

  const handleResize = useCallback(
    (index: number, delta: number, containerWidth: number) => {
      setWidths((prev) => {
        const next = [...prev];
        const deltaPct = (delta / containerWidth) * 100;
        const newLeft = next[index] + deltaPct;
        const newRight = next[index + 1] - deltaPct;
        if (newLeft < 15 || newRight < 15) return prev;
        next[index] = newLeft;
        next[index + 1] = newRight;
        return next;
      });
    },
    []
  );

  // Render markdown to HTML
  const renderedHtml = useMemo(() => renderMarkdown(markdown), [markdown]);

  // Fetch published markdown pastes
  const fetchPublishedPastes = useCallback(async () => {
    if (!session) return;
    setLoadingPastes(true);
    try {
      const res = await fetch("/api/proxy/pastes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const all: PublishedPaste[] = data.pastes ?? data ?? [];
        setPublishedPastes(all.filter((p) => p.format === "markdown"));
      }
    } catch {
      // ignore
    } finally {
      setLoadingPastes(false);
    }
  }, [session]);

  // Fetch on first open
  const handleTogglePages = useCallback(() => {
    const next = !pagesOpen;
    setPagesOpen(next);
    if (next) fetchPublishedPastes();
  }, [pagesOpen, fetchPublishedPastes]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!pagesOpen) return;
    const handler = (e: MouseEvent) => {
      if (pagesRef.current && !pagesRef.current.contains(e.target as Node)) {
        setPagesOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pagesOpen]);

  // Refetch after publish dialog closes with a new paste
  const handlePublishChange = useCallback(
    (open: boolean) => {
      setPublishOpen(open);
      if (!open && session) {
        // Small delay to let the API propagate
        setTimeout(() => fetchPublishedPastes(), 500);
      }
    },
    [session, fetchPublishedPastes]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold mr-2">Markdown</span>

        {/* Formatting buttons */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Bold} title="Bold (⌘B)" onClick={() => insertAtCursor("**", "**", "bold")} />
          <ToolbarButton icon={Italic} title="Italic (⌘I)" onClick={() => insertAtCursor("*", "*", "italic")} />
          <ToolbarButton icon={Strikethrough} title="Strikethrough" onClick={() => insertAtCursor("~~", "~~", "text")} />
          <ToolbarButton icon={Code} title="Inline Code (⌘`)" onClick={() => insertAtCursor("`", "`", "code")} />
          <div className="w-px h-4 bg-border mx-1" />
          <ToolbarButton icon={Heading1} title="Heading 1" onClick={() => insertAtLineStart("# ")} />
          <ToolbarButton icon={Heading2} title="Heading 2" onClick={() => insertAtLineStart("## ")} />
          <ToolbarButton icon={Heading3} title="Heading 3" onClick={() => insertAtLineStart("### ")} />
          <div className="w-px h-4 bg-border mx-1" />
          <ToolbarButton icon={List} title="Bullet List" onClick={() => insertAtLineStart("- ")} />
          <ToolbarButton icon={ListOrdered} title="Numbered List" onClick={() => insertAtLineStart("1. ")} />
          <ToolbarButton icon={ListChecks} title="Task List" onClick={() => insertAtLineStart("- [ ] ")} />
          <div className="w-px h-4 bg-border mx-1" />
          <ToolbarButton icon={Quote} title="Blockquote" onClick={() => insertAtLineStart("> ")} />
          <ToolbarButton icon={Link} title="Link (⌘K)" onClick={() => insertAtCursor("[", "](url)", "link text")} />
          <ToolbarButton icon={Image} title="Image" onClick={() => insertAtCursor("![", "](url)", "alt text")} />
          <ToolbarButton
            icon={Table}
            title="Table"
            onClick={() =>
              insertBlock(
                "| Header | Header | Header |\n| ------ | ------ | ------ |\n| Cell   | Cell   | Cell   |"
              )
            }
          />
          <ToolbarButton
            icon={Minus}
            title="Horizontal Rule"
            onClick={() => insertBlock("---")}
          />
        </div>

        {lineCount > 1 && (
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {lineCount.toLocaleString()} lines
          </span>
        )}
        {session && (
          <div className="relative ml-2" ref={pagesRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTogglePages}
              className="h-7 px-2 text-xs gap-1.5"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              My Pages
            </Button>
            {pagesOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">Published Markdown Pages</span>
                </div>
                {loadingPastes ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </div>
                ) : publishedPastes.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No published markdown pages yet.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {publishedPastes.map((paste) => (
                      <div
                        key={paste.id}
                        className="group flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {paste.title || <span className="italic text-muted-foreground">Untitled</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(paste.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <a
                          href={`/p/${paste.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="View page"
                          onClick={() => setPagesOpen(false)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                          href={`/p/${paste.id}?edit=1`}
                          className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit page"
                          onClick={() => setPagesOpen(false)}
                        >
                          <Pencil className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {session && markdown && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPublishOpen(true)}
            className="h-7 px-2 text-xs gap-1.5"
          >
            <Globe className="h-3.5 w-3.5" />
            Publish
          </Button>
        )}
      </div>

      {/* Split panes */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Editor pane */}
        <div className="flex flex-col min-w-0" style={{ width: `${widths[0]}%` }}>
          <div className="flex items-center px-3 h-8 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Editor</span>
            <div className="flex items-center gap-0.5 ml-auto">
              {!markdown && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  className="h-6 px-1.5 text-xs"
                >
                  <ClipboardPaste className="h-3 w-3 mr-1" />
                  Paste
                </Button>
              )}
              {markdown && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 px-1.5 text-xs"
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    className="h-6 px-1.5 text-xs"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="h-6 px-1.5 text-xs"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            <div
              className="relative flex-1 min-w-0 overflow-auto hide-scrollbar"
              ref={scrollContainerRef}
            >
              <div className="relative min-h-full">
                {/* Grid mirror for line numbers */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "2.5rem 1fr" }}
                  aria-hidden
                >
                  {lines.map((line, i) => (
                    <Fragment key={i}>
                      <div className="text-right pr-2 text-xs leading-6 select-none border-r border-border/50 sticky left-0 bg-background z-10 text-muted-foreground/40">
                        {i + 1}
                      </div>
                      <div
                        className="pl-2 pr-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words text-transparent min-w-0"
                        style={{ tabSize: 2 }}
                      >
                        {line || "\u200b"}
                      </div>
                    </Fragment>
                  ))}
                </div>

                {/* Textarea overlay */}
                <textarea
                  ref={textareaRef}
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write markdown here..."
                  className="absolute inset-0 w-full h-full resize-none bg-transparent pl-12 pr-3 py-0 m-0 border-0 font-mono text-sm leading-6 outline-none overflow-hidden placeholder:text-muted-foreground caret-foreground whitespace-pre-wrap break-words"
                  spellCheck={false}
                  style={{ tabSize: 2 }}
                />
              </div>
            </div>
            <EditorScrollbar
              scrollContainerRef={scrollContainerRef}
              totalLines={lineCount}
            />
          </div>
        </div>

        {/* Resize handle */}
        <ResizeHandle index={0} onResize={handleResize} />

        {/* Right: Preview pane */}
        <div className="flex flex-col min-w-0" style={{ width: `${widths[1]}%` }}>
          <div className="flex items-center px-3 h-8 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">
              Preview
            </span>
          </div>
          <div className="flex flex-1 min-h-0">
            <div
              className="flex-1 min-w-0 overflow-auto hide-scrollbar p-6"
              ref={previewRef}
            >
              {markdown ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Write markdown on the left to see a live preview.
                </div>
              )}
            </div>
            <EditorScrollbar scrollContainerRef={previewRef} />
          </div>
        </div>
      </div>
      <PublishDialog
        open={publishOpen}
        onOpenChange={handlePublishChange}
        content={markdown}
        format="markdown"
        defaultTitle=""
      />
    </div>
  );
}

// ── Toolbar Button ────────────────────────────────────────────────────────────

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className="h-7 w-7 p-0"
      title={title}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

// ── Resize Handle ─────────────────────────────────────────────────────────────

function ResizeHandle({
  index,
  onResize,
}: {
  index: number;
  onResize: (index: number, delta: number, containerWidth: number) => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      let lastX = e.clientX;
      const container = handleRef.current?.parentElement;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - lastX;
        lastX = e.clientX;
        onResize(index, delta, containerWidth);
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [index, onResize]
  );

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-ring transition-colors"
    />
  );
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────
// Lightweight markdown-to-HTML renderer supporting common GFM features.
// Avoids a heavy dependency for the preview pane.

function renderMarkdown(md: string): string {
  if (!md) return "";

  let html = md;

  // Normalize line endings
  html = html.replace(/\r\n/g, "\n");

  // Fenced code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = escapeHtml(code.trimEnd());
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    return `<pre><code${langAttr}>${escaped}</code></pre>`;
  });

  // Split into blocks for block-level processing
  const blocks = html.split(/\n\n+/);
  const rendered = blocks.map((block) => renderBlock(block.trim())).join("\n");

  return rendered;
}

function renderBlock(block: string): string {
  if (!block) return "";

  // Already processed (code blocks)
  if (block.startsWith("<pre>")) return block;

  // Headings
  const headingMatch = block.match(/^(#{1,6})\s+(.+)$/m);
  if (headingMatch && block.split("\n").length === 1) {
    const level = headingMatch[1].length;
    return `<h${level}>${renderInline(headingMatch[2])}</h${level}>`;
  }

  // Horizontal rule
  if (/^(-{3,}|_{3,}|\*{3,})$/.test(block.trim())) {
    return "<hr />";
  }

  // Task list
  if (/^- \[[ x]\] /m.test(block)) {
    const items = block.split("\n").map((line) => {
      const taskMatch = line.match(/^- \[([ x])\] (.+)/);
      if (taskMatch) {
        const checked = taskMatch[1] === "x" ? " checked disabled" : " disabled";
        return `<li class="task-list-item"><input type="checkbox"${checked} /> ${renderInline(taskMatch[2])}</li>`;
      }
      return `<li>${renderInline(line.replace(/^- /, ""))}</li>`;
    });
    return `<ul class="task-list">${items.join("\n")}</ul>`;
  }

  // Unordered list
  if (/^[-*+] /m.test(block)) {
    const items = block
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => `<li>${renderInline(line.replace(/^[-*+]\s+/, ""))}</li>`);
    return `<ul>${items.join("\n")}</ul>`;
  }

  // Ordered list
  if (/^\d+\. /m.test(block)) {
    const items = block
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => `<li>${renderInline(line.replace(/^\d+\.\s+/, ""))}</li>`);
    return `<ol>${items.join("\n")}</ol>`;
  }

  // Blockquote
  if (/^> /m.test(block)) {
    const content = block
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .join("\n");
    return `<blockquote>${renderBlock(content)}</blockquote>`;
  }

  // Table
  if (block.includes("|") && /\|[\s-]+\|/.test(block)) {
    return renderTable(block);
  }

  // Paragraph
  const lines = block.split("\n");
  const content = lines.map((l) => renderInline(l)).join("<br />\n");
  return `<p>${content}</p>`;
}

function renderTable(block: string): string {
  const rows = block
    .split("\n")
    .filter((l) => l.trim())
    .map((row) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter((c, i, arr) => i > 0 || c !== "" ? (i < arr.length - 1 || c !== "") : false)
    );

  if (rows.length < 2) return `<p>${renderInline(block)}</p>`;

  // Check for separator row
  const sepIdx = rows.findIndex((row) =>
    row.every((cell) => /^[-:]+$/.test(cell.trim()))
  );
  if (sepIdx === -1) return `<p>${renderInline(block)}</p>`;

  const alignments = rows[sepIdx].map((cell) => {
    const c = cell.trim();
    if (c.startsWith(":") && c.endsWith(":")) return "center";
    if (c.endsWith(":")) return "right";
    return "left";
  });

  const headerRows = rows.slice(0, sepIdx);
  const bodyRows = rows.slice(sepIdx + 1);

  let html = "<table><thead>";
  for (const row of headerRows) {
    html += "<tr>";
    row.forEach((cell, i) => {
      const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : "";
      html += `<th${align}>${renderInline(cell)}</th>`;
    });
    html += "</tr>";
  }
  html += "</thead><tbody>";
  for (const row of bodyRows) {
    html += "<tr>";
    row.forEach((cell, i) => {
      const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : "";
      html += `<td${align}>${renderInline(cell)}</td>`;
    });
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

function renderInline(text: string): string {
  let result = escapeHtml(text);

  // Images (before links)
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" />'
  );

  // Links
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Inline code
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
