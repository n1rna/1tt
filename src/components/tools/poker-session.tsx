"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users,
  Crown,
  Check,
  Timer,
  Play,
  Eye,
  Plus,
  X,
  Copy,
  RotateCcw,
  Circle,
  StopCircle,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { PromoBanner } from "@/components/layout/promo-banner";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StoryResult {
  average?: number;
  median?: string;
  mode?: string;
  distribution: Record<string, number>;
  totalVotes: number;
}

interface Story {
  id: string;
  title: string;
  description?: string;
  votes?: Record<string, string>;
  revealed: boolean;
  result?: StoryResult;
}

interface Participant {
  id: string;
  name: string;
  isOwner: boolean;
  isConnected: boolean;
  hasVoted: boolean;
  vote?: string;
}

interface SessionState {
  id: string;
  name: string;
  ownerId: string;
  scale: { type: string; values: string[] };
  participants: Participant[];
  stories: Story[];
  activeStoryIdx: number;
  votingOpen: boolean;
  timerRunning: boolean;
  timerDuration: number;
  timerRemaining: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error" | "reconnecting";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWsUrl(sessionId: string, name: string, reconnectId: string): string {
  const params = new URLSearchParams({ session: sessionId, name, reconnectId });

  // Include owner token if we have one (proves ownership)
  const ownerToken = localStorage.getItem(`poker-owner-${sessionId}`);
  if (ownerToken) {
    params.set("ownerToken", ownerToken);
  }

  // In dev, connect directly to the Go backend
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    const base = apiUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:").replace(/\/$/, "");
    return `${base}/api/v1/poker/ws?${params.toString()}`;
  }

  // In production, proxy through the same domain via /ws/poker
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/poker?${params.toString()}`;
}

function getReconnectId(sessionId: string): string {
  const key = `poker-reconnect-${sessionId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    connected: "text-green-500",
    connecting: "text-amber-400",
    reconnecting: "text-amber-400",
    disconnected: "text-muted-foreground",
    error: "text-destructive",
  };
  const labels: Record<ConnectionStatus, string> = {
    connected: "Connected",
    connecting: "Connecting",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    error: "Error",
  };
  return (
    <div className={`flex items-center gap-1.5 text-xs ${colors[status]}`}>
      <Circle className="h-2 w-2" fill="currentColor" strokeWidth={0} />
      <span className="hidden sm:inline">{labels[status]}</span>
    </div>
  );
}

