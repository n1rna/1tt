"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Copy,
  Database,
  Loader2,
  Terminal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { createTunnel, getTunnelStatus, type TunnelToken } from "@/lib/tunnel";
import { cn } from "@/lib/utils";

interface TunnelConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TunnelConnectDialog({
  open,
  onOpenChange,
}: TunnelConnectDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"generate" | "waiting" | "connected">("generate");
  const [tunnel, setTunnel] = useState<TunnelToken | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dialect, setDialect] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("generate");
      setTunnel(null);
      setError(null);
      setDialect(null);
      setVersion(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [open]);

  // Poll for CLI connection
  useEffect(() => {
    if (step !== "waiting" || !tunnel) return;

    const check = async () => {
      try {
        const status = await getTunnelStatus(tunnel.token);
        if (status.connected) {
          setStep("connected");
          if (status.dialect) setDialect(status.dialect);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // CLI not connected yet — keep polling
      }
    };

    pollRef.current = setInterval(check, 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [step, tunnel]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const t = await createTunnel();
      setTunnel(t);
      setStep("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { cliCommand, oneLiner } = (() => {
    if (!tunnel) return { cliCommand: "", oneLiner: "" };
    const wsUrl = tunnel.ws_url;
    // Extract the server base: strip the /{token} or /{token}/ws suffix
    const tokenIdx = wsUrl.indexOf(tunnel.token);
    const serverBase = tokenIdx > 0 ? wsUrl.slice(0, tokenIdx - 1) : wsUrl;
    const isDefault = serverBase === "wss://1tt.dev/ws/tunnel";
    const serverFlag = isDefault ? "" : ` --server ${serverBase}`;
    const tunnelArgs = `tunnel --token ${tunnel.token}${serverFlag} --uri <YOUR_CONNECTION_URI>`;
    return {
      cliCommand: `1tt ${tunnelArgs}`,
      oneLiner: `curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- ${tunnelArgs}`,
    };
  })();

  const handleOpenStudio = () => {
    if (!tunnel) return;
    onOpenChange(false);
    // Route to the correct studio based on dialect
    if (dialect === "redis") {
      router.push(`/account/redis/tunnel/${tunnel.token}`);
    } else if (dialect === "elasticsearch") {
      router.push(`/account/elasticsearch/tunnel/${tunnel.token}`);
    } else {
      router.push(`/account/postgres/tunnel/${tunnel.token}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            Connect External Database
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Generate */}
          {step === "generate" && (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your own PostgreSQL, Redis, or Elasticsearch instance to the 1tt.dev studio.
                Your data stays on your machine — we only relay queries through a secure tunnel.
              </p>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">How it works</p>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Click &quot;Generate Token&quot; to get a one-time connection token</li>
                  <li>Run the CLI command in your terminal (where your database is accessible)</li>
                  <li>The CLI creates a secure tunnel to 1tt.dev</li>
                  <li>Open the studio — all queries execute on your machine</li>
                </ol>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Generate Token
              </Button>
            </>
          )}

          {/* Step 2: Waiting for CLI */}
          {step === "waiting" && tunnel && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <div className="relative">
                  <WifiOff className="h-4 w-4 text-yellow-500" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                </div>
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  Waiting for CLI connection…
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">
                    If you have the CLI installed:
                  </p>
                  <div className="relative">
                    <pre className="text-xs font-mono bg-zinc-950 text-zinc-100 rounded-lg p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all">
                      {cliCommand}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-zinc-400 hover:text-zinc-100"
                      onClick={() => void handleCopy(cliCommand)}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">
                    Or install + run in one command:
                  </p>
                  <div className="relative">
                    <pre className="text-[11px] font-mono bg-zinc-950 text-zinc-100 rounded-lg p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all">
                      {oneLiner}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-zinc-400 hover:text-zinc-100"
                      onClick={() => void handleCopy(oneLiner)}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground/60">
                  Replace <code className="font-mono bg-muted px-1 rounded">{"<YOUR_CONNECTION_URI>"}</code> with your connection URI, e.g.{" "}
                  <code className="font-mono bg-muted px-1 rounded">postgres://user:pass@localhost:5432/mydb</code>,{" "}
                  <code className="font-mono bg-muted px-1 rounded">redis://localhost:6379</code>, or{" "}
                  <code className="font-mono bg-muted px-1 rounded">http://localhost:9200</code>
                </p>
              </div>

              <div className="rounded-lg border border-dashed p-3 flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Polling for connection…</p>
                  <p className="text-[11px] text-muted-foreground">
                    This dialog will update automatically when the CLI connects.
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground/50">
                Don&apos;t have the CLI? Install it with: <code className="font-mono bg-muted px-1 rounded">curl -sSfL https://1tt.dev/cli/install.sh | sh</code>
              </p>
            </>
          )}

          {/* Step 3: Connected */}
          {step === "connected" && tunnel && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <div className="relative">
                  <Wifi className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Tunnel connected!
                </span>
              </div>

              <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-4 space-y-2">
                {dialect && (
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      {dialect === "postgres" ? "PostgreSQL" : dialect === "elasticsearch" ? "Elasticsearch" : "Redis"}
                      {version && <span className="text-muted-foreground ml-1">{version}</span>}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Your database is connected and ready. Click below to open the studio.
                </p>
              </div>

              <Button className="w-full gap-2" onClick={handleOpenStudio}>
                <Database className="h-4 w-4" />
                Open Studio
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
