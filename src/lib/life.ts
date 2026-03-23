"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LifeProfile {
  userId: string;
  timezone: string;
  wakeTime: string | null;
  sleepTime: string | null;
  agentEnabled: boolean;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LifeMemory {
  id: string;
  userId: string;
  category: string; // 'preference' | 'instruction' | 'fact' | 'habit'
  content: string;
  source: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LifeConversation {
  id: string;
  userId: string;
  channel: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeMessage {
  id: string;
  conversationId: string;
  role: string; // 'user' | 'assistant' | 'system'
  content: string;
  toolCalls?: ChatEffect[]; // persisted tool effects — available after load and on new messages
  createdAt: string;
}

export interface ChatEffect {
  tool: string; // "create_actionable" | "remember" | "create_routine" | "forget" | etc.
  id: string;
  actionable?: LifeActionable;
  data?: Record<string, unknown>; // parsed tool result for memory/routine
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function lifeApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/proxy/life${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`${res.status}: ${text}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getLifeProfile(): Promise<LifeProfile> {
  const res = await lifeApiFetch<{ profile: LifeProfile }>("/profile");
  return res.profile;
}

export async function updateLifeProfile(
  data: Partial<LifeProfile>
): Promise<LifeProfile> {
  const res = await lifeApiFetch<{ profile: LifeProfile }>("/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.profile;
}

// ─── Memories ─────────────────────────────────────────────────────────────────

export async function listLifeMemories(): Promise<LifeMemory[]> {
  const res = await lifeApiFetch<{ memories: LifeMemory[] }>("/memories");
  return res.memories;
}

export async function createLifeMemory(
  content: string,
  category: string
): Promise<LifeMemory> {
  const res = await lifeApiFetch<{ memory: LifeMemory }>("/memories", {
    method: "POST",
    body: JSON.stringify({ content, category }),
  });
  return res.memory;
}

export async function updateLifeMemory(
  id: string,
  content: string,
  category: string
): Promise<LifeMemory> {
  const res = await lifeApiFetch<{ memory: LifeMemory }>(`/memories/${id}`, {
    method: "PUT",
    body: JSON.stringify({ content, category }),
  });
  return res.memory;
}

export async function deleteLifeMemory(id: string): Promise<void> {
  return lifeApiFetch<void>(`/memories/${id}`, { method: "DELETE" });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function listLifeConversations(): Promise<LifeConversation[]> {
  const res = await lifeApiFetch<{ conversations: LifeConversation[] }>("/conversations");
  return res.conversations;
}

export async function getLifeConversationMessages(id: string): Promise<LifeMessage[]> {
  const res = await lifeApiFetch<{ messages: LifeMessage[] }>(`/conversations/${id}`);
  return res.messages;
}

export async function getRoutineConversationId(routineId: string): Promise<string | null> {
  try {
    const res = await lifeApiFetch<{ conversationId: string | null }>(`/conversations/by-routine/${routineId}`);
    return res.conversationId;
  } catch {
    return null;
  }
}

export async function deleteLifeConversation(id: string): Promise<void> {
  return lifeApiFetch<void>(`/conversations/${id}`, { method: "DELETE" });
}

// ─── Actionables ──────────────────────────────────────────────────────────────

export interface LifeActionable {
  id: string;
  userId: string;
  type: string; // 'confirm' | 'choose' | 'input' | 'info'
  status: string; // 'pending' | 'confirmed' | 'dismissed' | 'snoozed' | 'expired'
  title: string;
  description: string;
  options: { id: string; label: string; detail?: string }[] | null;
  response: unknown;
  dueAt: string | null;
  snoozedUntil: string | null;
  routineId: string | null;
  actionType: string;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listLifeActionables(
  status?: string
): Promise<LifeActionable[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await lifeApiFetch<{ actionables: LifeActionable[] }>(
    `/actionables${qs}`
  );
  return res.actionables;
}

export async function respondToActionable(
  id: string,
  action: string,
  data?: unknown
): Promise<void> {
  return lifeApiFetch<void>(`/actionables/${id}/respond`, {
    method: "POST",
    body: JSON.stringify({ action, ...((data as object) ?? {}) }),
  });
}

// ─── Routines ─────────────────────────────────────────────────────────────────

export interface LifeRoutine {
  id: string;
  userId: string;
  name: string;
  type: string; // 'call_loved_ones' | 'gym' | 'reading' | 'custom'
  description: string;
  schedule: unknown; // {frequency, interval?, days?, time?, flexible?}
  config: unknown; // type-specific structured data
  active: boolean;
  lastTriggered: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listLifeRoutines(): Promise<LifeRoutine[]> {
  const res = await lifeApiFetch<{ routines: LifeRoutine[] }>("/routines");
  return res.routines;
}

export async function getLifeRoutine(id: string): Promise<LifeRoutine> {
  const res = await lifeApiFetch<{ routine: LifeRoutine }>(`/routines/${id}`);
  return res.routine;
}

export async function createLifeRoutine(
  routine: Partial<LifeRoutine>
): Promise<LifeRoutine> {
  const res = await lifeApiFetch<{ routine: LifeRoutine }>("/routines", {
    method: "POST",
    body: JSON.stringify(routine),
  });
  return res.routine;
}

export async function updateLifeRoutine(
  id: string,
  data: Partial<LifeRoutine>
): Promise<LifeRoutine> {
  const res = await lifeApiFetch<{ routine: LifeRoutine }>(`/routines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.routine;
}

export async function deleteLifeRoutine(id: string): Promise<void> {
  return lifeApiFetch<void>(`/routines/${id}`, { method: "DELETE" });
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export interface ChannelLink {
  id: string;
  userId: string;
  channel: string; // "telegram" | "email"
  channelUid: string;
  verified: boolean;
  displayName: string;
  createdAt: string;
}

export interface InitChannelLinkResponse {
  id: string;
  channel: string;
  verifyCode: string;
  displayName: string;
}

export async function listChannelLinks(): Promise<ChannelLink[]> {
  const res = await lifeApiFetch<{ links: ChannelLink[] }>("/channels");
  return res.links;
}

export async function initChannelLink(channel: string, channelUid?: string): Promise<InitChannelLinkResponse> {
  const res = await lifeApiFetch<InitChannelLinkResponse>("/channels", {
    method: "POST",
    body: JSON.stringify({ channel, channelUid }),
  });
  return res;
}

export async function verifyChannelLink(id: string, code: string): Promise<void> {
  await lifeApiFetch<void>(`/channels/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function deleteChannelLink(id: string): Promise<void> {
  await lifeApiFetch<void>(`/channels/${id}`, { method: "DELETE" });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

// ─── Chat streaming ───────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (toolName: string) => void;
  onToolResult: (result: string) => void;
  onComplete: (data: { conversationId: string; message: LifeMessage; effects?: ChatEffect[] }) => void;
  onError: (error: string) => void;
}

export async function streamLifeChat(
  message: string,
  callbacks: StreamCallbacks,
  conversationId?: string,
  systemContext?: string,
  routineId?: string,
  autoApprove?: boolean,
): Promise<void> {
  const res = await fetch("/api/proxy/life/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId, systemContext, routineId, autoApprove }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    callbacks.onError(err.error ?? `HTTP ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No stream");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const event = JSON.parse(jsonStr) as Record<string, unknown>;
          if (event.type === "token") {
            callbacks.onToken((event.data as string) ?? "");
          } else if (event.type === "tool_call") {
            callbacks.onToolCall((event.data as string) ?? "");
          } else if (event.type === "tool_result") {
            callbacks.onToolResult((event.data as string) ?? "");
          } else if (event.type === "done") {
            // done event data is the ChatResult JSON — ignored; wait for the
            // final save event below.
          } else if (event.type === "error") {
            callbacks.onError((event.data as string) ?? "unknown error");
            return;
          } else if (event.conversationId) {
            // Final save event: contains conversationId + message + effects.
            callbacks.onComplete(event as unknown as { conversationId: string; message: LifeMessage; effects?: ChatEffect[] });
          }
        } catch {
          // skip malformed events
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Google Calendar ──────────────────────────────────────────────────────────

export async function markOnboarded(): Promise<void> {
  await lifeApiFetch<void>("/profile/onboarded", { method: "POST" });
}

export interface GCalStatus {
  connected: boolean;
  email?: string;
  tokenExpiry?: string;
}

export interface GCalEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  status: string;
  colorId?: string;
  htmlLink: string;
}

export async function getGCalAuthUrl(): Promise<{ url: string }> {
  return lifeApiFetch<{ url: string }>("/gcal/auth-url");
}

export async function exchangeGCalCode(code: string): Promise<void> {
  await lifeApiFetch<void>("/gcal/callback", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getGCalStatus(): Promise<GCalStatus> {
  return lifeApiFetch<GCalStatus>("/gcal/status");
}

export async function disconnectGCal(): Promise<void> {
  await lifeApiFetch<void>("/gcal", { method: "DELETE" });
}

export async function listGCalEvents(from?: string, to?: string, days?: number): Promise<GCalEvent[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (!from && !to && days) params.set("days", String(days));
  const qs = params.toString();
  const res = await lifeApiFetch<{ events: GCalEvent[] }>(`/gcal/events${qs ? `?${qs}` : ""}`);
  return res.events;
}

export async function sendLifeChat(
  message: string,
  conversationId?: string,
  systemContext?: string,
  routineId?: string,
  autoApprove?: boolean,
): Promise<{ conversationId: string; message: LifeMessage; effects?: ChatEffect[] }> {
  return lifeApiFetch<{ conversationId: string; message: LifeMessage; effects?: ChatEffect[] }>(
    "/chat",
    {
      method: "POST",
      body: JSON.stringify({ message, conversationId, systemContext, routineId, autoApprove }),
    }
  );
}

// ─── Google Tasks ────────────────────────────────────────────────────────────

export interface GTaskList {
  id: string;
  title: string;
}

export interface GTask {
  id: string;
  title: string;
  notes: string;
  status: string; // "needsAction" | "completed"
  due: string;
  completed: string;
  position: string;
  parent: string;
  updated: string;
}

export async function listGTaskLists(): Promise<GTaskList[]> {
  const res = await lifeApiFetch<{ lists: GTaskList[] }>("/gtasks/lists");
  return res.lists;
}

export async function listGTasks(listId: string, showCompleted = false): Promise<GTask[]> {
  const params = new URLSearchParams({ listId });
  if (showCompleted) params.set("showCompleted", "true");
  const res = await lifeApiFetch<{ tasks: GTask[] }>(`/gtasks/tasks?${params}`);
  return res.tasks;
}

export async function createGTask(listId: string, title: string, notes?: string, due?: string): Promise<GTask> {
  return lifeApiFetch<GTask>("/gtasks/tasks", {
    method: "POST",
    body: JSON.stringify({ listId, title, notes, due }),
  });
}

export async function updateGTask(listId: string, taskId: string, updates: { title?: string; notes?: string; due?: string; status?: string }): Promise<GTask> {
  return lifeApiFetch<GTask>("/gtasks/tasks", {
    method: "PUT",
    body: JSON.stringify({ listId, taskId, ...updates }),
  });
}

export async function deleteGTask(listId: string, taskId: string): Promise<void> {
  await lifeApiFetch<void>(`/gtasks/tasks?listId=${encodeURIComponent(listId)}&taskId=${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
}

export async function completeGTask(listId: string, taskId: string): Promise<GTask> {
  return lifeApiFetch<GTask>("/gtasks/complete", {
    method: "POST",
    body: JSON.stringify({ listId, taskId }),
  });
}
