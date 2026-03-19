"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, ArrowRight, ArrowLeft, LogIn, Trash2, Loader2, Ban, PlayCircle } from "lucide-react";
import { SignInDialog } from "@/components/layout/sign-in-dialog";
import { cn } from "@/lib/utils";

interface SessionSummary {
  id: string;
  name: string;
  disabled: boolean;
  participantCount: number;
  storyCount: number;
  createdAt: string;
}

const SCALE_OPTIONS = [
  { label: "Fibonacci", value: "fibonacci", preview: "1 2 3 5 8 13 21" },
  { label: "Modified Fibonacci", value: "modified_fibonacci", preview: "0 1 2 3 5 8 13 20 40 100" },
  { label: "T-Shirt", value: "tshirt", preview: "XS S M L XL XXL" },
  { label: "Powers of 2", value: "powers_of_2", preview: "1 2 4 8 16 32 64" },
  { label: "Simple", value: "simple", preview: "1 2 3 4 5" },
];

export function PokerLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const mode: "home" | "create" | "join" = (searchParams.get("mode") as "create" | "join" | null) ?? "home";
  const [signInOpen, setSignInOpen] = useState(false);

  const setMode = (m: "home" | "create" | "join") => {
    if (m === "home") {
      router.push("/tools/poker");
    } else {
      router.push(`/tools/poker?mode=${m}`);
    }
  };

  // Create form
  const [sessionName, setSessionName] = useState("");
  const [scale, setScale] = useState("fibonacci");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join form
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // My sessions
  const [mySessions, setMySessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!isLoggedIn) return;
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/proxy/poker/sessions", { credentials: "include" });
      if (res.ok) {
        setMySessions((await res.json()) as SessionSummary[]);
      }
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const handleToggleSession = async (id: string, disabled: boolean) => {
    const endpoint = disabled ? "enable" : "disable";
    await fetch(`/api/proxy/poker/sessions/${id}/${endpoint}`, {
      method: "POST",
      credentials: "include",
    });
    void loadSessions();
  };

  const handleDeleteSession = async (id: string) => {
    await fetch(`/api/proxy/poker/sessions/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setMySessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCreate = async () => {
    if (!sessionName.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/proxy/poker/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sessionName.trim(),
          scaleType: scale,
          ownerName: session?.user?.name ?? "Owner",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to create session");
      }

      const data = (await res.json()) as { sessionId: string; ownerToken: string };
      // Store the owner token so the session page can claim ownership
      localStorage.setItem(`poker-owner-${data.sessionId}`, data.ownerToken);
      router.push(`/tools/poker/${data.sessionId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    if (code.length < 4) {
      setJoinError("Enter a valid session code");
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch(`/api/proxy/poker/check?session=${encodeURIComponent(code)}`);
      const data = (await res.json()) as { exists: boolean; disabled?: boolean; name?: string };

      if (!data.exists) {
        setJoinError("Session not found. Check the code and try again.");
        setJoining(false);
        return;
      }
      if (data.disabled) {
        setJoinError("This session has been disabled by the owner.");
        setJoining(false);
        return;
      }

      router.push(`/tools/poker/${code}`);
    } catch {
      setJoinError("Could not verify session. Please try again.");
      setJoining(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 h-12 border-b shrink-0">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Planning Poker</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          {mode === "home" && (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="flex gap-2">
                    {["1", "2", "3", "5", "8"].map((v, i) => (
                      <div
                        key={v}
                        className="w-10 h-14 rounded-md border-2 border-border bg-card flex items-center justify-center text-sm font-bold shadow-sm"
                        style={{ transform: `rotate(${(i - 2) * 3}deg)` }}
                      >
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
                <h1 className="text-2xl font-bold">Planning Poker</h1>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Estimate user stories with your team in real time. No account needed to join.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (isLoggedIn) {
                      setMode("create");
                    } else {
                      setSignInOpen(true);
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-muted/50 transition-all group"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    {isLoggedIn ? (
                      <Plus className="h-5 w-5 text-primary" />
                    ) : (
                      <LogIn className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Create Session</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isLoggedIn ? "Start a new game" : "Sign in to create"}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMode("join")}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-muted/50 transition-all group"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted transition-colors">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Join Session</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Enter a code</div>
                  </div>
                </button>
              </div>
              <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

              {/* My Sessions */}
              {isLoggedIn && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      My Sessions
                    </p>
                    {sessionsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />}
                  </div>
                  {mySessions.length === 0 && !sessionsLoading && (
                    <p className="text-xs text-muted-foreground/50 text-center py-3">
                      No active sessions
                    </p>
                  )}
                  {mySessions.length > 0 && (
                    <div className="rounded-lg border divide-y overflow-hidden">
                      {mySessions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 px-3 py-2.5 group"
                        >
                          <button
                            onClick={() => router.push(`/tools/poker/${s.id}`)}
                            className="flex-1 min-w-0 text-left"
                            disabled={s.disabled}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-sm font-medium truncate",
                                s.disabled && "text-muted-foreground line-through"
                              )}>
                                {s.name}
                              </span>
                              <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                                {s.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {s.participantCount} online
                              </span>
                              <span className="text-[10px] text-muted-foreground/40">·</span>
                              <span className="text-[10px] text-muted-foreground">
                                {s.storyCount} {s.storyCount === 1 ? "story" : "stories"}
                              </span>
                              {s.disabled && (
                                <>
                                  <span className="text-[10px] text-muted-foreground/40">·</span>
                                  <span className="text-[10px] text-amber-500">disabled</span>
                                </>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => void handleToggleSession(s.id, s.disabled)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                              title={s.disabled ? "Enable session" : "Disable session"}
                            >
                              {s.disabled ? (
                                <PlayCircle className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Ban className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </button>
                            <button
                              onClick={() => void handleDeleteSession(s.id)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                              title="Delete session"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "create" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode("home")}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <h2 className="text-lg font-semibold">Create Session</h2>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Session name</label>
                  <Input
                    autoFocus
                    placeholder="e.g. Sprint 24 Planning"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Estimation scale</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SCALE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setScale(opt.value)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors text-left",
                          scale === opt.value
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                        )}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="font-mono text-xs opacity-60">{opt.preview}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {createError && (
                  <p className="text-sm text-destructive">{createError}</p>
                )}

                <Button
                  className="w-full"
                  disabled={!sessionName.trim() || creating}
                  onClick={handleCreate}
                >
                  {creating ? "Creating..." : "Create Session"}
                </Button>
              </div>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode("home")}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <h2 className="text-lg font-semibold">Join Session</h2>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Session code</label>
                  <Input
                    autoFocus
                    placeholder="e.g. A3BK9F"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value);
                      setJoinError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoin();
                    }}
                    className="font-mono uppercase tracking-widest"
                  />
                  {joinError && (
                    <p className="text-xs text-destructive">{joinError}</p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  You will be asked for your name when you join.
                </p>

                <Button
                  className="w-full"
                  disabled={!joinCode.trim() || joining}
                  onClick={handleJoin}
                >
                  {joining ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-1.5" />
                      Join
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
