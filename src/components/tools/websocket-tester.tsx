"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Cable,
  Send,
  Plug,
  Unplug,
  Trash2,
  ArrowDown,
  ArrowUp,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  X,
  Circle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

type MessageType = "sent" | "received" | "system";
type MessageFormat = "text" | "json";
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface WsMessage {
  id: string;
  type: MessageType;
  data: string;
  timestamp: Date;
  size: number;
}

// ── Helpers ───────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function tryFormatJson(text: string): { formatted: string; valid: boolean } {
  try {
    const parsed = JSON.parse(text);
    return { formatted: JSON.stringify(parsed, null, 2), valid: true };
  } catch {
    return { formatted: text, valid: false };
  }
}

function isValidWsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "ws:" || u.protocol === "wss:";
  } catch {
    return false;
  }
}

// ── Component ─────────────────────────────────────────

export function WebSocketTester() {
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [url, setUrl] = useState("wss://echo.websocket.org");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<MessageFormat>("text");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  // Stats
  const sentCount = messages.filter((m) => m.type === "sent").length;
  const receivedCount = messages.filter((m) => m.type === "received").length;

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  const addMessage = useCallback(
    (type: MessageType, data: string) => {
      const msg: WsMessage = {
        id: crypto.randomUUID(),
        type,
        data,
        timestamp: new Date(),
        size: new TextEncoder().encode(data).length,
      };
      setMessages((prev) => [...prev, msg]);
    },
    []
  );

  const connect = useCallback(() => {
    if (!isValidWsUrl(url)) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("connecting");
    addMessage("system", `Connecting to ${url}...`);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        addMessage("system", "Connection established");
      };

      ws.onmessage = (event) => {
        const data =
          typeof event.data === "string" ? event.data : "[Binary data]";
        addMessage("received", data);
      };

      ws.onerror = () => {
        setStatus("error");
        addMessage(
          "system",
          "Connection error — check the URL and ensure the server allows cross-origin connections"
        );
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        addMessage(
          "system",
          `Connection closed${event.code ? ` (code: ${event.code})` : ""}${event.reason ? `: ${event.reason}` : ""}`
        );
        wsRef.current = null;
      };
    } catch {
      setStatus("error");
      addMessage("system", "Failed to create WebSocket connection");
    }
  }, [url, addMessage]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const text = input.trim();
    if (!text) return;

    wsRef.current.send(text);
    addMessage("sent", text);
    setInput("");
  }, [input, addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const statusColor: Record<ConnectionStatus, string> = {
    disconnected: "text-muted-foreground",
    connecting: "text-amber-500",
    connected: "text-green-500",
    error: "text-destructive",
  };

  const statusLabel: Record<ConnectionStatus, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
    error: "Error",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="flex items-center gap-2 px-6 py-2">
          <Cable className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">WebSocket</span>

          <div className={`flex items-center gap-1 text-xs ml-2 ${statusColor[status]}`}>
            <Circle
              className="h-2 w-2"
              fill="currentColor"
              strokeWidth={0}
            />
            {statusLabel[status]}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {messages.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mr-2">
                <span className="flex items-center gap-0.5">
                  <ArrowUp className="h-2.5 w-2.5" />
                  {sentCount}
                </span>
                <span className="flex items-center gap-0.5">
                  <ArrowDown className="h-2.5 w-2.5" />
                  {receivedCount}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowGuide((v) => !v)}
            >
              <Info className="h-3 w-3 mr-1" />
              {showGuide ? "Hide" : "Guide"}
            </Button>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={clearMessages}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Connection bar */}
        <div className="border-b px-6 py-3 shrink-0">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && status === "disconnected") connect();
                }}
                placeholder="wss://example.com/socket"
                className="font-mono text-sm"
                spellCheck={false}
                disabled={status === "connected" || status === "connecting"}
              />
            </div>
            {status === "connected" ? (
              <Button variant="destructive" size="sm" onClick={disconnect} className="gap-1.5">
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={connect}
                disabled={!isValidWsUrl(url) || status === "connecting"}
                className="gap-1.5"
              >
                <Plug className="h-3.5 w-3.5" />
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* Messages + guide wrapper */}
        <div className="flex-1 min-h-0 relative">
          {/* Guide panel overlay */}
          {showGuide && (
            <div className="absolute inset-0 z-10 bg-background overflow-auto px-6 py-4">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Connection Guide
                  </span>
                  <button
                    onClick={() => setShowGuide(false)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">
                      CORS & WebSocket connections
                    </p>
                    <p>
                      Browsers enforce security policies on WebSocket connections
                      made from web pages. If your server rejects connections, you
                      may need to configure it.
                    </p>
                    <p className="font-medium text-foreground mt-3">
                      Server-side headers
                    </p>
                    <p>
                      For the initial HTTP upgrade handshake, your server should
                      accept the <code className="bg-muted px-1 rounded text-[11px]">Origin</code> header
                      from this domain. Most WebSocket libraries let you configure
                      allowed origins.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Example configs</p>
                    <div className="bg-muted rounded-md p-2.5 font-mono text-[11px] space-y-1">
                      <p className="text-muted-foreground/60"># Node.js (ws)</p>
                      <p>{`const wss = new WebSocketServer({`}</p>
                      <p>{`  verifyClient: (info) => true`}</p>
                      <p>{`});`}</p>
                    </div>
                    <div className="bg-muted rounded-md p-2.5 font-mono text-[11px] space-y-1">
                      <p className="text-muted-foreground/60"># Python (websockets)</p>
                      <p>{`await serve(handler, origins=None)`}</p>
                    </div>
                    <div className="bg-muted rounded-md p-2.5 font-mono text-[11px] space-y-1">
                      <p className="text-muted-foreground/60"># Nginx proxy</p>
                      <p>{`proxy_set_header Upgrade $http_upgrade;`}</p>
                      <p>{`proxy_set_header Connection "upgrade";`}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages area */}
          <div className="h-full overflow-auto px-6 py-3">
          <div className="max-w-6xl mx-auto space-y-1.5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
                <Cable className="h-10 w-10 mb-3" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">
                  Connect to a WebSocket server to get started
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <MessageRow key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          </div>
        </div>

        {/* Compose area */}
        <div className="border-t px-6 py-3 shrink-0">
          <div className="max-w-6xl mx-auto space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value={format}
                onValueChange={(v) => v && setFormat(v as MessageFormat)}
              >
                <SelectTrigger size="sm" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>

              {format === "json" && input.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    const { formatted, valid } = tryFormatJson(input);
                    if (valid) setInput(formatted);
                  }}
                >
                  Format
                </Button>
              )}

              <div className="flex-1" />

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                Auto-scroll
              </label>
            </div>

            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  status === "connected"
                    ? format === "json"
                      ? '{"type": "hello", "data": "world"}'
                      : "Type a message..."
                    : "Connect to a server first..."
                }
                className="font-mono text-sm min-h-[80px] max-h-[160px] resize-y flex-1"
                disabled={status !== "connected"}
                spellCheck={false}
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  size="sm"
                  onClick={send}
                  disabled={status !== "connected" || !input.trim()}
                  className="gap-1.5 h-full"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/50">
              Press{" "}
              <kbd className="bg-muted px-1 py-0.5 rounded text-[9px]">
                Ctrl+Enter
              </kbd>{" "}
              to send
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Message Row ───────────────────────────────────────

