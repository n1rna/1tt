"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileUp, Trash2, Copy, Check, Loader2, ExternalLink, LogIn } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useListFiles } from "@/lib/api/generated/hooks/useListFiles";
import { useUploadFile } from "@/lib/api/generated/hooks/useUploadFile";
import { useDeleteFile } from "@/lib/api/generated/hooks/useDeleteFile";
import { useQueryClient } from "@tanstack/react-query";
import { listFilesQueryKey } from "@/lib/api/generated/hooks/useListFiles";
import { SignInDialog } from "@/components/layout/sign-in-dialog";

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function UploadTool() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const { data: filesData, isLoading: loadingFiles } = useListFiles({
    query: { enabled: !!session },
  });

  const uploadMutation = useUploadFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listFilesQueryKey() });
      },
    },
  });

  const deleteMutation = useDeleteFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listFilesQueryKey() });
      },
    },
  });

  const handleUpload = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        uploadMutation.mutate({ data: { file } });
      }
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  const copyUrl = useCallback(async (url: string, id: string) => {
    await navigator.clipboard.writeText(window.location.origin + url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const files = filesData?.files ?? [];
  const isDisabled = !session;

  return (
    <div className="space-y-6">
      {/* Auth banner */}
      {!session && (
        <button
          onClick={() => setSignInOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/50 hover:bg-accent/50 transition-colors text-left"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 shrink-0">
            <LogIn className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sign in to start uploading</p>
            <p className="text-xs text-muted-foreground">
              Create a free account to upload, manage, and share your files.
            </p>
          </div>
        </button>
      )}

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDisabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={isDisabled ? undefined : handleDrop}
        onClick={() => {
          if (isDisabled) {
            setSignInOpen(true);
          } else {
            fileInputRef.current?.click();
          }
        }}
        className={`flex flex-col items-center gap-3 px-6 py-12 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
          dragOver
            ? "border-foreground/40 bg-accent/50"
            : "border-input hover:border-foreground/30"
        }`}
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted">
          {uploadMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <FileUp className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            {uploadMutation.isPending
              ? "Uploading..."
              : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max 50 MB per file
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
          disabled={isDisabled}
        />
      </div>

      {/* File list */}
      {session && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Your files
          </h3>
          {loadingFiles ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No files uploaded yet.
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((file: { id?: string; name?: string; size?: number; mimeType?: string; createdAt?: string; url?: string }) => (
                <div
                  key={file.id}
                  className="group flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size ?? 0)}</span>
                      <span>·</span>
                      <span>{file.mimeType}</span>
                      {file.createdAt && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(file.createdAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.url && (
                      <>
                        <button
                          onClick={() => copyUrl(file.url!, file.id!)}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy URL"
                        >
                          {copied === file.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Open file"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                    <button
                      onClick={() =>
                        file.id && deleteMutation.mutate({ id: file.id })
                      }
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
