"use client";

import { useState, useEffect, use, useCallback } from "react";
import { Copy, Check, ExternalLink, Loader2, Globe, Lock, ArrowLeft, Pencil, Save, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";

type PasteFormat = "text" | "markdown" | "json" | "code";
type PasteVisibility = "public" | "unlisted";

interface Paste {
  id: string;
  userId?: string;
  title?: string;
  format: PasteFormat;
  content: string;
  visibility: PasteVisibility;
  createdAt?: string;
  author?: { name: string; image: string };
  size?: number;
}

const FORMAT_COLORS: Record<PasteFormat, string> = {
  text: "bg-muted text-muted-foreground",
  markdown: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  json: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  code: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PasteViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const wantsEdit = searchParams.get("edit") === "1";
  const { data: session } = useSession();
  const [paste, setPaste] = useState<Paste | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rawMode, setRawMode] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isOwner = !!(session?.user?.id && paste?.userId && session.user.id === paste.userId);

  useEffect(() => {
    async function fetchPaste() {
      try {
        const res = await fetch(`/api/proxy/pastes/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setPaste(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchPaste();
  }, [id]);

  // Auto-enter edit mode when ?edit=1 and user is the owner
  useEffect(() => {
    if (wantsEdit && paste && session?.user?.id && session.user.id === paste.userId) {
      setEditContent(paste.content);
      setEditTitle(paste.title || "");
      setEditing(true);
    }
  }, [wantsEdit, paste, session]);

  const copyContent = async () => {
    if (!paste) return;
    await navigator.clipboard.writeText(paste.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startEditing = useCallback(() => {
    if (!paste) return;
    setEditContent(paste.content);
    setEditTitle(paste.title || "");
    setSaveError(null);
    setEditing(true);
  }, [paste]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!paste) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/proxy/pastes/${paste.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      // Update paste in place
      setPaste((prev) =>
        prev
          ? {
              ...prev,
              title: editTitle.trim(),
              content: editContent,
              size: new TextEncoder().encode(editContent).length,
            }
          : prev
      );
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [paste, editTitle, editContent]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !paste) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Paste not found</p>
          <p className="text-sm text-muted-foreground">
            This paste may have been deleted or the link is incorrect.
          </p>
        </div>
        <Link
          href="/tools/paste"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Go to Paste Bin
        </Link>
      </div>
    );
  }

  if (rawMode) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-2">
          <button
            onClick={() => setRawMode(false)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to formatted view
          </button>
          <button
            onClick={copyContent}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="p-6 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
          {paste.content}
        </pre>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Back link */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/tools/paste"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Paste Bin
            </Link>
            <a
              href="/"
              className="text-xs font-semibold text-foreground hover:opacity-70 transition-opacity"
            >
              1two.dev
            </a>
          </div>

          {/* Title & meta */}
          <div className="space-y-2">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Untitled"
                className="w-full text-xl font-semibold bg-transparent border-b border-dashed border-muted-foreground/30 outline-none focus:border-foreground/50 pb-1 placeholder:text-muted-foreground/50 transition-colors"
              />
            ) : (
              <h1 className="text-xl font-semibold">
                {paste.title || <span className="text-muted-foreground">Untitled</span>}
              </h1>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {/* Format badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${
                  FORMAT_COLORS[paste.format]
                }`}
              >
                {paste.format}
              </span>

              {/* Visibility badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  paste.visibility === "public"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {paste.visibility === "public" ? (
                  <Globe className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                {paste.visibility === "public" ? "Public" : "Unlisted"}
              </span>

              {/* Author */}
              {paste.author?.name && (
                <span className="text-xs text-muted-foreground">
                  by{" "}
                  <span className="font-medium text-foreground">
                    {paste.author.name}
                  </span>
                </span>
              )}

              {/* Date */}
              {paste.createdAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(paste.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {paste.content.split("\n").length} lines
            {paste.size !== undefined && ` · ${paste.size} bytes`}
          </span>
          <div className="flex items-center gap-2">
            {isOwner && !editing && (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={cancelEditing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
            {!editing && (
              <>
                <button
                  onClick={() => setRawMode(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Raw
                </button>
                <button
                  onClick={copyContent}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="max-w-4xl mx-auto px-4 pt-3">
          <p className="text-xs text-destructive">{saveError}</p>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[60vh] rounded-xl border bg-muted/30 px-5 py-4 text-sm font-mono leading-relaxed resize-y outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            spellCheck={false}
          />
        ) : (
          <PasteContent paste={paste} />
        )}
      </div>
    </div>
  );
}

function PasteContent({ paste }: { paste: Paste }) {
  if (paste.format === "markdown") {
    return <MarkdownContent content={paste.content} />;
  }

  return (
    <pre className="rounded-xl border bg-muted/30 px-5 py-4 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
      {paste.content}
    </pre>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering: headings, bold, italic, code, links, paragraphs
  const html = markdownToHtml(content);
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Very minimal markdown-to-HTML converter (no external deps). */
function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Fenced code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => `<pre class="rounded-lg bg-muted px-4 py-3 overflow-x-auto text-sm font-mono"><code>${code.trimEnd()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm font-mono">$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-border my-6" />')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground italic">$1</blockquote>')
    // Paragraphs — wrap lines that aren't already HTML tags
    .replace(/^(?!<[a-z]|\s*$)(.+)$/gm, "<p>$1</p>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul class="list-disc list-inside space-y-1 my-3">${match}</ul>`);

  return html;
}