function VotingCard({
  value,
  selected,
  disabled,
  onClick,
}: {
  value: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.04 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      animate={selected ? { y: -6 } : { y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative w-[72px] h-[100px] rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-colors select-none cursor-pointer",
        selected
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 text-primary"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {value}
    </motion.button>
  );
}

function TimerCircle({
  remaining,
  duration,
}: {
  remaining: number;
  duration: number;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const ratio = duration > 0 ? remaining / duration : 0;
  const offset = circumference * (1 - ratio);
  const color =
    ratio > 0.5 ? "#22c55e" : ratio > 0.2 ? "#eab308" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/30"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className="absolute text-sm font-mono font-bold tabular-nums"
        style={{ color }}
      >
        {formatTime(remaining)}
      </span>
    </div>
  );
}

function VoteDistribution({
  result,
  scaleValues,
}: {
  result: StoryResult;
  scaleValues: string[];
}) {
  const maxCount = Math.max(...Object.values(result.distribution), 1);
  const allValues = [...scaleValues, "?"];

  return (
    <div className="space-y-2">
      {allValues.map((v) => {
        const count = result.distribution[v] ?? 0;
        if (count === 0) return null;
        const pct = (count / maxCount) * 100;
        return (
          <div key={v} className="flex items-center gap-2 text-sm">
            <span className="w-8 text-right font-mono font-semibold text-foreground">
              {v}
            </span>
            <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full bg-primary/70 rounded-sm"
              />
            </div>
            <span className="w-8 text-xs text-muted-foreground tabular-nums">
              {count}x
            </span>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
        {result.average !== undefined && (
          <span>
            Avg <span className="font-semibold text-foreground">{result.average.toFixed(1)}</span>
          </span>
        )}
        {result.median && (
          <span>
            Median <span className="font-semibold text-foreground">{result.median}</span>
          </span>
        )}
        {result.mode && (
          <span>
            Mode <span className="font-semibold text-foreground">{result.mode}</span>
          </span>
        )}
        <span>
          Total <span className="font-semibold text-foreground">{result.totalVotes}</span>
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface PokerSessionProps {
  sessionId: string;
  initialName?: string;
}

export function PokerSession({ sessionId, initialName }: PokerSessionProps) {
  const router = useRouter();

  // Session validation
  const [sessionCheck, setSessionCheck] = useState<"loading" | "valid" | "not_found" | "disabled">("loading");
  const [sessionName, setSessionName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(`/api/proxy/poker/check?session=${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as { exists: boolean; disabled?: boolean; name?: string };
        if (cancelled) return;
        if (!data.exists) {
          setSessionCheck("not_found");
        } else if (data.disabled) {
          setSessionCheck("disabled");
        } else {
          setSessionCheck("valid");
          setSessionName(data.name ?? null);
        }
      } catch {
        if (!cancelled) setSessionCheck("not_found");
      }
    }
    void check();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Join flow
  const [joinName, setJoinName] = useState("");
  const [participantName, setParticipantName] = useState<string | null>(
    initialName ?? null
  );

  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [session, setSession] = useState<SessionState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [kicked, setKicked] = useState(false);

  // UI state
  const [myVote, setMyVote] = useState<string | null>(null);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDesc, setNewStoryDesc] = useState("");
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"stories" | "main" | "participants">("main");
  const [selectedTimerDuration, setSelectedTimerDuration] = useState(120);

  // Local selected story (for browsing without starting voting)
  const [viewingStoryIdx, setViewingStoryIdx] = useState<number | null>(null);

  // Derived
  const me = session?.participants.find((p) => {
    const rid = typeof window !== "undefined"
      ? localStorage.getItem(`poker-reconnect-${sessionId}`)
      : null;
    return rid ? p.id === rid : p.name === participantName;
  }) ?? session?.participants.find((p) => p.name === participantName);

  const isOwner = me?.isOwner ?? false;
  const activeStoryIdx = session?.activeStoryIdx ?? -1;
  const activeStory = session && activeStoryIdx >= 0
    ? session.stories[activeStoryIdx]
    : null;

  // The story being viewed (either the locally selected one or the server active one)
  const viewIdx = viewingStoryIdx ?? activeStoryIdx;
  const viewingStory = session && viewIdx >= 0 && viewIdx < session.stories.length
    ? session.stories[viewIdx]
    : null;
  const isViewingActiveStory = viewIdx === activeStoryIdx;

  // Sync viewingStoryIdx when server changes active story
  useEffect(() => {
    if (session) setViewingStoryIdx(null);
  }, [activeStoryIdx]);

  // ── WebSocket connection ───────────────────────────────────────────────────

  const connect = useCallback((name: string) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const reconnectId = getReconnectId(sessionId);
    const url = buildWsUrl(sessionId, name, reconnectId);

    setStatus("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        reconnectAttempts.current = 0;
        setErrorMsg(null);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "state") {
            setSession(msg.session as SessionState);
            setTimerRemaining(msg.session.timerRemaining ?? 0);
          } else if (msg.type === "timer_tick") {
            setTimerRemaining(msg.tick as number);
          } else if (msg.type === "kicked") {
            setKicked(true);
            setSession(null);
            // Prevent auto-reconnect
            if (wsRef.current) {
              wsRef.current.onclose = null;
              wsRef.current.close();
              wsRef.current = null;
            }
          } else if (msg.type === "error") {
            setErrorMsg(msg.message as string);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };

      ws.onclose = () => {
        wsRef.current = null;
        setStatus("reconnecting");

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 15000);
        reconnectAttempts.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          connect(name);
        }, delay);
      };
    } catch {
      setStatus("error");
    }
  }, [sessionId]);

  const send = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Start connection when name is available
  useEffect(() => {
    if (!participantName) return;
    connect(participantName);

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [participantName, connect]);

  // Reset my vote when a new round starts
  useEffect(() => {
    if (session?.votingOpen && !activeStory?.revealed) {
      // Check if my vote matches what's on the server
      if (me && !me.hasVoted) setMyVote(null);
    }
    if (activeStory?.revealed) {
      setMyVote(me?.vote ?? null);
    }
  }, [session?.votingOpen, activeStory?.revealed, me]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const castVote = useCallback((value: string) => {
    if (!session?.votingOpen || activeStory?.revealed) return;
    const next = myVote === value ? null : value;
    setMyVote(next);
    send({ type: "vote", value: next ?? "" });
  }, [session?.votingOpen, activeStory?.revealed, myVote, send]);

  const addStory = useCallback(() => {
    if (!newStoryTitle.trim()) return;
    send({ type: "create_story", title: newStoryTitle.trim(), description: newStoryDesc.trim() });
    setNewStoryTitle("");
    setNewStoryDesc("");
    setShowStoryForm(false);
  }, [newStoryTitle, newStoryDesc, send]);

  const handleStoryKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      addStory();
    }
  }, [addStory]);

  const copyShareUrl = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // ── Session validation screens ────────────────────────────────────────────

  const { data: authSession } = useSession();
  const loggedInName = authSession?.user?.name ?? "";

  if (sessionCheck === "loading") {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-3 px-6 h-12 border-b shrink-0">
          <Link href="/tools/poker" className="text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">Planning Poker</span>
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border text-muted-foreground">
            {sessionId.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-5">
            <div className="space-y-2 flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="h-6 w-48 rounded bg-muted animate-pulse" />
              <div className="h-4 w-64 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sessionCheck === "not_found") {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-3 px-6 h-12 border-b shrink-0">
          <Link href="/tools/poker" className="text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">Planning Poker</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center space-y-4">
            <X className="h-8 w-8 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Session Not Found</h1>
            <p className="text-sm text-muted-foreground">
              The session <span className="font-mono font-semibold text-foreground">{sessionId.toUpperCase()}</span> does not exist or has expired.
            </p>
            <Link
              href="/tools/poker?mode=join"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Try Another Code
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (sessionCheck === "disabled") {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-3 px-6 h-12 border-b shrink-0">
          <Link href="/tools/poker" className="text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">Planning Poker</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center space-y-4">
            <X className="h-8 w-8 mx-auto text-amber-500" />
            <h1 className="text-xl font-semibold">Session Disabled</h1>
            <p className="text-sm text-muted-foreground">
              This session has been disabled by the owner and is no longer accepting participants.
            </p>
            <Link
              href="/tools/poker"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Back to Planning Poker
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Join screen ───────────────────────────────────────────────────────────

  if (!participantName) {
    return (
      <div className="h-full flex flex-col bg-background">
        <PromoBanner currentSlug="poker" />
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 h-12 border-b shrink-0">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Planning Poker</span>
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border text-muted-foreground">
            {sessionId.toUpperCase()}
          </span>
        </div>

        {/* Join form */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-semibold">Join Session</h1>
              {sessionName && (
                <p className="text-sm font-medium text-foreground">{sessionName}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Enter your name to join this planning session.
              </p>
            </div>

            {/* Quick join for logged-in users */}
            {loggedInName && (
              <Button
                className="w-full"
                onClick={() => setParticipantName(loggedInName)}
              >
                Join as {loggedInName}
              </Button>
            )}

            {loggedInName && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <span>or use a different name</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            <div className="space-y-2">
              <Input
                autoFocus={!loggedInName}
                placeholder="Your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && joinName.trim()) {
                    setParticipantName(joinName.trim());
                  }
                }}
              />
              <Button
                className="w-full"
                variant={loggedInName ? "outline" : "default"}
                disabled={!joinName.trim()}
                onClick={() => setParticipantName(joinName.trim())}
              >
                Join Session
              </Button>
            </div>
            <div className="text-center pt-2">
              <Link
                href="/tools/poker"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to Planning Poker
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Kicked ──────────────────────────────────────────────────────────────

  if (kicked) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-3 px-6 h-12 border-b shrink-0">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Planning Poker</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center space-y-4">
            <X className="h-8 w-8 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Removed from Session</h1>
            <p className="text-sm text-muted-foreground">
              The session owner has removed you from this planning session.
            </p>
            <Link
              href="/tools/poker"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Back to Planning Poker
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Session not found / error ─────────────────────────────────────────────

  if (errorMsg && !session) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <X className="h-8 w-8 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Session Error</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Link
            href="/tools/poker"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Back to Planning Poker
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Connecting to session...</p>
        </div>
      </div>
    );
  }

  const scaleValues = session.scale.values;

  // ── Session layout ────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">

      {/* Session bar */}
      <div className="flex items-center gap-3 px-4 h-12 border-b shrink-0">
        <Link
          href="/tools/poker"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Back to Planning Poker"
        >
          <Users className="h-4 w-4" />
        </Link>
        <span className="font-semibold text-sm truncate">{session.name}</span>

        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border text-muted-foreground shrink-0">
          {session.id.toUpperCase()}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:inline capitalize">
            {session.scale.type}
          </span>

          <button
            onClick={copyShareUrl}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>

          <ConnectionDot status={status} />
        </div>
      </div>

      {/* Mobile panel tabs */}
      <div className="flex md:hidden border-b shrink-0 text-xs">
        {(["stories", "main", "participants"] as const).map((panel) => (
          <button
            key={panel}
            onClick={() => setMobilePanel(panel)}
            className={cn(
              "flex-1 py-2 capitalize font-medium transition-colors",
              mobilePanel === panel
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            )}
          >
            {panel === "stories" ? "Stories" : panel === "participants" ? "People" : "Vote"}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-xs text-destructive flex items-center justify-between shrink-0">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main 3-column layout */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT — Stories panel */}
        <div
          className={cn(
            "w-[240px] border-r flex flex-col shrink-0 overflow-hidden",
            "hidden md:flex",
            mobilePanel === "stories" && "!flex flex-col w-full md:w-[240px]"
          )}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Stories
            </span>
            {isOwner && (
              <button
                onClick={() => setShowStoryForm((v) => !v)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* New story dialog */}
          <Dialog open={showStoryForm && isOwner} onOpenChange={(open) => { setShowStoryForm(open); if (!open) { setNewStoryTitle(""); setNewStoryDesc(""); } }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Story</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2" onKeyDown={handleStoryKeyDown}>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    autoFocus
                    placeholder="e.g. As a user, I want to..."
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Acceptance criteria, technical notes, links..."
                    value={newStoryDesc}
                    onChange={(e) => setNewStoryDesc(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50 resize-y"
                  />
                </div>
              </div>
              <DialogFooter>
                <p className="text-[10px] text-muted-foreground/50 mr-auto hidden sm:block">
                  Cmd+Enter to add
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowStoryForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={addStory} disabled={!newStoryTitle.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Story
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Story list */}
          <div className="flex-1 overflow-y-auto">
            {session.stories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                <p className="text-xs text-muted-foreground">
                  {isOwner ? "Add the first story to get started" : "Waiting for stories..."}
                </p>
                {isOwner && !showStoryForm && (
                  <button
                    onClick={() => setShowStoryForm(true)}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Add story
                  </button>
                )}
              </div>
            ) : (
              <div className="py-1">
                {session.stories.map((story, idx) => {
                  const isActive = idx === activeStoryIdx;
                  const isViewing = idx === viewIdx;
                  return (
                    <button
                      key={story.id}
                      onClick={() => setViewingStoryIdx(idx)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors border-l-2",
                        isViewing
                          ? "border-primary bg-primary/5 text-foreground"
                          : isActive
                          ? "border-primary/50 text-foreground"
                          : "border-transparent text-muted-foreground"
                      )}
                    >
                      <div className="font-medium truncate">{story.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {story.revealed ? (
                          <>
                            <Check className="h-3 w-3 text-green-500 shrink-0" />
                            <span className="text-green-600 dark:text-green-400">
                              {story.result?.mode ?? story.result?.median ?? "revealed"}
                            </span>
                          </>
                        ) : isActive ? (
                          <>
                            <Circle className="h-2 w-2 text-amber-400 shrink-0" fill="currentColor" strokeWidth={0} />
                            <span className="text-amber-500">
                              {session.votingOpen ? "voting" : "pending"}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground/50">pending</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CENTER — Voting area */}
        <div
          className={cn(
            "flex-1 flex flex-col overflow-hidden",
            "hidden md:flex",
            mobilePanel === "main" && "!flex"
          )}
        >
          {/* Story view */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {!viewingStory ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 space-y-3">
                <Users className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-lg font-medium text-muted-foreground">
                  {isOwner ? "Add a story and start voting" : "Waiting for the host to start..."}
                </p>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowStoryForm(true);
                      setMobilePanel("stories");
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Story
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-4 md:p-6 gap-4">
                {/* Story header */}
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold leading-tight">{viewingStory.title}</h2>
                  {viewingStory.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingStory.description}</p>
                  )}
                  {!isViewingActiveStory && isOwner && !viewingStory.revealed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        send({ type: "select_story", storyIdx: viewIdx });
                        setViewingStoryIdx(null);
                      }}
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Make Active
                    </Button>
                  )}
                </div>

                {/* Timer — only on active story */}
                {isViewingActiveStory && (session.timerRunning || timerRemaining > 0) && (
                  <div className="flex items-center gap-3">
                    <TimerCircle
                      remaining={timerRemaining}
                      duration={session.timerDuration}
                    />
                    {isOwner && session.timerRunning && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => send({ type: "stop_timer" })}
                      >
                        <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                        Stop Timer
                      </Button>
                    )}
                  </div>
                )}

                {/* Revealed state */}
                {viewingStory.revealed ? (
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Results
                    </div>
                    {viewingStory.result && (
                      <VoteDistribution
                        result={viewingStory.result}
                        scaleValues={scaleValues}
                      />
                    )}

                    {/* Individual votes */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {session.participants.map((p) => {
                        const vote = viewingStory.votes?.[p.id];
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs"
                          >
                            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary uppercase shrink-0">
                              {p.name.charAt(0)}
                            </div>
                            <span className="text-muted-foreground">{p.name}</span>
                            <span className="font-mono font-bold text-foreground">
                              {vote ?? "-"}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {isOwner && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => send({ type: "next_story" })}
                          disabled={session.activeStoryIdx >= session.stories.length - 1}
                        >
                          <ArrowRight className="h-4 w-4 mr-1.5" />
                          Next Story
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => send({ type: "reset_votes" })}
                        >
                          <RotateCcw className="h-4 w-4 mr-1.5" />
                          Re-vote
                        </Button>
                      </div>
                    )}
                  </div>
                ) : isViewingActiveStory && session.votingOpen ? (
                  <div className="space-y-4">
                    {/* Card grid — shown to everyone */}
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Select your estimate
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {scaleValues.map((v) => (
                          <VotingCard
                            key={v}
                            value={v}
                            selected={myVote === v}
                            disabled={false}
                            onClick={() => castVote(v)}
                          />
                        ))}
                      </div>
                      {myVote && (
                        <p className="text-xs text-muted-foreground">
                          Your vote:{" "}
                          <span className="font-semibold text-foreground">{myVote}</span>
                          {" — "}
                          <button
                            onClick={() => castVote(myVote)}
                            className="text-primary hover:underline"
                          >
                            clear
                          </button>
                        </p>
                      )}
                    </div>

                    {/* Owner controls: voting progress + reveal */}
                    {isOwner && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {session.participants.filter((p) => p.hasVoted).length} of{" "}
                            {session.participants.filter((p) => p.isConnected).length} voted
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {session.participants.map((p) => (
                              <div
                                key={p.id}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border",
                                  p.hasVoted
                                    ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400"
                                    : "border-border text-muted-foreground"
                                )}
                              >
                                {p.hasVoted ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Circle className="h-2 w-2" fill="currentColor" strokeWidth={0} />
                                )}
                                {p.name}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Timer controls */}
                        {!session.timerRunning && (
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-muted-foreground" />
                            <div className="flex gap-1">
                              {[60, 120, 180, 300].map((d) => (
                                <button
                                  key={d}
                                  onClick={() => setSelectedTimerDuration(d)}
                                  className={cn(
                                    "text-xs px-2 py-1 rounded border transition-colors",
                                    selectedTimerDuration === d
                                      ? "border-primary text-primary bg-primary/5"
                                      : "border-border text-muted-foreground hover:border-primary/50"
                                  )}
                                >
                                  {d / 60}m
                                </button>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                send({ type: "start_timer", duration: selectedTimerDuration })
                              }
                            >
                              <Play className="h-3.5 w-3.5 mr-1.5" />
                              Start Timer
                            </Button>
                          </div>
                        )}

                        <Button
                          size="lg"
                          onClick={() => send({ type: "reveal" })}
                          className="gap-2"
                        >
                          <Eye className="h-5 w-5" />
                          Reveal Votes
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Voting not open yet */
                  <div className="space-y-3">
                    {isViewingActiveStory ? (
                      <>
                        <p className="text-sm text-muted-foreground">Voting has not started yet.</p>
                        {isOwner && (
                          <Button onClick={() => send({ type: "start_voting" })}>
                            <Play className="h-4 w-4 mr-1.5" />
                            Start Voting
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {viewingStory.revealed ? "" : "This story has not been voted on yet."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Participants */}
        <div
          className={cn(
            "w-[200px] border-l flex flex-col shrink-0 overflow-hidden",
            "hidden md:flex",
            mobilePanel === "participants" && "!flex flex-col w-full md:w-[200px]"
          )}
        >
          <div className="px-3 py-2 border-b shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Participants ({session.participants.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {session.participants.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <div className="relative shrink-0">
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase">
                    {p.name.charAt(0)}
                  </div>
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                      p.isConnected ? "bg-green-500" : "bg-muted-foreground"
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate">{p.name}</span>
                    {p.isOwner && (
                      <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                    )}
                    {p.id === me?.id && (
                      <span className="text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {viewingStory?.revealed && p.vote ? (
                      <span className="font-mono font-bold text-foreground">{p.vote}</span>
                    ) : session.votingOpen ? (
                      p.hasVoted ? (
                        <span className="text-green-500 flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" />
                          voted
                        </span>
                      ) : (
                        <span>waiting...</span>
                      )
                    ) : (
                      <span>{p.isConnected ? "online" : "offline"}</span>
                    )}
                  </div>
                </div>

                {isOwner && !p.isOwner && p.id !== me?.id && (
                  <button
                    onClick={() => send({ type: "remove_voter", voterId: p.id })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