function MessageRow({ message }: { message: WsMessage }) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  if (message.type === "system") {
    return (
      <div className="flex items-center gap-2 py-1 px-2">
        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums shrink-0">
          {formatTimestamp(message.timestamp)}
        </span>
        <span className="text-xs text-muted-foreground italic">
          {message.data}
        </span>
      </div>
    );
  }

  const isSent = message.type === "sent";
  const { formatted, valid: isJson } = tryFormatJson(message.data);
  const isLong = message.data.length > 200;
  const displayData = isJson ? formatted : message.data;

  return (
    <div
      className={`group rounded-lg border px-3 py-2 text-sm transition-colors ${
        isSent
          ? "border-blue-500/20 bg-blue-500/5"
          : "border-green-500/20 bg-green-500/5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {isSent ? (
          <ArrowUp className="h-3 w-3 text-blue-500 shrink-0" />
        ) : (
          <ArrowDown className="h-3 w-3 text-green-500 shrink-0" />
        )}
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 ${
            isSent
              ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
              : "border-green-500/30 text-green-600 dark:text-green-400"
          }`}
        >
          {isSent ? "SENT" : "RECV"}
        </Badge>
        {isJson && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 border-muted-foreground/20"
          >
            JSON
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
          {formatTimestamp(message.timestamp)}
        </span>
        <span className="text-[10px] text-muted-foreground/40">
          {formatSize(message.size)}
        </span>

        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(message.data);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <pre
        className={`font-mono text-xs whitespace-pre-wrap break-all pl-5 ${
          !expanded && isLong ? "max-h-12 overflow-hidden" : ""
        }`}
      >
        {displayData}
      </pre>
      {!expanded && isLong && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[10px] text-muted-foreground hover:text-foreground pl-5 mt-0.5"
        >
          Show more...
        </button>
      )}
    </div>
  );
}
