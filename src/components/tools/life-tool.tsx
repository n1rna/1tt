"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Brain,
  MessageSquare,
  Lightbulb,
  CalendarDays,
  Radio,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Send,
  Loader2,
  CheckSquare,
  Repeat,
  Sun,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  RefreshCw,
  Check,
  Clock,
  AlertCircle,
  Info,
  Copy,
  GripVertical,
  Sparkles,
  Dumbbell,
  BookOpen,
  Phone,
  Target,
  Mail,
  MessageCircle,
  ExternalLink,
  MapPin,
  ListTodo,
  Square,
  CheckSquare2,
  Pin,
  PinOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { AuthGate } from "@/components/layout/auth-gate";
import { useSyncedState } from "@/lib/sync";
import { usePathname, useRouter } from "next/navigation";
import {
  listLifeMemories,
  createLifeMemory,
  updateLifeMemory,
  deleteLifeMemory,
  listLifeConversations,
  getLifeConversationMessages,
  getRoutineConversationId,
  sendLifeChat,
  streamLifeChat,
  deleteLifeConversation,
  listLifeActionables,
  respondToActionable,
  listLifeRoutines,
  createLifeRoutine,
  updateLifeRoutine,
  deleteLifeRoutine,
  listChannelLinks,
  initChannelLink,
  verifyChannelLink,
  deleteChannelLink,
  type LifeMemory,
  type LifeMessage,
  type LifeConversation,
  type LifeActionable,
  type LifeRoutine,
  type ChatEffect,
  type ChannelLink,
  type InitChannelLinkResponse,
  getLifeRoutine,
  getGCalAuthUrl,
  exchangeGCalCode,
  getGCalStatus,
  disconnectGCal,
  listGCalEvents,
  type GCalStatus,
  type GCalEvent,
  listGTaskLists,
  listGTasks,
  createGTask,
  updateGTask,
  deleteGTask,
  completeGTask,
  type GTaskList,
  type GTask,
  markOnboarded,
  createGTaskList,
} from "@/lib/life";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type LifeTabType =
  | "today"
  | "actionables"
  | "routines"
  | "routine-detail"
  | "chat"
  | "memories"
  | "calendar"
  | "channels"
  | "tasks"
  | "settings";

interface LifeTab {
  id: string;
  type: LifeTabType;
  title?: string;
  convId?: string; // for chat tabs — the conversation ID
  chatNum?: number; // display number for chat tabs (#1, #2, etc.)
  routineId?: string; // for routine-detail tabs
  pinned?: boolean;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface SidebarItem {
  id: LifeTabType;
  label: string;
  icon: React.ReactNode;
}

const TAB_LABELS: Record<LifeTabType, string> = {
  today: "Today",
  actionables: "Actionables",
  routines: "Routines",
  "routine-detail": "Routine",
  chat: "Chat",
  memories: "Memories",
  calendar: "Calendar",
  channels: "Channels",
  tasks: "Tasks",
  settings: "Settings",
};

const TAB_ICONS: Record<LifeTabType, React.ReactNode> = {
  today: <Sun className="h-3 w-3" />,
  actionables: <CheckSquare className="h-3 w-3" />,
  routines: <Repeat className="h-3 w-3" />,
  "routine-detail": <Repeat className="h-3 w-3" />,
  chat: <MessageSquare className="h-3 w-3" />,
  memories: <Lightbulb className="h-3 w-3" />,
  calendar: <CalendarDays className="h-3 w-3" />,
  channels: <Radio className="h-3 w-3" />,
  tasks: <ListTodo className="h-3 w-3" />,
  settings: <Settings className="h-3 w-3" />,
};

const TAB_COLORS: Record<LifeTabType, string> = {
  today: "text-amber-500",
  actionables: "text-emerald-500",
  routines: "text-violet-500",
  "routine-detail": "text-violet-500",
  chat: "text-blue-500",
  memories: "text-yellow-500",
  calendar: "text-rose-500",
  channels: "text-cyan-500",
  tasks: "text-orange-500",
  settings: "text-neutral-400",
};

// ─── URL Routing ──────────────────────────────────────────────────────────────

const LIFE_BASE = "/tools/life";

function tabToUrl(tab: LifeTab): string {
  if (tab.type === "chat") {
    return tab.convId ? `${LIFE_BASE}/c/${tab.convId}` : LIFE_BASE;
  }
  if (tab.type === "routine-detail" && tab.routineId) {
    return `${LIFE_BASE}/routines/${tab.routineId}`;
  }
  return `${LIFE_BASE}/${tab.type}`;
}

function urlToTab(pathname: string): { type: LifeTabType; convId?: string; routineId?: string } | null {
  const rel = pathname.replace(LIFE_BASE, "").replace(/^\//, "");
  if (!rel || rel === "") return { type: "chat" };
  if (rel.startsWith("c/")) {
    const convId = rel.slice(2);
    return convId ? { type: "chat", convId } : { type: "chat" };
  }
  if (rel.startsWith("routines/")) {
    const routineId = rel.slice(9);
    return routineId ? { type: "routine-detail", routineId } : { type: "routines" };
  }
  const validTypes: LifeTabType[] = ["today", "actionables", "routines", "chat", "memories", "calendar", "channels", "tasks", "settings"];
  if (validTypes.includes(rel as LifeTabType)) return { type: rel as LifeTabType };
  return { type: "chat" };
}

// ─── Persisted State ──────────────────────────────────────────────────────────

type StartDay = 0 | 1 | 6; // Sunday, Monday, Saturday

interface LifeSettings {
  startDayOfWeek: StartDay;
  timezone: string;
  autoApproveActions: boolean;
}

const DEFAULT_SETTINGS: LifeSettings = {
  startDayOfWeek: 1,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoApproveActions: false,
};

interface LifePersistedState {
  tabs: LifeTab[];
  activeTabId: string | null;
  activeConvId: string | null;
  settings?: LifeSettings;
  onboarded?: boolean;
}

const DEFAULT_LIFE_STATE: LifePersistedState = {
  tabs: [{ id: "tab:chat", type: "chat" }],
  activeTabId: "tab:chat",
  activeConvId: null,
  settings: DEFAULT_SETTINGS,
};

const MEMORY_CATEGORIES = [
  { value: "preference", label: "Preference" },
  { value: "instruction", label: "Instruction" },
  { value: "fact", label: "Fact" },
  { value: "habit", label: "Habit" },
];

const CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  instruction: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  fact: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  habit: "bg-green-500/15 text-green-600 dark:text-green-400",
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function LifeSidebar({
  activeTabType,
  onOpenTab,
}: {
  activeTabType: LifeTabType | null;
  onOpenTab: (type: LifeTabType) => void;
}) {
  const groups: SidebarGroup[] = [
    {
      label: "Overview",
      items: [
        {
          id: "today",
          label: "Today",
          icon: <Sun className="h-3.5 w-3.5" />,
        },
      ],
    },
    {
      label: "Actions",
      items: [
        {
          id: "actionables",
          label: "Actionables",
          icon: <CheckSquare className="h-3.5 w-3.5" />,
        },
        {
          id: "routines",
          label: "Routines",
          icon: <Repeat className="h-3.5 w-3.5" />,
        },
      ],
    },
    {
      label: "Agent",
      items: [
        {
          id: "chat",
          label: "Chat",
          icon: <MessageSquare className="h-3.5 w-3.5" />,
        },
        {
          id: "memories",
          label: "Memories",
          icon: <Lightbulb className="h-3.5 w-3.5" />,
        },
      ],
    },
    {
      label: "Connect",
      items: [
        {
          id: "calendar",
          label: "Calendar",
          icon: <CalendarDays className="h-3.5 w-3.5" />,
        },
        {
          id: "tasks",
          label: "Tasks",
          icon: <ListTodo className="h-3.5 w-3.5" />,
        },
        {
          id: "channels",
          label: "Channels",
          icon: <Radio className="h-3.5 w-3.5" />,
        },
      ],
    },
    {
      label: "",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: <Settings className="h-3.5 w-3.5" />,
        },
      ],
    },
  ];

  return (
    <aside className="w-52 shrink-0 border-r flex flex-col overflow-hidden bg-muted/20">
      <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-3">
        {groups.filter((g) => g.label !== "").map((group) => (
          <div key={group.label}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpenTab(item.id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors",
                    activeTabType === item.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Settings at bottom */}
      <div className="shrink-0 border-t px-1.5 py-2">
        <button
          onClick={() => onOpenTab("settings")}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors",
            activeTabType === "settings"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
      </div>
    </aside>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

const THINKING_PHRASES = [
  "Thinking", "Pondering", "Figuring it out", "Mulling it over", "Processing",
  "Brainstorming", "Cooking up a plan", "Connecting the dots", "On it",
  "Working on it", "Crunching", "Plotting", "Scheming", "Noodling",
  "Brewing ideas", "Putting pieces together", "Mapping it out", "Reflecting",
  "Analyzing", "Considering options", "Weighing things up", "Digging in",
  "Getting creative", "Spinning gears", "Running the numbers", "Sorting it out",
  "Hatching a plan", "Chewing on it", "Wiring it up", "Assembling thoughts",
  "Calibrating", "Strategizing", "Untangling", "Decoding", "Synthesizing",
  "Forming a plan", "Sketching it out", "Piecing it together", "Evaluating",
  "Exploring options", "Charting a course", "Doing the math", "Deliberating",
  "Dreaming up ideas", "Building a plan", "Tuning in", "Getting organized",
  "Scanning the horizon", "Deep in thought", "Conjuring", "Sifting through",
  "Harmonizing", "Orchestrating", "Fine-tuning", "Laying groundwork",
  "Cranking away", "Drilling down", "Looking into it", "Checking things",
  "Running scenarios", "Meditating on it", "Wrestling with it", "Gathering intel",
  "Surveying the landscape", "Taking stock", "Cross-referencing", "Calculating",
  "Drafting a plan", "Composing thoughts", "Aligning the stars", "Forging ahead",
  "Warming up", "Revving up", "Gearing up", "Sharpening the pencil",
  "Dotting i's", "Tinkering", "Winding up", "Loading up", "Racking my brain",
  "Dusting off ideas", "Percolating", "Ruminating", "Incubating",
  "Germinating ideas", "Distilling", "Crystallizing", "Honing in",
  "Zeroing in", "Locking in", "Firing neurons", "Booting up",
  "Spinning up", "Compiling thoughts", "Rendering", "Buffering brilliance",
  "Consulting the oracle", "Reading the tea leaves", "Channeling wisdom",
  "Summoning focus", "Activating brain cells", "Engaging hyperdrive",
  "Entering the zone", "Initiating sequence", "Deploying logic",
];

function TypingIndicator() {
  const [phrase, setPhrase] = useState(() =>
    THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPhrase(THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-medium text-primary/70">Life</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
        </div>
        <span className="text-xs text-muted-foreground animate-pulse">{phrase}…</span>
      </div>
    </div>
  );
}

function StreamingThinkingIndicator() {
  const [phrase, setPhrase] = useState(() =>
    THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPhrase(THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-xs text-muted-foreground py-0.5"
    >
      <div className="flex items-center gap-0.5">
        <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
        <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
        <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
      </div>
      <span className="animate-pulse">{phrase}…</span>
    </motion.div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isLast }: { msg: LifeMessage; isLast?: boolean }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group">
      <div
        className={cn(
          "py-3",
          isUser ? "flex justify-end" : "",
        )}
      >
        {isUser ? (
          <div className="max-w-[85%]">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>
              <span className="text-[10px] font-medium text-muted-foreground/60">You</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words text-right">
              {msg.content}
            </p>
          </div>
        ) : (
          <div className="max-w-[90%]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium text-primary/70">Life</span>
              <span className="text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>
              <button
                onClick={handleCopy}
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
                title="Copy message"
              >
                {copied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
              </button>
            </div>
            <div className="text-sm leading-relaxed text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  code: ({ children, className }) => {
                    const isBlock = className?.startsWith("language-");
                    if (isBlock) {
                      return <code className="block bg-muted/60 rounded-md px-3 py-2 text-xs font-mono my-2 overflow-x-auto">{children}</code>;
                    }
                    return <code className="bg-muted/60 px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
                  },
                  pre: ({ children }) => <pre className="my-2">{children}</pre>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>
                  ),
                  h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
                  h2: ({ children }) => <p className="font-bold text-sm mb-1">{children}</p>,
                  h3: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
                  blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2">{children}</blockquote>,
                  hr: () => <hr className="border-border/50 my-2" />,
                  table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                  th: ({ children }) => <th className="text-left px-2 py-1 border-b font-semibold text-xs">{children}</th>,
                  td: ({ children }) => <td className="px-2 py-1 border-b border-border/30 text-xs">{children}</td>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
      {!isLast && <div className="border-b border-border/30" />}
    </div>
  );
}

// ─── Inline Chat Actionable ───────────────────────────────────────────────────

function InlineChatActionable({
  actionable,
  onRespond,
}: {
  actionable: LifeActionable;
  onRespond: (action: string, data?: unknown) => void;
}) {
  const [acting, setActing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const resolved = actionable.status !== "pending";

  const handle = async (action: string, data?: unknown) => {
    setActing(true);
    await onRespond(action, data);
    setActing(false);
  };

  return (
    <div className={cn(
      "mt-2 space-y-2 text-sm",
      resolved && "opacity-50"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{actionable.title}</p>
          {actionable.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{actionable.description}</p>
          )}
        </div>
        {resolved && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {actionable.status}
          </span>
        )}
      </div>

      {!resolved && actionable.type === "confirm" && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs" disabled={acting} onClick={() => handle("confirm")}>
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("dismiss")}>
            Dismiss
          </Button>
        </div>
      )}

      {!resolved && actionable.type === "choose" && actionable.options && (
        <div className="space-y-1.5 pt-1">
          {actionable.options.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                selectedOption === opt.id ? "bg-primary/10" : "hover:bg-muted/40"
              )}
            >
              <input
                type="radio"
                name={`choice-${actionable.id}`}
                checked={selectedOption === opt.id}
                onChange={() => setSelectedOption(opt.id)}
                className="mt-0.5"
              />
              <div>
                <span className="text-xs font-medium">{opt.label}</span>
                {opt.detail && <p className="text-[11px] text-muted-foreground">{opt.detail}</p>}
              </div>
            </label>
          ))}
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs" disabled={acting || !selectedOption} onClick={() => handle("choose", { optionId: selectedOption })}>
              Select
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("dismiss")}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {!resolved && actionable.type === "input" && (
        <div className="space-y-1.5 pt-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Your response..."
            className="w-full rounded-md bg-muted/40 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs" disabled={acting || !inputText.trim()} onClick={() => handle("input", { text: inputText })}>
              Submit
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("dismiss")}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {!resolved && actionable.type === "info" && (
        <div className="pt-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("confirm")}>
            Got it
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Tool metadata ───────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, { label: string; activeLabel: string; icon: React.ReactNode }> = {
  remember: { label: "Saved to memory", activeLabel: "Saving to memory", icon: <Lightbulb className="size-3.5" /> },
  forget: { label: "Removed memory", activeLabel: "Removing memory", icon: <X className="size-3.5" /> },
  create_routine: { label: "Created routine", activeLabel: "Creating routine", icon: <Repeat className="size-3.5" /> },
  update_routine: { label: "Updated routine", activeLabel: "Updating routine", icon: <Repeat className="size-3.5" /> },
  delete_routine: { label: "Removed routine", activeLabel: "Removing routine", icon: <Repeat className="size-3.5" /> },
  list_routines: { label: "Looked up routines", activeLabel: "Looking up routines", icon: <Repeat className="size-3.5" /> },
  create_actionable: { label: "Created actionable", activeLabel: "Creating actionable", icon: <CheckSquare className="size-3.5" /> },
  list_actionables: { label: "Looked up actionables", activeLabel: "Looking up actionables", icon: <CheckSquare className="size-3.5" /> },
  get_calendar_events: { label: "Fetched calendar", activeLabel: "Checking calendar", icon: <CalendarDays className="size-3.5" /> },
  create_calendar_event: { label: "Created event", activeLabel: "Creating calendar event", icon: <CalendarDays className="size-3.5" /> },
  update_calendar_event: { label: "Updated event", activeLabel: "Updating calendar event", icon: <CalendarDays className="size-3.5" /> },
  delete_calendar_event: { label: "Deleted event", activeLabel: "Deleting calendar event", icon: <CalendarDays className="size-3.5" /> },
  list_tasks: { label: "Fetched tasks", activeLabel: "Looking up tasks", icon: <ListTodo className="size-3.5" /> },
  create_task: { label: "Created task", activeLabel: "Creating task", icon: <ListTodo className="size-3.5" /> },
  complete_task: { label: "Completed task", activeLabel: "Completing task", icon: <Check className="size-3.5" /> },
  update_task: { label: "Updated task", activeLabel: "Updating task", icon: <ListTodo className="size-3.5" /> },
  delete_task: { label: "Deleted task", activeLabel: "Deleting task", icon: <ListTodo className="size-3.5" /> },
  create_task_list: { label: "Created task list", activeLabel: "Creating task list", icon: <ListTodo className="size-3.5" /> },
  link_event_to_routine: { label: "Linked event to routine", activeLabel: "Linking event to routine", icon: <CalendarDays className="size-3.5" /> },
};

// ─── Tool Call Display ────────────────────────────────────────────────────────
// Modern collapsible card inspired by Claude/Gemini tool call indicators.

function ToolCallDisplay({
  effect,
  onActionableRespond,
  msgId,
  onActionableStatusChange,
  onOpenRoutine,
}: {
  effect: ChatEffect;
  onActionableRespond: (id: string, action: string, data?: unknown) => void;
  msgId: string;
  onActionableStatusChange?: (msgId: string, actionableId: string, status: string) => void;
  onOpenRoutine?: (routineId: string, name: string) => void;
}) {
  const meta = TOOL_LABELS[effect.tool] ?? { label: effect.tool, activeLabel: effect.tool, icon: <Settings className="size-3.5" /> };

  // ── Actionable (interactive) ───────────────────────────────────────────────
  if (effect.tool === "create_actionable" && effect.actionable) {
    const a = effect.actionable as LifeActionable;
    const resolved = a.status !== "pending";

    if (resolved) {
      return (
        <div className="mt-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5" />
            <span>{a.title}</span>
            <span className="opacity-50">· {a.status}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2 max-w-[85%]">
        <InlineChatActionable
          actionable={a}
          onRespond={async (action, data) => {
            await onActionableRespond(effect.id, action, data);
            onActionableStatusChange?.(msgId, effect.id, action === "dismiss" ? "dismissed" : "confirmed");
          }}
        />
      </div>
    );
  }

  // ── Read-only lookup tools — hide from UI ────────────────────────────────
  const readOnlyTools = ["list_routines", "list_actionables", "get_calendar_events", "list_tasks"];
  if (readOnlyTools.includes(effect.tool)) {
    return null;
  }

  // ── All other tools — show result with link ────────────────────────────
  const data = effect.data;

  // Extract a human-readable detail string
  const detail =
    data?.content ? String(data.content) :             // remember
    data?.name ? String(data.name) :                   // routine
    data?.title ? String(data.title) :                 // task, actionable
    data?.summary ? String(data.summary) :             // calendar event
    data?.deleted ? "Deleted" :
    data?.forgotten ? "Removed" :
    null;

  // Determine "View →" link target
  const hasRoutineLink = (effect.tool === "create_routine" || effect.tool === "update_routine") && data?.routine_id != null;
  const hasMemoryLink = effect.tool === "remember" && data;
  const hasTaskLink = (effect.tool === "create_task" || effect.tool === "update_task" || effect.tool === "complete_task");
  const hasCalendarLink = effect.tool === "create_calendar_event" && data?.htmlLink != null;

  const linkEl = hasRoutineLink && onOpenRoutine ? (
    <button
      onClick={() => onOpenRoutine(String(data!.routine_id), String(data!.name ?? "Routine"))}
      className="text-muted-foreground/50 hover:text-primary transition-colors"
    >
      <ExternalLink className="size-3" />
    </button>
  ) : hasMemoryLink ? (
    <a href="/tools/life/memories" className="text-muted-foreground/50 hover:text-primary transition-colors">
      <ExternalLink className="size-3" />
    </a>
  ) : hasTaskLink ? (
    <a href="/tools/life/tasks" className="text-muted-foreground/50 hover:text-primary transition-colors">
      <ExternalLink className="size-3" />
    </a>
  ) : hasCalendarLink ? (
    <a href={String(data!.htmlLink)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-primary transition-colors">
      <ExternalLink className="size-3" />
    </a>
  ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground"
    >
      <div className="flex items-center justify-center size-4 rounded-full bg-primary/10 shrink-0">
        {meta.icon}
      </div>
      <span>{meta.label}</span>
      {detail && <span className="opacity-50 truncate max-w-[200px]">· {detail}</span>}
      {linkEl}
    </motion.div>
  );
}

// ─── Conversation List ─────────────────────────────────────────────────────────

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  loading,
}: {
  conversations: LifeConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  loading: boolean;
}) {
  return (
    <div className="w-52 shrink-0 border-r flex flex-col overflow-hidden bg-muted/10">
      <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={onNew}
          className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="New conversation"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {loading && (
          <div className="space-y-1.5 px-1 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center">
            No conversations yet
          </p>
        )}
        {!loading &&
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-1 w-full px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer",
                activeId === conv.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <span className="flex-1 truncate">{conv.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
                title="Delete conversation"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Chat View ────────────────────────────────────────────────────────────────

function ChatView({
  persistedConvId,
  onConvIdChange,
  onNewChat,
  systemContext,
  routineId,
  hideConversations,
  onToolEffect,
  onOpenRoutine,
  autoApprove,
  initialAssistantMessage,
  slotAboveInput,
}: {
  persistedConvId: string | null;
  onConvIdChange: (id: string | null) => void;
  onNewChat?: () => void;
  systemContext?: string;
  routineId?: string;
  hideConversations?: boolean;
  onToolEffect?: (tool: string) => void;
  onOpenRoutine?: (routineId: string, name: string) => void;
  autoApprove?: boolean;
  initialAssistantMessage?: string;
  slotAboveInput?: React.ReactNode;
}) {
  const [messages, setMessages] = useState<LifeMessage[]>(() =>
    initialAssistantMessage
      ? [{
          id: "onboarding-welcome",
          conversationId: "",
          role: "assistant",
          content: initialAssistantMessage,
          createdAt: new Date().toISOString(),
        }]
      : []
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingToolCall, setStreamingToolCall] = useState<string | null>(null);
  const [toolCallHistory, setToolCallHistory] = useState<string[]>([]);
  const [activeConvId, setActiveConvIdLocal] = useState<string | null>(persistedConvId);
  const [conversations, setConversations] = useState<LifeConversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [showConvList, setShowConvList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setActiveConvId = useCallback((id: string | null) => {
    setActiveConvIdLocal(id);
    onConvIdChange(id);
  }, [onConvIdChange]);

  // Load messages when persisted conversation ID becomes available
  const loadedConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (persistedConvId && persistedConvId !== loadedConvRef.current) {
      loadedConvRef.current = persistedConvId;
      setActiveConvIdLocal(persistedConvId);
      getLifeConversationMessages(persistedConvId)
        .then(setMessages)
        .catch(() => {});
    }
  }, [persistedConvId]);

  // For routine-scoped chats, load the existing conversation on mount
  useEffect(() => {
    if (!routineId) return;
    // If we already have messages loaded (e.g., from persistedConvId), skip
    if (activeConvId && loadedConvRef.current === activeConvId) return;

    let cancelled = false;
    getRoutineConversationId(routineId).then(async (convId) => {
      if (cancelled || !convId) return;
      setActiveConvIdLocal(convId);
      loadedConvRef.current = convId;
      try {
        const msgs = await getLifeConversationMessages(convId);
        if (!cancelled) setMessages(msgs);
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const convs = await listLifeConversations();
      setConversations(convs);
    } catch {
      // silently fail — conversations panel just stays empty
    } finally {
      setConvsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewChat = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    textareaRef.current?.focus();
  }, []);

  const handleSelectConv = useCallback(async (id: string) => {
    setActiveConvId(id);
    setMessages([]);
    try {
      const msgs = await getLifeConversationMessages(id);
      setMessages(msgs);
    } catch {
      // failed to load — leave empty
    }
    textareaRef.current?.focus();
  }, []);

  const handleDeleteConv = useCallback(
    async (id: string) => {
      try {
        await deleteLifeConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConvId === id) {
          setActiveConvId(null);
          setMessages([]);
        }
      } catch {
        // silently fail
      }
    },
    [activeConvId]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const optimisticUserMsg: LifeMessage = {
      id: `tmp-${Date.now()}`,
      conversationId: activeConvId ?? "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const placeholderId = `streaming-${Date.now()}`;
    let placeholderAdded = false;

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput("");
    setStreamingText("");
    setStreamingToolCall(null);
    setToolCallHistory([]);
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await streamLifeChat(
        text,
        {
          onToken: (token) => {
            if (!token) return;
            // Add the placeholder bubble on first real token
            if (!placeholderAdded) {
              placeholderAdded = true;
              setMessages((prev) => [...prev, {
                id: placeholderId,
                conversationId: activeConvId ?? "",
                role: "assistant",
                content: token,
                createdAt: new Date().toISOString(),
              }]);
              setStreamingText(token);
              return;
            }
            setStreamingText((prev) => {
              const next = prev + token;
              setMessages((msgs) =>
                msgs.map((m) =>
                  m.id === placeholderId ? { ...m, content: next } : m
                )
              );
              return next;
            });
          },
          onToolCall: (toolName) => {
            setStreamingToolCall(toolName);
            setToolCallHistory((prev) => [...prev, toolName]);
          },
          onToolResult: () => {
            setStreamingToolCall(null);
          },
          onComplete: (result) => {
            // Update conversation ID if this was a new chat.
            if (!activeConvId) {
              setActiveConvId(result.conversationId);
              loadConversations();
            }

            // Replace optimistic user msg + placeholder with final records.
            setMessages((prev) => {
              const withoutTmp = prev.filter(
                (m) => m.id !== optimisticUserMsg.id && m.id !== placeholderId
              );
              const confirmedUser: LifeMessage = {
                ...optimisticUserMsg,
                id: `user-${Date.now()}`,
                conversationId: result.conversationId,
              };
              const assistantMsg: LifeMessage = {
                ...result.message,
                toolCalls:
                  result.effects && result.effects.length > 0
                    ? result.effects
                    : result.message.toolCalls,
              };
              return [...withoutTmp, confirmedUser, assistantMsg];
            });

            setStreamingText("");
            setStreamingToolCall(null);
            setToolCallHistory([]);

            if (onToolEffect && result.effects) {
              for (const eff of result.effects) {
                onToolEffect(eff.tool);
              }
            }
          },
          onError: (errMsg) => {
            setMessages((prev) => {
              const withoutTmp = prev.filter(
                (m) => m.id !== optimisticUserMsg.id && m.id !== placeholderId
              );
              const errBubble: LifeMessage = {
                id: `err-${Date.now()}`,
                conversationId: activeConvId ?? "",
                role: "assistant",
                content: `Sorry, something went wrong: ${errMsg}`,
                createdAt: new Date().toISOString(),
              };
              return [...withoutTmp, errBubble];
            });
            setStreamingText("");
            setStreamingToolCall(null);
          },
        },
        activeConvId ?? undefined,
        systemContext,
        routineId,
        autoApprove,
      );
    } catch (err) {
      // Network-level failure before streaming could start.
      setMessages((prev) => {
        const withoutTmp = prev.filter(
          (m) => m.id !== optimisticUserMsg.id && m.id !== placeholderId
        );
        const errBubble: LifeMessage = {
          id: `err-${Date.now()}`,
          conversationId: activeConvId ?? "",
          role: "assistant",
          content: `Sorry, something went wrong: ${String(err)}`,
          createdAt: new Date().toISOString(),
        };
        return [...withoutTmp, errBubble];
      });
      setStreamingText("");
      setStreamingToolCall(null);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [input, sending, activeConvId, loadConversations, systemContext, routineId, onToolEffect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Conversation list panel */}
      {!hideConversations && showConvList && (
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConv}
          onDelete={handleDeleteConv}
          onNew={onNewChat ?? handleNewChat}
          loading={convsLoading}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Chat toolbar */}
        {!hideConversations && (
        <div className="flex items-center gap-2 px-4 h-10 border-b shrink-0">
          <button
            onClick={() => setShowConvList((v) => !v)}
            className={cn(
              "p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground",
              showConvList && "bg-muted text-foreground"
            )}
            title={showConvList ? "Hide conversations" : "Show conversations"}
          >
            {showConvList ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeft className="h-3.5 w-3.5" />
            )}
          </button>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {activeConvId
              ? (conversations.find((c) => c.id === activeConvId)?.title ??
                "Chat")
              : "New conversation"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={onNewChat ?? handleNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>
        )}

        {/* Messages */}
        <div className={cn("flex-1 px-5 py-2", messages.length > 0 || sending ? "overflow-y-auto" : "flex flex-col overflow-hidden")}>
          {messages.length === 0 && !sending && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  {systemContext ? "Edit this routine" : "Your AI life assistant"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {systemContext
                    ? "Ask me to update the schedule, add items, or change anything"
                    : "Plan your day, build routines, and stay organized"}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {(systemContext
                  ? [
                      { icon: <Edit2 className="h-3 w-3" />, text: "Change the schedule to weekdays only" },
                      { icon: <Plus className="h-3 w-3" />, text: "Add a new item to this routine" },
                      { icon: <Repeat className="h-3 w-3" />, text: "Make this routine more flexible" },
                    ]
                  : [
                      { icon: <Target className="h-3 w-3" />, text: "Plan my day tomorrow" },
                      { icon: <Dumbbell className="h-3 w-3" />, text: "Create a gym routine" },
                      { icon: <Phone className="h-3 w-3" />, text: "Remind me to call family weekly" },
                      { icon: <BookOpen className="h-3 w-3" />, text: "Help me build a reading habit" },
                    ]
                ).map((s) => (
                  <button
                    key={s.text}
                    onClick={() => {
                      setInput(s.text);
                      textareaRef.current?.focus();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/60 transition-all"
                  >
                    {s.icon}
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={msg.id}>
              <MessageBubble msg={msg} isLast={idx === messages.length - 1 && !sending} />
              {msg.role === "assistant" && msg.toolCalls?.map((eff, i) => (
                <ToolCallDisplay
                  key={`${eff.tool}-${eff.id || i}`}
                  effect={eff}
                  msgId={msg.id}
                  onActionableRespond={async (actionableId, action, data) => {
                    try {
                      await respondToActionable(actionableId, action, data);
                    } catch { /* ignore */ }
                  }}
                  onActionableStatusChange={(mId, actionableId, status) => {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === mId
                          ? {
                              ...m,
                              toolCalls: m.toolCalls?.map((e) =>
                                e.id === actionableId && e.actionable
                                  ? { ...e, actionable: { ...e.actionable, status } }
                                  : e
                              ),
                            }
                          : m
                      )
                    );
                  }}
                  onOpenRoutine={onOpenRoutine}
                />
              ))}
            </div>
          ))}
          {sending && streamingText === "" && streamingToolCall === null && toolCallHistory.length === 0 && <TypingIndicator />}
          <AnimatePresence>
          {(toolCallHistory.length > 0 || streamingToolCall) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-2 max-w-[85%] space-y-0.5"
            >
              {/* Completed tool calls */}
              <AnimatePresence>
              {toolCallHistory.filter((t) => t !== streamingToolCall).map((toolName, i) => {
                const m = TOOL_LABELS[toolName];
                return (
                  <motion.div
                    key={`${toolName}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 text-xs text-muted-foreground/70 py-0.5"
                  >
                    <div className="flex items-center justify-center size-4 rounded-full bg-primary/10">
                      <Check className="size-2.5 text-primary" />
                    </div>
                    <span>{m?.label ?? toolName}</span>
                  </motion.div>
                );
              })}
              </AnimatePresence>
              {/* Active tool call */}
              <AnimatePresence mode="wait">
              {streamingToolCall && (
                <motion.div
                  key={streamingToolCall}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 text-xs text-foreground/80 py-0.5"
                >
                  <div className="flex items-center justify-center size-4">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  </div>
                  <span>{TOOL_LABELS[streamingToolCall]?.activeLabel ?? streamingToolCall}&hellip;</span>
                </motion.div>
              )}
              </AnimatePresence>
              {/* Thinking state: tools ran but no text response yet */}
              {!streamingToolCall && sending && streamingText === "" && (
                <StreamingThinkingIndicator />
              )}
            </motion.div>
          )}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Slot above input */}
        {slotAboveInput}
        {/* Input area */}
        <div className="shrink-0 border-t px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={systemContext ? "Describe changes to this routine..." : "Ask me anything about your plans..."}
              disabled={sending}
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-xl border bg-background px-3.5 py-2.5 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-muted-foreground/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "min-h-[40px] max-h-[160px] leading-relaxed"
              )}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="h-10 w-10 rounded-xl shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-1">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Memories View ────────────────────────────────────────────────────────────

function MemoriesView() {
  const [memories, setMemories] = useState<LifeMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorCategory, setEditorCategory] = useState("instruction");
  const [editorDirty, setEditorDirty] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setMemories(await listLifeMemories()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const selectMemory = useCallback((m: LifeMemory) => {
    setSelectedId(m.id);
    setEditorContent(m.content);
    setEditorCategory(m.category);
    setEditorDirty(false);
    setIsNew(false);
  }, []);

  const startNew = useCallback(() => {
    setSelectedId(`new-${Date.now()}`);
    setEditorContent("");
    setEditorCategory("instruction");
    setEditorDirty(false);
    setIsNew(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editorContent.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const m = await createLifeMemory(editorContent.trim(), editorCategory);
        setMemories((prev) => [m, ...prev]);
        setSelectedId(m.id);
        setIsNew(false);
      } else if (selectedId) {
        const u = await updateLifeMemory(selectedId, editorContent.trim(), editorCategory);
        setMemories((prev) => prev.map((m) => (m.id === u.id ? u : m)));
      }
      setEditorDirty(false);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }, [isNew, selectedId, editorContent, editorCategory]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLifeMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) { setSelectedId(null); setEditorContent(""); setEditorDirty(false); }
    } catch (e) { setError(String(e)); }
    finally { setConfirmDeleteId(null); }
  }, [selectedId]);

  const filtered = filterCategory === "all" ? memories : memories.filter((m) => m.category === filterCategory);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-1 flex-1 flex-wrap">
          <button onClick={() => setFilterCategory("all")} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", filterCategory === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>All</button>
          {MEMORY_CATEGORIES.map((cat) => (
            <button key={cat.value} onClick={() => setFilterCategory(cat.value)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", filterCategory === cat.value ? cn(CATEGORY_COLORS[cat.value] ?? "bg-muted text-foreground") : "text-muted-foreground hover:bg-muted/50")}>{cat.label}</button>
          ))}
        </div>
        <button onClick={loadMemories} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
        <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={startNew}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      {/* Split: list + editor */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: compact list */}
        <div className={cn("flex flex-col overflow-hidden", selectedId || isNew ? "w-64 shrink-0 border-r" : "flex-1")}>
          {error && (
            <div className="flex items-center gap-1.5 mx-2 mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="h-2.5 w-2.5" /></button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-2 space-y-1">{[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded bg-muted/50 animate-pulse" />)}</div>}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">{filterCategory === "all" ? "No memories yet" : `No ${filterCategory} memories`}</p>
              </div>
            )}
            {!loading && filtered.map((memory) => (
              <div
                key={memory.id}
                role="button"
                tabIndex={0}
                onClick={() => selectMemory(memory)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectMemory(memory); }}
                className={cn(
                  "w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border/20 hover:bg-accent/40 transition-colors group cursor-pointer",
                  selectedId === memory.id && "bg-accent/60"
                )}
              >
                <span className={cn("shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-none", CATEGORY_COLORS[memory.category] ?? "bg-muted text-muted-foreground")}>
                  {memory.category.slice(0, 4)}
                </span>
                <span className="flex-1 min-w-0 truncate text-foreground/80">{memory.content.split("\n")[0] || "Empty"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                  className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: editor */}
        {(selectedId || isNew) && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                {MEMORY_CATEGORIES.map((cat) => (
                  <button key={cat.value} onClick={() => { setEditorCategory(cat.value); setEditorDirty(true); }} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", editorCategory === cat.value ? cn(CATEGORY_COLORS[cat.value] ?? "bg-primary text-primary-foreground", "ring-1 ring-primary/30") : "bg-muted/50 text-muted-foreground hover:bg-muted")}>{cat.label}</button>
                ))}
              </div>
              <Button size="sm" className="gap-1 text-xs h-6" onClick={handleSave} disabled={!editorContent.trim() || saving || (!editorDirty && !isNew)}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {isNew ? "Create" : "Save"}
              </Button>
              <button onClick={() => { setSelectedId(null); setIsNew(false); setEditorDirty(false); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <textarea
                value={editorContent}
                onChange={(e) => { setEditorContent(e.target.value); setEditorDirty(true); }}
                placeholder="Write your memory in markdown..."
                className="w-full h-full resize-none bg-background px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none placeholder:text-muted-foreground/40"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); } }}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-1 border-t text-[10px] text-muted-foreground/50 shrink-0">
              <span>{editorContent.length} chars</span>
              <span>{editorContent.split("\n").length} lines</span>
              {editorDirty && <span className="text-amber-500">unsaved</span>}
              {!editorDirty && !isNew && <span className="text-green-500">saved</span>}
              <span className="ml-auto">Cmd+S to save</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Memory</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule !== "object") return "No schedule set";
  const s = schedule as Record<string, unknown>;
  const freq = s.frequency as string | undefined;
  const days = s.days as (number | string)[] | undefined;
  const time = s.time as string | undefined;
  const interval = s.interval as number | undefined;
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (freq === "daily") {
    return time ? `Every day at ${time}` : "Every day";
  }
  if (freq === "weekly" && days?.length) {
    const dayNames = days
      .map((d) => typeof d === "number" ? (DAY_NAMES[d] ?? String(d)) : String(d).charAt(0).toUpperCase() + String(d).slice(1, 3))
      .join(", ");
    return time ? `${dayNames} at ${time}` : dayNames;
  }
  if ((freq === "every_n_days" || freq === "custom") && interval) {
    return time ? `Every ${interval} days at ${time}` : `Every ${interval} days`;
  }
  return freq ?? "Custom schedule";
}

// ─── Actionables View ─────────────────────────────────────────────────────────

// Map action_type to human label + icon for deferred actions
const ACTION_TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  create_routine: { label: "Create routine", icon: <Repeat className="h-3.5 w-3.5 text-violet-500" /> },
  create_memory: { label: "Save memory", icon: <Lightbulb className="h-3.5 w-3.5 text-yellow-500" /> },
  create_calendar_event: { label: "Add to calendar", icon: <CalendarDays className="h-3.5 w-3.5 text-rose-500" /> },
  delete_calendar_event: { label: "Remove event", icon: <CalendarDays className="h-3.5 w-3.5 text-red-500" /> },
  create_task: { label: "Create task", icon: <ListTodo className="h-3.5 w-3.5 text-orange-500" /> },
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  calendar: <CalendarDays className="size-3.5" />,
  check: <Check className="size-3.5" />,
  target: <Target className="size-3.5" />,
  brain: <Brain className="size-3.5" />,
  dumbbell: <Dumbbell className="size-3.5" />,
  utensils: <Sun className="size-3.5" />,
  phone: <Phone className="size-3.5" />,
  star: <Sparkles className="size-3.5" />,
  clock: <Clock className="size-3.5" />,
  alert: <AlertCircle className="size-3.5" />,
  "map-pin": <MapPin className="size-3.5" />,
  list: <ListTodo className="size-3.5" />,
};

function ActionableSections({ sections }: { sections: { icon?: string; title: string; items: string[] }[] }) {
  return (
    <div className="mt-2 space-y-3">
      {sections.map((section, i) => (
        <div key={i}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-muted-foreground/60">
              {section.icon ? (SECTION_ICONS[section.icon] ?? <ListTodo className="size-3.5" />) : <ListTodo className="size-3.5" />}
            </span>
            <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">{section.title}</span>
          </div>
          <ul className="space-y-0.5 pl-5">
            {section.items.map((item, j) => (
              <li key={j} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                <span className="text-muted-foreground/30 mt-1.5 shrink-0 size-1 rounded-full bg-current" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Guess an icon from a section title for legacy actionables that don't have structured sections.
const SECTION_TITLE_ICON_MAP: [RegExp, string][] = [
  [/calendar|event|schedule/i, "calendar"],
  [/task|todo|to-do/i, "check"],
  [/routine|habit|gym|workout|exercise/i, "dumbbell"],
  [/notable|highlight|remind/i, "star"],
  [/goal|target|focus/i, "target"],
  [/meal|food|breakfast|lunch|dinner|calori/i, "utensils"],
  [/call|phone|contact/i, "phone"],
  [/time|clock|deadline|due/i, "clock"],
  [/warn|alert|urgent|overdue/i, "alert"],
  [/location|place|map/i, "map-pin"],
];

function guessIconForTitle(title: string): string {
  for (const [re, icon] of SECTION_TITLE_ICON_MAP) {
    if (re.test(title)) return icon;
  }
  return "list";
}

/** Parse a markdown-style description into structured sections.
 *  Detects patterns like: **emoji Title:** followed by bullet lines (• or -).
 *  Returns null if the description doesn't look structured. */
function parseSectionsFromDescription(desc: string): { icon?: string; title: string; items: string[] }[] | null {
  const lines = desc.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: { icon?: string; title: string; items: string[] }[] = [];
  let current: { icon?: string; title: string; items: string[] } | null = null;

  for (const line of lines) {
    // Match section headers like: **📅 Calendar Events:** or **Tasks:** or ## Tasks
    const headerMatch = line.match(/^\*\*\s*(?:\p{Emoji_Presentation}\s*)?(.+?):\s*\*\*$/u)
      ?? line.match(/^##\s+(?:\p{Emoji_Presentation}\s*)?(.+)$/u);
    if (headerMatch) {
      if (current && current.items.length > 0) sections.push(current);
      const title = headerMatch[1].trim();
      current = { icon: guessIconForTitle(title), title, items: [] };
      continue;
    }

    // Match bullet items: • item, - item, * item
    const bulletMatch = line.match(/^[•\-*]\s+(.+)$/);
    if (bulletMatch && current) {
      current.items.push(bulletMatch[1].replace(/\*\*/g, "").trim());
      continue;
    }

    // Non-header, non-bullet line while we have a current section — treat as item
    if (current && line.length > 0 && !line.startsWith("**")) {
      current.items.push(line.replace(/\*\*/g, "").trim());
    }
  }
  if (current && current.items.length > 0) sections.push(current);

  // Only return if we found at least 2 sections (otherwise it's probably just text)
  return sections.length >= 2 ? sections : null;
}

const TEMPLATE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  daily_plan:    { label: "Daily Plan",       icon: <Sun className="h-3.5 w-3.5 text-amber-500" /> },
  daily_review:  { label: "Daily Review",     icon: <Pencil className="h-3.5 w-3.5 text-violet-500" /> },
  routine_check: { label: "Routine Check",    icon: <Repeat className="h-3.5 w-3.5 text-blue-500" /> },
  meal_choice:   { label: "Meal Choice",      icon: <Sun className="h-3.5 w-3.5 text-orange-500" /> },
  schedule_pick: { label: "Schedule",         icon: <CalendarDays className="h-3.5 w-3.5 text-indigo-500" /> },
  reminder:      { label: "Reminder",         icon: <Clock className="h-3.5 w-3.5 text-rose-500" /> },
  preference:    { label: "Quick Question",   icon: <MessageSquare className="h-3.5 w-3.5 text-sky-500" /> },
  task_roundup:  { label: "Task Summary",     icon: <ListTodo className="h-3.5 w-3.5 text-emerald-500" /> },
  streak:        { label: "Streak",           icon: <Target className="h-3.5 w-3.5 text-orange-500" /> },
  suggestion:    { label: "Suggestion",       icon: <Sparkles className="h-3.5 w-3.5 text-primary" /> },
};

function ActionableContent({ actionable }: { actionable: LifeActionable }) {
  const tpl = actionable.actionPayload?.template;
  const d = actionable.actionPayload?.data;

  // ── daily_plan: sections-based layout ──
  if (tpl === "daily_plan" && d?.sections) {
    return <ActionableSections sections={d.sections} />;
  }

  // ── daily_review: completed/missed + question ──
  if (tpl === "daily_review" && d) {
    return (
      <div className="mt-2 space-y-2">
        {d.completed && d.completed.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Check className="size-3 text-green-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">Completed</span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.completed.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground">{item}</li>
              ))}
            </ul>
          </div>
        )}
        {d.missed && d.missed.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle className="size-3 text-amber-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">Missed</span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.missed.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground">{item}</li>
              ))}
            </ul>
          </div>
        )}
        {d.question && <p className="text-xs text-muted-foreground/70 italic mt-1">{d.question}</p>}
      </div>
    );
  }

  // ── routine_check ──
  if (tpl === "routine_check" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.scheduled_time && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{d.scheduled_time}</span>
          </div>
        )}
        {d.details && <p className="text-xs text-muted-foreground/70">{d.details}</p>}
      </div>
    );
  }

  // ── reminder ──
  if (tpl === "reminder" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.message && <p className="text-xs text-foreground/80">{d.message}</p>}
        {d.time && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{d.time}</span>
          </div>
        )}
        {d.context && <p className="text-[11px] text-muted-foreground/60">{d.context}</p>}
      </div>
    );
  }

  // ── task_roundup ──
  if (tpl === "task_roundup" && d) {
    return (
      <div className="mt-2 space-y-2">
        {d.pending && d.pending.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <ListTodo className="size-3 text-orange-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">Pending</span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.pending.map((t, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>{t.title}</span>
                  {t.due && <span className="text-[10px] text-muted-foreground/50">· {t.due}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.completed_today && d.completed_today.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Check className="size-3 text-green-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">Done Today</span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.completed_today.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground/60 line-through">{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── streak ──
  if (tpl === "streak" && d) {
    return (
      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-full bg-primary/10">
          <span className="text-lg font-bold text-primary">{d.count ?? 0}</span>
        </div>
        <div>
          {d.message && <p className="text-xs text-foreground/80">{d.message}</p>}
          {d.best != null && d.best > 0 && (
            <p className="text-[10px] text-muted-foreground/50">Personal best: {d.best} {d.unit ?? "days"}</p>
          )}
        </div>
      </div>
    );
  }

  // ── suggestion ──
  if (tpl === "suggestion" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.suggestion && <p className="text-xs text-foreground/80">{d.suggestion}</p>}
        {d.reasoning && <p className="text-[11px] text-muted-foreground/50 italic">{d.reasoning}</p>}
      </div>
    );
  }

  // ── preference ──
  if (tpl === "preference" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.question && <p className="text-xs text-foreground/80">{d.question}</p>}
        {d.context && <p className="text-[11px] text-muted-foreground/50">{d.context}</p>}
      </div>
    );
  }

  // ── schedule_pick / meal_choice: options are rendered by the action area, just show context ──
  if ((tpl === "schedule_pick" || tpl === "meal_choice") && d?.context) {
    return <p className="text-xs text-muted-foreground/70 mt-1">{d.context}</p>;
  }

  // ── Legacy fallback: try parsing sections from description ──
  if (actionable.actionPayload?.sections?.length) {
    return <ActionableSections sections={actionable.actionPayload.sections} />;
  }
  if (actionable.description) {
    const parsed = parseSectionsFromDescription(actionable.description);
    if (parsed) return <ActionableSections sections={parsed} />;
    return <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{actionable.description}</p>;
  }
  return null;
}

function ActionableCard({
  actionable,
  onRespond,
}: {
  actionable: LifeActionable;
  onRespond: (id: string, action: string, data?: unknown) => Promise<void>;
}) {
  const [textInput, setTextInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const isPending = actionable.status === "pending";

  const isDueSoon =
    actionable.dueAt &&
    new Date(actionable.dueAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  const isOverdue =
    actionable.dueAt && new Date(actionable.dueAt).getTime() < Date.now();

  const actionMeta = actionable.actionType ? ACTION_TYPE_META[actionable.actionType] : null;

  const handleAction = async (action: string, data?: unknown) => {
    setActing(true);
    try {
      await onRespond(actionable.id, action, data);
    } finally {
      setActing(false);
    }
  };

  // Resolved state — compact single line
  if (!isPending) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 text-muted-foreground/50">
        {actionable.status === "confirmed" ? (
          <Check className="h-3.5 w-3.5 text-green-500/60 shrink-0" />
        ) : (
          <X className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="text-xs line-through truncate flex-1">{actionable.title}</span>
        <span className="text-[10px] shrink-0">{relativeTime(actionable.resolvedAt ?? actionable.createdAt)}</span>
      </div>
    );
  }

  // Pending — full interactive card
  return (
    <div className={cn(
      "rounded-lg border bg-card transition-all",
      isDueSoon && !isOverdue && "border-amber-500/30",
      isOverdue && "border-red-500/30",
    )}>
      {/* Main row */}
      <div className="flex items-start gap-3 p-4 pb-0">
        {/* Template icon */}
        <div className="mt-0.5 shrink-0">
          {TEMPLATE_META[actionable.actionPayload?.template ?? ""]?.icon
            ?? actionMeta?.icon
            ?? (actionable.type === "info"
              ? <Info className="h-3.5 w-3.5 text-blue-500" />
              : <Sparkles className="h-3.5 w-3.5 text-primary" />
            )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Template label */}
          {(() => {
            const label = TEMPLATE_META[actionable.actionPayload?.template ?? ""]?.label ?? actionMeta?.label;
            return label ? (
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
            ) : null;
          })()}
          <p className="text-sm font-medium text-foreground leading-snug">{actionable.title}</p>
          <ActionableContent actionable={actionable} />

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
            <span>{relativeTime(actionable.createdAt)}</span>
            {actionable.dueAt && (
              <span className={cn(
                "flex items-center gap-0.5",
                isOverdue ? "text-red-500" : isDueSoon ? "text-amber-500" : ""
              )}>
                <Clock className="h-2.5 w-2.5" />
                {isOverdue ? "Overdue" : `Due ${relativeTime(actionable.dueAt)}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action area */}
      <div className="p-3 pt-3">
        {actionable.type === "confirm" && (
          <div className="flex items-center gap-2">
            <button
              disabled={acting}
              onClick={() => handleAction("confirm")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approve
            </button>
            <button
              disabled={acting}
              onClick={() => handleAction("dismiss")}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
            >
              <X className="h-3 w-3" />
              Skip
            </button>
          </div>
        )}

        {actionable.type === "choose" && (actionable.options ?? actionable.actionPayload?.data?.options) && (
          <div className="space-y-2">
            <div className="grid gap-1.5">
              {(actionable.options ?? actionable.actionPayload?.data?.options ?? []).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSelectedOption(opt.id);
                    handleAction("choose", { optionId: opt.id });
                  }}
                  disabled={acting}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-all disabled:opacity-50",
                    "border-border hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="flex-1">
                    <span className="font-medium text-foreground">{opt.label}</span>
                    {opt.detail && <span className="block text-muted-foreground mt-0.5">{opt.detail}</span>}
                  </span>
                </button>
              ))}
            </div>
            <button
              disabled={acting}
              onClick={() => handleAction("dismiss")}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              Skip this
            </button>
          </div>
        )}

        {actionable.type === "input" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={actionable.actionPayload?.data?.placeholder ?? "Type your answer…"}
                className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && textInput.trim()) {
                    handleAction("input", { value: textInput.trim() });
                  }
                }}
              />
              <button
                disabled={acting || !textInput.trim()}
                onClick={() => handleAction("input", { value: textInput.trim() })}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </button>
            </div>
            <button
              disabled={acting}
              onClick={() => handleAction("dismiss")}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              Skip this
            </button>
          </div>
        )}

        {actionable.type === "info" && (
          <button
            disabled={acting}
            onClick={() => handleAction("confirm")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}

function ActionablesView() {
  const [actionables, setActionables] = useState<LifeActionable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLifeActionables();
      setActionables(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRespond = useCallback(
    async (id: string, action: string, data?: unknown) => {
      await respondToActionable(id, action, data);
      // Optimistic: remove from list immediately, then refresh
      setActionables((prev) => prev.map((a) =>
        a.id === id ? { ...a, status: action === "dismiss" ? "dismissed" : "confirmed", resolvedAt: new Date().toISOString() } : a
      ));
      const updated = await listLifeActionables();
      setActionables(updated);
    },
    []
  );

  const pending = actionables.filter((a) => a.status === "pending");
  const resolved = actionables.filter((a) => a.status !== "pending");

  // Sort pending: overdue first, then due soon, then by created
  const sortedPending = [...pending].sort((a, b) => {
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Actionables</span>
            {pending.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {pending.length}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => { setError(null); load(); }} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {loading && (
          <div className="px-4 py-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg border bg-card animate-pulse" />
            ))}
          </div>
        )}

        {!loading && pending.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
            <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground mt-1">
                No items need your attention right now. Your AI agent will create actionables as suggestions come up.
              </p>
            </div>
          </div>
        )}

        {/* Pending items */}
        {!loading && sortedPending.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            {sortedPending.map((a) => (
              <ActionableCard key={a.id} actionable={a} onRespond={handleRespond} />
            ))}
          </div>
        )}

        {/* Resolved section — collapsible */}
        {!loading && resolved.length > 0 && (
          <div className="border-t mt-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showResolved ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Resolved ({resolved.length})</span>
            </button>
            {showResolved && (
              <div>
                {resolved.slice(0, 20).map((a) => (
                  <ActionableCard key={a.id} actionable={a} onRespond={handleRespond} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Routines View ────────────────────────────────────────────────────────────

const ROUTINE_TYPES = [
  { value: "call_loved_ones", label: "Call Loved Ones" },
  { value: "gym", label: "Gym" },
  { value: "reading", label: "Reading" },
  { value: "custom", label: "Custom" },
];

const ROUTINE_TYPE_COLORS: Record<string, string> = {
  call_loved_ones: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  gym: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  reading: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  custom: "bg-muted text-muted-foreground",
};

const DAYS_OF_WEEK = [
  { value: "monday", short: "Mon" },
  { value: "tuesday", short: "Tue" },
  { value: "wednesday", short: "Wed" },
  { value: "thursday", short: "Thu" },
  { value: "friday", short: "Fri" },
  { value: "saturday", short: "Sat" },
  { value: "sunday", short: "Sun" },
];

// ─── Type-specific Config Editors ──────────────────────────────────────────────

const inputCls = "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50";

function CallLovedOnesConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.contacts) ? c : { contacts: [] }; } catch { return { contacts: [] }; } })();
  const contacts: { name: string; frequency: string }[] = parsed.contacts ?? [];

  const update = (newContacts: { name: string; frequency: string }[]) => {
    onChange(JSON.stringify({ ...parsed, contacts: newContacts }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">People to call</p>
      {contacts.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={c.name}
            onChange={(e) => { const n = [...contacts]; n[i] = { ...n[i], name: e.target.value }; update(n); }}
            placeholder="Name"
            className={cn(inputCls, "flex-1")}
          />
          <select
            value={c.frequency}
            onChange={(e) => { const n = [...contacts]; n[i] = { ...n[i], frequency: e.target.value }; update(n); }}
            className={cn(inputCls, "w-32")}
          >
            <option value="daily">Daily</option>
            <option value="every_other_day">Every other day</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button onClick={() => update(contacts.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...contacts, { name: "", frequency: "weekly" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add contact
      </button>
    </div>
  );
}

function GymConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.variations) ? c : { variations: [] }; } catch { return { variations: [] }; } })();
  const variations: { day: string; workout: string }[] = parsed.variations ?? [];

  const update = (newVars: { day: string; workout: string }[]) => {
    onChange(JSON.stringify({ ...parsed, variations: newVars }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Workout variations</p>
      {variations.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={v.day}
            onChange={(e) => { const n = [...variations]; n[i] = { ...n[i], day: e.target.value }; update(n); }}
            className={cn(inputCls, "w-28")}
          >
            {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.short}</option>)}
          </select>
          <input
            type="text"
            value={v.workout}
            onChange={(e) => { const n = [...variations]; n[i] = { ...n[i], workout: e.target.value }; update(n); }}
            placeholder="e.g. Upper body, Cardio, Legs"
            className={cn(inputCls, "flex-1")}
          />
          <button onClick={() => update(variations.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...variations, { day: "monday", workout: "" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add variation
      </button>
    </div>
  );
}

function ReadingConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.books) ? c : { books: [] }; } catch { return { books: [] }; } })();
  const books: { title: string; status: string }[] = parsed.books ?? [];

  const update = (newBooks: { title: string; status: string }[]) => {
    onChange(JSON.stringify({ ...parsed, books: newBooks }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Reading list</p>
      {books.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={b.title}
            onChange={(e) => { const n = [...books]; n[i] = { ...n[i], title: e.target.value }; update(n); }}
            placeholder="Book title"
            className={cn(inputCls, "flex-1")}
          />
          <select
            value={b.status}
            onChange={(e) => { const n = [...books]; n[i] = { ...n[i], status: e.target.value }; update(n); }}
            className={cn(inputCls, "w-28")}
          >
            <option value="queued">Queued</option>
            <option value="reading">Reading</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={() => update(books.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...books, { title: "", status: "queued" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add book
      </button>
    </div>
  );
}

// ─── Routine Dialog ───────────────────────────────────────────────────────────

interface RoutineFormState {
  name: string;
  type: string;
  description: string;
  frequency: string;
  interval: string;
  days: string[];
  time: string;
  config: string; // JSON string
}

function RoutineDialog({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: LifeRoutine | null;
  onSave: (data: Partial<LifeRoutine>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<RoutineFormState>(() => {
    if (!initial) {
      return {
        name: "",
        type: "custom",
        description: "",
        frequency: "weekly",
        interval: "1",
        days: [],
        time: "09:00",
        config: "{}",
      };
    }
    const s = (initial.schedule as Record<string, unknown>) ?? {};
    return {
      name: initial.name,
      type: initial.type,
      description: initial.description,
      frequency: (s.frequency as string) ?? "weekly",
      interval: String(s.interval ?? "1"),
      days: (s.days as string[]) ?? [],
      time: (s.time as string) ?? "09:00",
      config: JSON.stringify(initial.config ?? {}, null, 2),
    };
  });

  const setField = <K extends keyof RoutineFormState>(
    key: K,
    value: RoutineFormState[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const handleSave = () => {
    let parsedConfig: unknown = {};
    try {
      parsedConfig = JSON.parse(form.config || "{}");
    } catch {
      parsedConfig = {};
    }

    const schedule: Record<string, unknown> = {
      frequency: form.frequency,
    };
    if (form.frequency === "weekly") schedule.days = form.days;
    if (form.frequency === "custom") schedule.interval = parseInt(form.interval) || 1;
    if (form.time) schedule.time = form.time;

    onSave({
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      schedule,
      config: parsedConfig,
    });
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Routine" : "New Routine"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Routine name…"
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ROUTINE_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setField("type", rt.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    form.type === rt.value
                      ? cn(
                          ROUTINE_TYPE_COLORS[rt.value] ??
                            "bg-muted text-foreground",
                          "ring-2 ring-primary/40"
                        )
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="What is this routine about?"
              rows={2}
              className={cn(
                "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Schedule
            </label>

            {/* Frequency selector */}
            <div className="flex gap-1.5">
              {[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "custom", label: "Every N days" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setField("frequency", opt.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border",
                    form.frequency === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-border/80 hover:bg-muted/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom interval */}
            {form.frequency === "custom" && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">Every</span>
                <input
                  type="number"
                  min="1"
                  value={form.interval}
                  onChange={(e) => setField("interval", e.target.value)}
                  className={cn(
                    "w-16 rounded-md border bg-background px-2 py-1.5 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                />
                <span className="text-muted-foreground text-xs">days</span>
              </div>
            )}

            {/* Day selectors (weekly) */}
            {form.frequency === "weekly" && (
              <div className="flex flex-wrap gap-1">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      "h-7 w-10 rounded-md text-xs font-medium transition-colors border",
                      form.days.includes(d.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setField("time", e.target.value)}
                className={cn(
                  "rounded-md border bg-background px-2 py-1.5 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
              />
            </div>
          </div>

          {/* Config — type-specific editors */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Config
            </label>

            {form.type === "call_loved_ones" && (
              <CallLovedOnesConfigEditor
                config={form.config}
                onChange={(c) => setField("config", c)}
              />
            )}

            {form.type === "gym" && (
              <GymConfigEditor
                config={form.config}
                onChange={(c) => setField("config", c)}
              />
            )}

            {form.type === "reading" && (
              <ReadingConfigEditor
                config={form.config}
                onChange={(c) => setField("config", c)}
              />
            )}

            {!["call_loved_ones", "gym", "reading"].includes(form.type) && (
              <div className="space-y-1.5">
                <textarea
                  value={form.config}
                  onChange={(e) => setField("config", e.target.value)}
                  placeholder="{}"
                  rows={3}
                  spellCheck={false}
                  className={cn(
                    "w-full resize-y rounded-md border bg-background px-3 py-2 text-xs font-mono",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    "placeholder:text-muted-foreground/50"
                  )}
                />
                <p className="text-[10px] text-muted-foreground/60">
                  Custom config as JSON. Leave {"{ }"} if unsure.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {initial ? "Save Changes" : "Create Routine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoutineCard({
  routine,
  onDelete,
  onToggleActive,
  onOpen,
}: {
  routine: LifeRoutine;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const typeColor =
    ROUTINE_TYPE_COLORS[routine.type] ?? "bg-muted text-muted-foreground";
  const typeLabel =
    ROUTINE_TYPES.find((t) => t.value === routine.type)?.label ?? routine.type;

  const routineIcons: Record<string, React.ReactNode> = {
    gym: <Dumbbell className="h-4 w-4" />,
    reading: <BookOpen className="h-4 w-4" />,
    call_loved_ones: <Phone className="h-4 w-4" />,
    morning_routine: <Sun className="h-4 w-4" />,
    evening_routine: <Sun className="h-4 w-4" />,
  };
  const icon = routineIcons[routine.type] ?? <Repeat className="h-4 w-4" />;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
        "hover:bg-muted/50",
        !routine.active && "opacity-50"
      )}
      onClick={() => onOpen(routine.id)}
    >
      {/* Icon */}
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
        typeColor
      )}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{routine.name}</p>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {formatSchedule(routine.schedule)}
          {routine.description ? ` · ${routine.description}` : ""}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Toggle switch */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleActive(routine.id, !routine.active); }}
          className="relative shrink-0"
          title={routine.active ? "Pause routine" : "Resume routine"}
        >
          <div className={cn(
            "h-5 w-9 rounded-full transition-colors",
            routine.active ? "bg-primary" : "bg-muted-foreground/20"
          )} />
          <div className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            routine.active ? "translate-x-[18px]" : "translate-x-0.5"
          )} />
        </button>

        {/* Delete — show on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(routine.id); }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function RoutinesView({ onOpenRoutine }: { onOpenRoutine?: (id: string, name: string) => void }) {
  const [routines, setRoutines] = useState<LifeRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editRoutine, setEditRoutine] = useState<LifeRoutine | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLifeRoutines();
      setRoutines(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(
    async (data: Partial<LifeRoutine>) => {
      setSaving(true);
      try {
        if (editRoutine) {
          const updated = await updateLifeRoutine(editRoutine.id, data);
          setRoutines((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
        } else {
          const created = await createLifeRoutine(data);
          setRoutines((prev) => [created, ...prev]);
        }
        setShowDialog(false);
        setEditRoutine(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [editRoutine]
  );

  const handleToggleActive = useCallback(
    async (id: string, active: boolean) => {
      try {
        const updated = await updateLifeRoutine(id, { active });
        setRoutines((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      } catch (e) {
        setError(String(e));
      }
    },
    []
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLifeRoutine(id);
      setRoutines((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(String(e));
    } finally {
      setConfirmDeleteId(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0">
        <span className="text-xs text-muted-foreground flex-1">
          {routines.length > 0 &&
            `${routines.filter((r) => r.active).length} active`}
        </span>
        <button
          onClick={load}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7"
          onClick={() => {
            setEditRoutine(null);
            setShowDialog(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Routine
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="flex items-center gap-2 mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => { setError(null); load(); }} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {loading && (
          <div className="px-3 py-2 space-y-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && routines.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No routines yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create one to build consistent habits</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1" onClick={() => { setEditRoutine(null); setShowDialog(true); }}>
              <Plus className="h-3.5 w-3.5" />
              New Routine
            </Button>
          </div>
        )}

        {!loading && routines.length > 0 && (
          <div className="px-2 py-1.5">
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onDelete={setConfirmDeleteId}
                onToggleActive={handleToggleActive}
                onOpen={(id) => onOpenRoutine?.(id, routine.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      {showDialog && (
        <RoutineDialog
          initial={editRoutine}
          onSave={handleSave}
          onCancel={() => {
            setShowDialog(false);
            setEditRoutine(null);
          }}
          saving={saving}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={() => setConfirmDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Routine</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this routine? This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Routine Detail View ──────────────────────────────────────────────────────

function RoutineDetailView({ routineId }: { routineId: string }) {
  const [routine, setRoutine] = useState<LifeRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleStr, setScheduleStr] = useState("{}");
  const [configStr, setConfigStr] = useState("{}");

  // Resizable panel
  const [panelWidth, setPanelWidth] = useState(420);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const handleMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startXRef.current - ev.clientX;
      setPanelWidth(Math.max(300, Math.min(700, startWidthRef.current + delta)));
    };
    const handleMouseUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getLifeRoutine(routineId);
      setRoutine(r);
      setName(r.name);
      setDescription(r.description);
      setScheduleStr(JSON.stringify(r.schedule, null, 2));
      setConfigStr(JSON.stringify(r.config, null, 2));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => { load(); }, [load]);

  // Silent refresh — updates data without showing loading spinner
  const refresh = useCallback(async () => {
    try {
      const r = await getLifeRoutine(routineId);
      setRoutine(r);
      if (!editing) {
        setName(r.name);
        setDescription(r.description);
        setScheduleStr(JSON.stringify(r.schedule, null, 2));
        setConfigStr(JSON.stringify(r.config, null, 2));
      }
    } catch { /* silent */ }
  }, [routineId, editing]);

  const handleSave = async () => {
    if (!routine) return;
    setSaving(true);
    try {
      let schedule: unknown = {};
      let config: unknown = {};
      try { schedule = JSON.parse(scheduleStr); } catch { /* keep default */ }
      try { config = JSON.parse(configStr); } catch { /* keep default */ }
      const updated = await updateLifeRoutine(routine.id, {
        name,
        description,
        schedule,
        config,
      } as Partial<LifeRoutine>);
      setRoutine(updated);
      setEditing(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !routine) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{error ?? "Routine not found"}</p>
        <Button variant="ghost" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }

  const typeLabel = ROUTINE_TYPES.find((t) => t.value === routine.type)?.label ?? routine.type;
  const typeColor = ROUTINE_TYPE_COLORS[routine.type] ?? "bg-muted text-muted-foreground";

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left: Chat scoped to this routine */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatView
          persistedConvId={null}
          onConvIdChange={() => {}}
          systemContext={`The user is viewing and editing the routine "${routine.name}" (id: ${routine.id}, type: ${routine.type}). Help them modify this routine — update its schedule, config, description, etc. Use update_routine with routine_id="${routine.id}" to make changes. Current routine data:\n${JSON.stringify(routine, null, 2)}`}
          routineId={routine.id}
          hideConversations
          onToolEffect={(tool) => {
            if (tool === "update_routine" || tool === "create_routine" || tool === "delete_routine") {
              refresh();
            }
          }}
        />
      </div>

      {/* Resize handle */}
      <div
        className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/10 active:bg-primary/20 transition-colors flex items-center justify-center group"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
      </div>

      {/* Right: Routine details */}
      <div style={{ width: panelWidth }} className="shrink-0 border-l overflow-y-auto">
        <div className="px-5 py-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-base font-semibold bg-transparent border-b border-primary/50 focus:outline-none focus:border-primary w-full"
                />
              ) : (
                <h2 className="text-base font-semibold text-foreground">{routine.name}</h2>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", typeColor)}>
                  {typeLabel}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {routine.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {editing ? (
                <>
                  <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                    setEditing(false);
                    setName(routine.name);
                    setDescription(routine.description);
                    setScheduleStr(JSON.stringify(routine.schedule, null, 2));
                    setConfigStr(JSON.stringify(routine.config, null, 2));
                  }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
                  <Edit2 className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
            {editing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            ) : (
              <p className="text-sm text-foreground">
                {routine.description || <span className="text-muted-foreground/50 italic">No description</span>}
              </p>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Schedule</label>
            {editing ? (
              <textarea
                value={scheduleStr}
                onChange={(e) => setScheduleStr(e.target.value)}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            ) : (
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-sm">{formatSchedule(routine.schedule)}</p>
                <pre className="text-[11px] font-mono text-muted-foreground mt-1 whitespace-pre-wrap">
                  {JSON.stringify(routine.schedule, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Config */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Configuration</label>
            {editing ? (
              <textarea
                value={configStr}
                onChange={(e) => setConfigStr(e.target.value)}
                rows={8}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            ) : (
              <pre className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] font-mono text-foreground whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(routine.config, null, 2)}
              </pre>
            )}
          </div>

          {/* Meta */}
          <div className="border-t pt-3 space-y-1 text-[11px] text-muted-foreground/60">
            <p>Last triggered: {routine.lastTriggered ? relativeTime(routine.lastTriggered) : "Never"}</p>
            <p>Updated: {relativeTime(routine.updatedAt)}</p>
            <p>Created: {relativeTime(routine.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Channels View ────────────────────────────────────────────────────────────

function TelegramChannelCard({
  link,
  pending,
  onConnect,
  onCancel,
  onDisconnect,
}: {
  link: ChannelLink | undefined;
  pending: InitChannelLinkResponse | null;
  onConnect: () => void;
  onCancel: () => void;
  onDisconnect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const command = pending ? `/start ${pending.verifyCode}` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnect();
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-md bg-sky-500/10 text-sky-500">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Telegram</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chat with your AI assistant via Telegram
          </p>
        </div>
      </div>

      {link ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
            <span className="text-xs text-muted-foreground">{link.displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
          </Button>
        </div>
      ) : pending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Waiting for verification</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Send this message to{" "}
              <a
                href="https://t.me/1ttbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-500 hover:underline font-medium"
              >
                @1ttbot
              </a>{" "}
              on Telegram:
            </p>
            <div className="flex items-center gap-2 rounded-md bg-muted/60 border px-3 py-2 font-mono text-xs">
              <span className="flex-1 select-all">{command}</span>
              <button
                onClick={handleCopy}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy command"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-1.5">
              Code expires in 15 minutes
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          ) : (
            <MessageCircle className="h-3 w-3 mr-1.5" />
          )}
          Connect Telegram
        </Button>
      )}
    </div>
  );
}

function EmailChannelCard({
  link,
  pending,
  onConnect,
  onVerify,
  onCancel,
  onDisconnect,
}: {
  link: ChannelLink | undefined;
  pending: InitChannelLinkResponse | null;
  onConnect: (email: string) => void;
  onVerify: (code: string) => void;
  onCancel: () => void;
  onDisconnect: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    if (!email.trim()) return;
    setConnecting(true);
    try {
      await onConnect(email.trim());
    } finally {
      setConnecting(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      await onVerify(code.trim());
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-md bg-violet-500/10 text-violet-500">
          <Mail className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Email</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Forward emails to your AI assistant
          </p>
        </div>
      </div>

      {link ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
            <span className="text-xs text-muted-foreground">{link.displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
          </Button>
        </div>
      ) : pending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Verification sent</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Enter the verification code sent to{" "}
              <span className="font-medium text-foreground">{pending.displayName}</span>:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="Verification code"
                className="flex-1 h-7 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <Button
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={handleVerify}
                disabled={verifying || !code.trim()}
              >
                {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            placeholder="your@email.com"
            className="flex-1 h-7 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            onClick={handleConnect}
            disabled={connecting || !email.trim()}
          >
            {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChannelsView() {
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [telegramPending, setTelegramPending] = useState<InitChannelLinkResponse | null>(null);
  const [emailPending, setEmailPending] = useState<InitChannelLinkResponse | null>(null);

  const telegramLink = links.find((l) => l.channel === "telegram" && l.verified);
  const emailLink = links.find((l) => l.channel === "email" && l.verified);

  const loadLinks = useCallback(async () => {
    try {
      const data = await listChannelLinks();
      setLinks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleConnectTelegram = async () => {
    const res = await initChannelLink("telegram");
    setTelegramPending(res);
  };

  const handleCancelTelegram = () => setTelegramPending(null);

  const handleDisconnectTelegram = async () => {
    if (!telegramLink) return;
    await deleteChannelLink(telegramLink.id);
    await loadLinks();
  };

  const handleConnectEmail = async (emailAddr: string) => {
    const res = await initChannelLink("email", emailAddr);
    setEmailPending(res);
  };

  const handleVerifyEmail = async (code: string) => {
    if (!emailPending) return;
    await verifyChannelLink(emailPending.id, code);
    setEmailPending(null);
    await loadLinks();
  };

  const handleCancelEmail = () => setEmailPending(null);

  const handleDisconnectEmail = async () => {
    if (!emailLink) return;
    await deleteChannelLink(emailLink.id);
    await loadLinks();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl px-6 py-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold">Channels</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external messaging channels to chat with your AI assistant
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-lg border p-5 space-y-3 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 rounded bg-muted" />
                    <div className="h-2.5 w-40 rounded bg-muted" />
                  </div>
                </div>
                <div className="h-7 w-36 rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <TelegramChannelCard
              link={telegramLink}
              pending={telegramPending}
              onConnect={handleConnectTelegram}
              onCancel={handleCancelTelegram}
              onDisconnect={handleDisconnectTelegram}
            />
            <EmailChannelCard
              link={emailLink}
              pending={emailPending}
              onConnect={handleConnectEmail}
              onVerify={handleVerifyEmail}
              onCancel={handleCancelEmail}
              onDisconnect={handleDisconnectEmail}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function formatEventTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDayHeader(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const d = new Date(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
  d.setHours(0, 0, 0, 0);

  const dayLabel = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  if (d.getTime() === today.getTime()) return `Today, ${dayLabel}`;
  if (d.getTime() === tomorrow.getTime()) return `Tomorrow, ${dayLabel}`;
  return dayLabel;
}

function groupEventsByDay(events: GCalEvent[]): { dateKey: string; events: GCalEvent[] }[] {
  const map = new Map<string, GCalEvent[]>();
  for (const ev of events) {
    const key = ev.allDay ? ev.start : ev.start.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, evs]) => ({ dateKey, events: evs }));
}

// ─── Calendar Grid Helpers ─────────────────────────────────────────────────────

const CAL_START_HOUR = 6;
const CAL_END_HOUR = 24; // midnight
const TOTAL_HOURS = CAL_END_HOUR - CAL_START_HOUR;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isTodayDate(d: Date): boolean {
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function getEventFraction(isoString: string): number {
  const d = new Date(isoString);
  const hours = d.getHours() + d.getMinutes() / 60;
  return (hours - CAL_START_HOUR) / TOTAL_HOURS;
}

function getDurationFraction(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(durationHours / TOTAL_HOURS, 30 / (60 * TOTAL_HOURS));
}

function getCurrentTimeFraction(): number {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  return (hours - CAL_START_HOUR) / TOTAL_HOURS;
}

function getEventsForDate(events: GCalEvent[], dateKey: string): GCalEvent[] {
  return events.filter((ev) => {
    if (ev.allDay) return ev.start === dateKey || ev.start.slice(0, 10) === dateKey;
    return ev.start.slice(0, 10) === dateKey;
  });
}

// ─── Calendar Sub-components ───────────────────────────────────────────────────

type CalView = "day" | "week" | "2week";

function CalendarHeader({
  view,
  setView,
  currentDate,
  onPrev,
  onNext,
  onToday,
  agentOpen,
  onToggleAgent,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  agentOpen?: boolean;
  onToggleAgent?: () => void;
}) {
  const label = (() => {
    if (view === "day") {
      return formatDayHeader(toDateKey(currentDate));
    }
    const end = new Date(currentDate);
    end.setDate(end.getDate() + (view === "week" ? 6 : 13));
    const startFmt = currentDate.toLocaleDateString([], { month: "short", day: "numeric" });
    const endFmt = end.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${startFmt} – ${endFmt}`;
  })();

  return (
    <div data-cal-header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 shrink-0 flex-wrap">
      {/* Nav */}
      <button
        onClick={onPrev}
        className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Previous"
      >
        <ChevronDown className="h-3.5 w-3.5 rotate-90" />
      </button>
      <span className="text-sm font-semibold min-w-[140px] text-center select-none">{label}</span>
      <button
        onClick={onNext}
        className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Next"
      >
        <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
      </button>

      <button
        onClick={onToday}
        className="text-xs text-primary hover:underline ml-1 transition-colors"
      >
        Today
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View segmented control */}
      <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 gap-0.5">
        {(["day", "week", "2week"] as CalView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "text-xs px-3 py-1 font-medium rounded-md transition-all",
              view === v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "day" ? "Day" : v === "week" ? "Week" : "2Wk"}
          </button>
        ))}
      </div>



      {/* AI Agent toggle */}
      {onToggleAgent && (
        <button
          onClick={onToggleAgent}
          className={cn(
            "ml-auto flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors",
            agentOpen
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60"
          )}
          title={agentOpen ? "Close AI assistant" : "Open AI assistant"}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI</span>
        </button>
      )}
    </div>
  );
}

function TimeGutter({ hourHeight }: { hourHeight: number }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => CAL_START_HOUR + i);
  return (
    <div className="shrink-0 w-14 relative" style={{ height: TOTAL_HOURS * hourHeight }}>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute right-2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-muted-foreground/50 leading-none select-none text-right"
          style={{ top: (h - CAL_START_HOUR) * hourHeight }}
        >
          {String(h % 24).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}

function HourLines({ hourHeight }: { hourHeight: number }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i);
  return (
    <>
      {hours.map((i) => (
        <div key={i}>
          {/* Main hour line */}
          <div
            className="absolute left-0 right-0 border-t border-border/20 pointer-events-none"
            style={{ top: i * hourHeight }}
          />
          {/* Half-hour line — dashed, even more subtle */}
          {i < TOTAL_HOURS && (
            <div
              className="absolute left-0 right-0 border-t border-border/10 border-dashed pointer-events-none"
              style={{ top: i * hourHeight + hourHeight / 2 }}
            />
          )}
        </div>
      ))}
    </>
  );
}

function CurrentTimeBar({ hourHeight }: { hourHeight: number }) {
  const fraction = getCurrentTimeFraction();
  if (fraction < 0 || fraction > 1) return null;
  const top = fraction * TOTAL_HOURS * hourHeight;
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ top }}
    >
      <div className="relative flex items-center">
        <div className="h-[6px] w-[6px] rounded-full bg-red-500/80 shrink-0 -ml-[3px]" />
        <div className="flex-1 h-px bg-red-500/80" />
      </div>
    </div>
  );
}

// ── Overlap layout ───────────────────────────────────────────────────────────

interface LayoutedEvent {
  ev: GCalEvent;
  col: number;    // column index within the overlap group
  totalCols: number; // total columns in the overlap group
}

/** Assign column positions to overlapping events so they sit side-by-side. */
function layoutEvents(events: GCalEvent[]): LayoutedEvent[] {
  if (events.length === 0) return [];

  // Sort by start time, then by duration (longer first)
  const sorted = [...events].sort((a, b) => {
    const diff = new Date(a.start).getTime() - new Date(b.start).getTime();
    if (diff !== 0) return diff;
    return (new Date(b.end).getTime() - new Date(b.start).getTime()) -
           (new Date(a.end).getTime() - new Date(a.start).getTime());
  });

  const result: LayoutedEvent[] = [];
  // columns[i] = end time of the event currently in column i
  const columns: number[] = [];

  for (const ev of sorted) {
    const start = new Date(ev.start).getTime();
    const end = new Date(ev.end).getTime();

    // Find the first column where this event fits (doesn't overlap)
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= start) {
        columns[c] = end;
        result.push({ ev, col: c, totalCols: 0 }); // totalCols computed later
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push(end);
      result.push({ ev, col: columns.length - 1, totalCols: 0 });
    }
  }

  // Compute totalCols: for each event, find how many columns overlap with it
  for (const item of result) {
    const s = new Date(item.ev.start).getTime();
    const e = new Date(item.ev.end).getTime();
    let maxCol = item.col;
    for (const other of result) {
      const os = new Date(other.ev.start).getTime();
      const oe = new Date(other.ev.end).getTime();
      if (os < e && oe > s) { // overlaps
        maxCol = Math.max(maxCol, other.col);
      }
    }
    item.totalCols = maxCol + 1;
  }

  return result;
}

// Google Calendar color IDs → Tailwind-friendly HSL-ish colors
// These approximate the actual Google Calendar event colors.
const GCAL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "1":  { bg: "bg-[#7986cb]/25", border: "border-[#7986cb]", text: "text-[#7986cb]" },  // lavender
  "2":  { bg: "bg-[#33b679]/25", border: "border-[#33b679]", text: "text-[#33b679]" },  // sage
  "3":  { bg: "bg-[#8e24aa]/25", border: "border-[#8e24aa]", text: "text-[#8e24aa]" },  // grape
  "4":  { bg: "bg-[#e67c73]/25", border: "border-[#e67c73]", text: "text-[#e67c73]" },  // flamingo
  "5":  { bg: "bg-[#f6bf26]/25", border: "border-[#f6bf26]", text: "text-[#f6bf26]" },  // banana
  "6":  { bg: "bg-[#f4511e]/25", border: "border-[#f4511e]", text: "text-[#f4511e]" },  // tangerine
  "7":  { bg: "bg-[#039be5]/25", border: "border-[#039be5]", text: "text-[#039be5]" },  // peacock
  "8":  { bg: "bg-[#616161]/25", border: "border-[#616161]", text: "text-[#616161]" },  // graphite
  "9":  { bg: "bg-[#3f51b5]/25", border: "border-[#3f51b5]", text: "text-[#3f51b5]" },  // blueberry
  "10": { bg: "bg-[#0b8043]/25", border: "border-[#0b8043]", text: "text-[#0b8043]" },  // basil
  "11": { bg: "bg-[#d50000]/25", border: "border-[#d50000]", text: "text-[#d50000]" },  // tomato
};

// Fallback palette for events without a Google colorId — deterministic based on title hash
const FALLBACK_COLORS = [
  { bg: "bg-blue-500/20",    border: "border-blue-500",    text: "text-blue-500" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-500" },
  { bg: "bg-violet-500/20",  border: "border-violet-500",  text: "text-violet-500" },
  { bg: "bg-amber-500/20",   border: "border-amber-500",   text: "text-amber-500" },
  { bg: "bg-rose-500/20",    border: "border-rose-500",    text: "text-rose-500" },
  { bg: "bg-cyan-500/20",    border: "border-cyan-500",    text: "text-cyan-500" },
  { bg: "bg-pink-500/20",    border: "border-pink-500",    text: "text-pink-500" },
  { bg: "bg-teal-500/20",    border: "border-teal-500",    text: "text-teal-500" },
];

function getEventColor(ev: GCalEvent) {
  if (ev.colorId && GCAL_COLORS[ev.colorId]) return GCAL_COLORS[ev.colorId];
  // Deterministic hash from summary
  let hash = 0;
  const s = ev.summary || ev.id;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function EventSkeletons({ hourHeight, count = 3, compact, seed = 0 }: { hourHeight: number; count?: number; compact?: boolean; seed?: number }) {
  // Deterministic pseudo-random based on seed (e.g. day index)
  const skeletons = useMemo(() => {
    let h = seed;
    const next = () => { h = ((h * 1103515245 + 12345) & 0x7fffffff); return h; };
    const items: { startHour: number; duration: number }[] = [];
    for (let i = 0; i < (count ?? 3); i++) {
      const startHour = CAL_START_HOUR + 1 + (next() % (TOTAL_HOURS - 4));
      const duration = 0.5 + (next() % 3) * 0.5;
      items.push({ startHour, duration });
    }
    // Sort and space them out so they don't overlap
    items.sort((a, b) => a.startHour - b.startHour);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      if (items[i].startHour < prev.startHour + prev.duration + 0.5) {
        items[i].startHour = prev.startHour + prev.duration + 0.5;
      }
    }
    return items.filter((s) => s.startHour + s.duration <= CAL_END_HOUR);
  }, [count, seed]);

  return (
    <>
      {skeletons.map((s, i) => {
        const top = (s.startHour - CAL_START_HOUR) * hourHeight;
        const height = s.duration * hourHeight;
        return (
          <div
            key={i}
            className="absolute left-1 right-1 rounded-md bg-muted/40 animate-pulse border-l-[3px] border-muted-foreground/20 shadow-sm"
            style={{ top, height: Math.max(height, 20) }}
          >
            <div className="px-1.5 py-1 space-y-1">
              <div className={cn("rounded bg-muted-foreground/10", compact ? "h-1.5 w-10" : "h-2.5 w-20")} />
              {!compact && height > 30 && (
                <div className="h-2 w-14 rounded bg-muted-foreground/10" />
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function EventBlock({
  ev,
  hourHeight,
  compact,
  col,
  totalCols,
  onEventClick,
  selectedEventIds,
}: {
  ev: GCalEvent;
  hourHeight: number;
  compact: boolean;
  col?: number;
  totalCols?: number;
  onEventClick?: (ev: GCalEvent) => void;
  selectedEventIds?: Set<string>;
}) {
  const topFraction = getEventFraction(ev.start);
  const heightFraction = getDurationFraction(ev.start, ev.end);
  const totalPx = TOTAL_HOURS * hourHeight;
  const top = topFraction * totalPx;
  const height = heightFraction * totalPx;

  // Overlap positioning
  const c = col ?? 0;
  const tc = totalCols ?? 1;
  const widthPct = `${(1 / tc) * 100 - 1}%`;
  const leftPct = `${(c / tc) * 100}%`;

  const color = getEventColor(ev);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onEventClick) {
          onEventClick(ev);
        } else {
          window.open(ev.htmlLink, "_blank");
        }
      }}
      title={`${ev.summary || "(No title)"}\n${formatEventTime(ev.start)} – ${formatEventTime(ev.end)}`}
      className={cn(
        "absolute rounded-md overflow-hidden border-l-[3px] transition-all z-10 cursor-pointer group shadow-sm hover:shadow-md hover:brightness-105",
        color.bg,
        color.border,
        selectedEventIds?.has(ev.id) && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
      style={{ top, height: Math.max(height, 20), left: leftPct, width: widthPct }}
    >
      <div className="px-1.5 py-0.5 overflow-hidden h-full">
        <p className={cn("font-semibold leading-tight truncate", color.text, compact ? "text-[9px]" : "text-[11px]")}>
          {ev.summary || "(No title)"}
        </p>
        {!compact && height > 32 && (
          <p className={cn("text-[9px] leading-tight truncate font-normal opacity-60", color.text)}>
            {formatEventTime(ev.start)} – {formatEventTime(ev.end)}
          </p>
        )}
        {ev.routineName && height > 44 && (
          <p className={cn("text-[8px] leading-tight truncate opacity-50 mt-0.5", color.text)}>
            {ev.routineName}
          </p>
        )}
      </div>
    </div>
  );
}

function AllDayRow({
  events,
  compact,
}: {
  events: GCalEvent[];
  compact: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border/30 bg-muted/30 sticky top-0 z-20">
      {events.map((ev) => {
        const color = getEventColor(ev);
        return (
          <a
            key={ev.id}
            href={ev.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "rounded-md px-2 py-0.5 font-medium truncate max-w-full transition-all hover:brightness-105",
              "text-[10px]",
              color.bg,
              color.text
            )}
            title={ev.summary || "(No title)"}
          >
            {ev.summary || "(No title)"}
          </a>
        );
      })}
    </div>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────────────

function DayView({ date, events, loading, onEventClick, selectedEventIds }: { date: Date; events: GCalEvent[]; loading?: boolean; onEventClick?: (ev: GCalEvent) => void; selectedEventIds?: Set<string> }) {
  const hourHeight = 60;
  const dateKey = toDateKey(date);
  const dayEvents = getEventsForDate(events, dateKey).filter((e) => !e.allDay);
  const allDayEvents = getEventsForDate(events, dateKey).filter((e) => e.allDay);
  const isToday = isTodayDate(date);

  return (
    <div className="flex-1 overflow-y-auto">
      <AllDayRow events={allDayEvents} compact={false} />
      <div className="flex">
        <TimeGutter hourHeight={hourHeight} />
        <div
          className={cn("flex-1 relative", isToday && "bg-primary/[0.02]")}
          style={{ height: TOTAL_HOURS * hourHeight }}
        >
          <HourLines hourHeight={hourHeight} />
          {isToday && <CurrentTimeBar hourHeight={hourHeight} />}
          {loading ? (
            <EventSkeletons hourHeight={hourHeight} count={4} seed={date.getDate()} />
          ) : (
            layoutEvents(dayEvents).map(({ ev, col, totalCols }) => (
              <EventBlock key={ev.id} ev={ev} hourHeight={hourHeight} compact={false} col={col} totalCols={totalCols} onEventClick={onEventClick} selectedEventIds={selectedEventIds} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Week / 2-Week View ────────────────────────────────────────────────────────

function MultiDayView({
  startDate,
  days,
  events,
  loading,
  onEventClick,
  selectedEventIds,
}: {
  startDate: Date;
  days: number;
  events: GCalEvent[];
  loading?: boolean;
  onEventClick?: (ev: GCalEvent) => void;
  selectedEventIds?: Set<string>;
}) {
  const compact = days > 7;
  const hourHeight = compact ? 36 : 48;

  const columns: Date[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="flex border-b border-border/40 bg-background sticky top-0 z-30">
        <div className="w-14 shrink-0" />
        {columns.map((d) => {
          const isToday = isTodayDate(d);
          return (
            <div
              key={toDateKey(d)}
              className={cn(
                "flex-1 min-w-0 text-center py-2 border-l border-border/15",
                isToday && "bg-primary/[0.02]"
              )}
            >
              <div className={cn(
                "uppercase tracking-wide leading-none",
                compact ? "text-[8px]" : "text-[10px]",
                "text-muted-foreground/60"
              )}>
                {d.toLocaleDateString([], { weekday: "short" })}
              </div>
              {compact ? (
                <div className={cn(
                  "leading-none mt-0.5 font-semibold",
                  "text-[9px]",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}>
                  {d.getDate()}
                </div>
              ) : (
                <div className={cn("leading-none mt-1 flex items-center justify-center")}>
                  {isToday ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      {d.getDate()}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-foreground/80">
                      {d.getDate()}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All-day rows */}
      {columns.some((d) => getEventsForDate(events, toDateKey(d)).some((e) => e.allDay)) && (
        <div className="flex border-b border-border/30">
          <div className="w-14 shrink-0 flex items-center justify-end pr-2">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/40">all day</span>
          </div>
          {columns.map((d) => {
            const allDay = getEventsForDate(events, toDateKey(d)).filter((e) => e.allDay);
            return (
              <div key={toDateKey(d)} className="flex-1 min-w-0 border-l border-border/15">
                <AllDayRow events={allDay} compact={compact} />
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="flex relative">
        <TimeGutter hourHeight={hourHeight} />
        {columns.map((d) => {
          const dateKey = toDateKey(d);
          const isToday = isTodayDate(d);
          const dayEvents = loading ? [] : getEventsForDate(events, dateKey).filter((e) => !e.allDay);
          return (
            <div
              key={dateKey}
              className={cn("flex-1 min-w-0 relative border-l border-border/15", isToday && "bg-primary/[0.02]")}
              style={{ height: TOTAL_HOURS * hourHeight }}
            >
              <HourLines hourHeight={hourHeight} />
              {isToday && <CurrentTimeBar hourHeight={hourHeight} />}
              {loading ? (
                <EventSkeletons hourHeight={hourHeight} count={2 + (d.getDate() % 3)} compact={compact} seed={d.getDate() * 31 + d.getMonth()} />
              ) : (
                layoutEvents(dayEvents).map(({ ev, col, totalCols }) => (
                  <EventBlock key={ev.id} ev={ev} hourHeight={hourHeight} compact={compact} col={col} totalCols={totalCols} onEventClick={onEventClick} selectedEventIds={selectedEventIds} />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView() {
  const [status, setStatus] = useState<GCalStatus | null>(null);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalView>("day");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentWidth, setAgentWidth] = useState(380);
  const [selectedEvents, setSelectedEvents] = useState<GCalEvent[]>([]);
  const [calendarConvId, setCalendarConvId] = useState<string | null>(null);
  const calendarConvLoaded = useRef(false);
  const agentDragging = useRef(false);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const daysToLoad = view === "day" ? 1 : view === "week" ? 7 : 14;

  const loadEvents = useCallback(async (connected: boolean, startDate: Date, numDays: number) => {
    if (!connected) return;
    setEventsLoading(true);
    try {
      const fromDate = new Date(startDate);
      const toDate = new Date(startDate);
      toDate.setDate(toDate.getDate() + numDays);
      const from = fromDate.toISOString().slice(0, 10);
      const to = toDate.toISOString().slice(0, 10);
      const evs = await listGCalEvents(from, to);
      setEvents(evs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // Load the calendar-specific conversation (linked via routine_id="__calendar__")
  useEffect(() => {
    if (calendarConvLoaded.current) return;
    calendarConvLoaded.current = true;
    getRoutineConversationId("__calendar__")
      .then((id) => { if (id) setCalendarConvId(id); })
      .catch(() => {});
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await getGCalStatus();
      setStatus(s);
      if (s.connected) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await loadEvents(true, today, 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar status");
    } finally {
      setLoading(false);
    }
  }, [loadEvents]);

  // Handle OAuth callback code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setConnecting(true);
      exchangeGCalCode(code)
        .then(() => {
          window.history.replaceState(null, "", window.location.pathname);
          return loadStatus();
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "OAuth exchange failed");
        })
        .finally(() => setConnecting(false));
    } else {
      loadStatus();
    }
  }, [loadStatus]);

  // Reload when view/date changes
  useEffect(() => {
    if (status?.connected) {
      loadEvents(true, currentDate, daysToLoad);
    }
  }, [view, currentDate, status?.connected, daysToLoad, loadEvents]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getGCalAuthUrl();
      window.open(url, "_self");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get auth URL");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectGCal();
      setStatus({ connected: false });
      setEvents([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handlePrev = () => {
    setCurrentDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() - (view === "day" ? 1 : view === "week" ? 7 : 14));
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + (view === "day" ? 1 : view === "week" ? 7 : 14));
      return next;
    });
  };

  const handleToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCurrentDate(d);
  };

  const handleEventClick = (ev: GCalEvent) => {
    setSelectedEvents((prev) => {
      const exists = prev.find((e) => e.id === ev.id);
      if (exists) return prev.filter((e) => e.id !== ev.id);
      return [...prev, ev];
    });
    setAgentOpen(true);
  };

  const calendarSystemContext = useMemo(() => {
    const eventsContext = events.slice(0, 20).map((e) =>
      `- ${e.summary || "(No title)"}: ${new Date(e.start).toLocaleString()} – ${new Date(e.end).toLocaleString()}${e.allDay ? " (all day)" : ""}`
    ).join("\n");
    const selectedContext = selectedEvents.length > 0
      ? `\n\nThe user has selected ${selectedEvents.length} event(s):\n` + selectedEvents.map((ev) =>
          `- ID: ${ev.id} | ${ev.summary || "(No title)"} | ${new Date(ev.start).toLocaleString()} – ${new Date(ev.end).toLocaleString()}${ev.location ? ` | Location: ${ev.location}` : ""}`
        ).join("\n") + "\n\nHelp them with these events — they may want to reschedule, edit, compare, or delete them."
      : "";
    return `You are helping the user manage their Google Calendar. You can create, edit, and view calendar events using the create_calendar_event and get_calendar_events tools.\n\nUpcoming events:\n${eventsContext}${selectedContext}`;
  }, [events, selectedEvents]);

  if (loading || connecting) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not connected state
  if (!status?.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="rounded-full bg-muted p-4">
          <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Connect Google Calendar</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            View and manage your events directly from the Life Tool
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive max-w-sm">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <Button size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Connect Google Calendar
        </Button>
      </div>
    );
  }

  // Connected — show calendar grid + optional agent panel
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-destructive/20 bg-destructive/5 text-xs text-destructive shrink-0">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      <CalendarHeader
        view={view}
        setView={setView}
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        agentOpen={agentOpen}
        onToggleAgent={() => { setAgentOpen((v) => !v); if (!agentOpen) setSelectedEvents([]); }}
      />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {view === "day" ? (
            <DayView date={currentDate} events={events} loading={eventsLoading} onEventClick={handleEventClick} selectedEventIds={new Set(selectedEvents.map((e) => e.id))} />
          ) : (
            <MultiDayView
              startDate={currentDate}
              days={view === "week" ? 7 : 14}
              events={events}
              loading={eventsLoading}
              onEventClick={handleEventClick}
              selectedEventIds={new Set(selectedEvents.map((e) => e.id))}
            />
          )}
        </div>

        {/* AI Agent Panel */}
        {agentOpen && (
          <div className="shrink-0 border-l flex overflow-hidden" style={{ width: agentWidth }}>
            {/* Resize handle */}
            <div
              className="w-1.5 shrink-0 cursor-col-resize hover:bg-primary/10 active:bg-primary/20 transition-colors flex items-center justify-center group"
              onMouseDown={(e) => {
                e.preventDefault();
                agentDragging.current = true;
                const startX = e.clientX;
                const startW = agentWidth;
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
                const onMove = (ev: MouseEvent) => {
                  if (!agentDragging.current) return;
                  const delta = startX - ev.clientX;
                  setAgentWidth(Math.max(300, Math.min(800, startW + delta)));
                };
                const onUp = () => {
                  agentDragging.current = false;
                  document.body.style.cursor = "";
                  document.body.style.userSelect = "";
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/50" />
            </div>
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <ChatView
              persistedConvId={calendarConvId}
              onConvIdChange={(id) => { if (id) setCalendarConvId(id); }}
              systemContext={calendarSystemContext}
              routineId="__calendar__"
              hideConversations
              onToolEffect={(tool) => {
                if (tool === "create_calendar_event" || tool === "get_calendar_events") {
                  loadEvents(true, currentDate, daysToLoad);
                }
              }}
              slotAboveInput={selectedEvents.length > 0 ? (
                <div className="border-t bg-muted/20 shrink-0 px-2 py-1.5 flex flex-wrap gap-1">
                  {selectedEvents.map((ev) => {
                    const color = getEventColor(ev);
                    return (
                      <div
                        key={ev.id}
                        className={cn("inline-flex items-center gap-1 rounded-md border-l-2 px-2 py-0.5 text-[11px]", color.bg, color.border)}
                      >
                        <span className={cn("font-medium truncate max-w-[120px]", color.text)}>
                          {ev.summary || "(No title)"}
                        </span>
                        <button
                          onClick={() => setSelectedEvents((prev) => prev.filter((e) => e.id !== ev.id))}
                          className="shrink-0 p-0.5 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                  {selectedEvents.length > 1 && (
                    <button
                      onClick={() => setSelectedEvents([])}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              ) : undefined}
            />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Placeholder View ─────────────────────────────────────────────────────────

function PlaceholderView({
  tab,
}: {
  tab: LifeTabType;
}) {
  const config: Record<
    LifeTabType,
    { icon: React.ReactNode; title: string; description: string }
  > = {
    today: {
      icon: <Sun className="h-10 w-10 text-muted-foreground/30" />,
      title: "Today's Overview",
      description:
        "Your daily summary — tasks, routines, and schedule at a glance.",
    },
    actionables: {
      icon: <CheckSquare className="h-10 w-10 text-muted-foreground/30" />,
      title: "Actionables",
      description:
        "Track tasks and action items captured from your conversations.",
    },
    routines: {
      icon: <Repeat className="h-10 w-10 text-muted-foreground/30" />,
      title: "Routines",
      description:
        "Build and track recurring habits and daily routines.",
    },
    calendar: {
      icon: <CalendarDays className="h-10 w-10 text-muted-foreground/30" />,
      title: "Calendar",
      description:
        "Connect your calendar to sync events and schedules with your AI.",
    },
    channels: {
      icon: <Radio className="h-10 w-10 text-muted-foreground/30" />,
      title: "Channels",
      description:
        "Connect messaging channels like WhatsApp or Telegram for notifications.",
    },
    "routine-detail": {
      icon: <Repeat className="h-10 w-10 text-muted-foreground/30" />,
      title: "Routine",
      description: "",
    },
    // These tabs are implemented and won't reach PlaceholderView
    chat: {
      icon: <MessageSquare className="h-10 w-10 text-muted-foreground/30" />,
      title: "Chat",
      description: "",
    },
    memories: {
      icon: <Lightbulb className="h-10 w-10 text-muted-foreground/30" />,
      title: "Memories",
      description: "",
    },
    tasks: {
      icon: <ListTodo className="h-10 w-10 text-muted-foreground/30" />,
      title: "Tasks",
      description: "",
    },
    settings: {
      icon: <Settings className="h-10 w-10 text-muted-foreground/30" />,
      title: "Settings",
      description: "",
    },
  };

  const { icon, title, description } = config[tab];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      {icon}
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {description}
        </p>
      </div>
      <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Coming soon
      </span>
    </div>
  );
}

// ─── Tasks View ──────────────────────────────────────────────────────────────

function TasksView() {
  const [lists, setLists] = useState<GTaskList[]>([]);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [listSelectorOpen, setListSelectorOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  const loadLists = useCallback(async () => {
    try {
      const ls = await listGTaskLists();
      setLists(ls);
      if (ls.length > 0 && !activeList) setActiveList(ls[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task lists.");
    } finally {
      setLoading(false);
    }
  }, [activeList]);

  const loadTasks = useCallback(async (listId: string) => {
    setTasksLoading(true);
    setError(null);
    try {
      const ts = await listGTasks(listId, showCompleted);
      setTasks(ts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, [showCompleted]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { if (activeList) loadTasks(activeList); }, [activeList, loadTasks]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !activeList) return;
    setCreating(true);
    try {
      await createGTask(activeList, newTaskTitle.trim());
      setNewTaskTitle("");
      await loadTasks(activeList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleComplete = async (task: GTask) => {
    if (!activeList) return;
    setTogglingIds((prev) => new Set(prev).add(task.id));
    try {
      if (task.status === "completed") {
        await updateGTask(activeList, task.id, { status: "needsAction" });
      } else {
        await completeGTask(activeList, task.id);
      }
      await loadTasks(activeList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(task.id); return n; });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeList) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteGTask(activeList, taskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete task");
      if (activeList) loadTasks(activeList);
    }
  };

  const handleSaveEdit = async () => {
    if (!activeList || !editingId) return;
    try {
      await updateGTask(activeList, editingId, { title: editTitle, notes: editNotes });
      setEditingId(null);
      await loadTasks(activeList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const created = await createGTaskList(newListName.trim());
      setNewListName("");
      setLists((prev) => [...prev, created]);
      setActiveList(created.id);
      setListSelectorOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create list");
    } finally {
      setCreatingList(false);
    }
  };

  const startEditing = (task: GTask) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditNotes(task.notes || "");
  };

  const hasSubtasks = (task: GTask) => task.parent != null && task.parent !== "";
  const isOverdue = (task: GTask) => {
    if (!task.due) return false;
    const d = new Date(task.due); const today = new Date(); today.setHours(0,0,0,0);
    return d < today;
  };
  const isDueToday = (task: GTask) => {
    if (!task.due) return false;
    const d = new Date(task.due); const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (lists.length === 0 && !error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <ListTodo className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-semibold">Google Tasks</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Connect your Google account in Settings to sync your tasks.
        </p>
      </div>
    );
  }

  const activeListTitle = lists.find((l) => l.id === activeList)?.title ?? "Tasks";
  const pendingTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setListSelectorOpen(!listSelectorOpen)}
              className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors"
            >
              {activeListTitle}
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", listSelectorOpen && "rotate-180")} />
            </button>
            {listSelectorOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => { setActiveList(list.id); setListSelectorOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                        activeList === list.id && "bg-muted font-medium"
                      )}
                    >
                      {list.title}
                    </button>
                  ))}
                </div>
                <div className="border-t px-2 py-2">
                  <form onSubmit={(e) => { e.preventDefault(); handleCreateList(); }} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="New list..."
                      className="flex-1 text-xs bg-transparent border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    />
                    <button type="submit" disabled={creatingList || !newListName.trim()} className="p-1 text-primary disabled:opacity-50">
                      {creatingList ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {pendingTasks.length} task{pendingTasks.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={cn("text-xs px-2 py-1 rounded-md border transition-colors", showCompleted ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {showCompleted ? "Hide done" : "Show done"}
          </button>
          <button onClick={() => activeList && loadTasks(activeList)} disabled={tasksLoading} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Refresh">
            <RefreshCw className={cn("h-3.5 w-3.5", tasksLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </div>
      )}

      <div className="shrink-0 px-4 py-3 border-b">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateTask(); }} className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Add a task..." className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/50" />
          {newTaskTitle.trim() && (
            <button type="submit" disabled={creating} className="text-xs text-primary font-medium hover:underline disabled:opacity-50">
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </button>
          )}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasksLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : pendingTasks.length === 0 && !showCompleted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckSquare className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">All done!</p>
          </div>
        ) : (
          <div>
            {pendingTasks.map((task) => {
              const toggling = togglingIds.has(task.id);
              return (
                <div key={task.id} className={cn("group flex items-start gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-muted/20 transition-all", toggling && "opacity-50")}>
                  <button onClick={() => handleToggleComplete(task)} disabled={toggling} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
                    {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  </button>
                  {editingId === task.id ? (
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                      <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes..." rows={2} className="w-full text-xs bg-transparent border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50" />
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="text-xs text-primary font-medium hover:underline">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEditing(task)}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground">{task.title}</p>
                        {hasSubtasks(task) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 font-medium">subtask</span>}
                      </div>
                      {task.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.notes}</p>}
                      {task.due && (
                        <p className={cn("text-[10px] mt-0.5 font-mono", isOverdue(task) ? "text-red-500" : isDueToday(task) ? "text-amber-500" : "text-muted-foreground")}>
                          {isOverdue(task) ? "Overdue: " : isDueToday(task) ? "Due today" : ""}{!isDueToday(task) && new Date(task.due).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                  <button onClick={() => handleDeleteTask(task.id)} className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {showCompleted && completedTasks.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/20">Completed ({completedTasks.length})</div>
                {completedTasks.map((task) => {
                  const toggling = togglingIds.has(task.id);
                  return (
                    <div key={task.id} className={cn("group flex items-start gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-muted/20 transition-all", toggling && "opacity-50")}>
                      <button onClick={() => handleToggleComplete(task)} disabled={toggling} className="mt-0.5 shrink-0 text-primary transition-colors disabled:opacity-50">
                        {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare2 className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0"><p className="text-sm text-muted-foreground line-through">{task.title}</p></div>
                      <button onClick={() => handleDeleteTask(task.id)} className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Onboarding View ─────────────────────────────────────────────────────────

const ONBOARDING_SYSTEM_CONTEXT = `This is an onboarding conversation. The user just opened the Life Tool for the first time.

Your goal is to:
1. Welcome them warmly and briefly explain what you can do (manage tasks, routines, calendar, send reminders).
2. Help them set up their basics: learn about their daily schedule, habits they want to build, goals they have.
3. Create routines, memories, and tasks based on what they share.
4. Be conversational and encouraging — this is their first impression.

Keep it natural. Don't overwhelm with a checklist. Start with one question and build from there.
Do NOT mention connecting calendar or channels — setup links are shown separately in the UI.`;

function OnboardingView({
  onComplete,
  onOpenTab,
}: {
  onComplete: () => void;
  onOpenTab: (type: LifeTabType) => void;
}) {
  const [step, setStep] = useState<"welcome" | "chat">("welcome");

  if (step === "welcome") {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-8 text-center">
          <div className="space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to Life Tool</h1>
            <p className="text-muted-foreground leading-relaxed">
              Your personal AI agent for managing daily routines, tasks, and habits. Let me help you get set up.
            </p>
          </div>

          {/* Setup cards */}
          <div className="grid gap-3 text-left">
            <button
              onClick={() => onOpenTab("calendar")}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Connect Google Calendar</p>
                <p className="text-xs text-muted-foreground">Sync your schedule so the agent knows when you're busy.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
            </button>

            <button
              onClick={() => onOpenTab("channels")}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                <Radio className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Connect a channel</p>
                <p className="text-xs text-muted-foreground">Get reminders via Telegram, WhatsApp, or email.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => setStep("chat")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Start chatting with your agent
            </button>
            <button
              onClick={onComplete}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              Skip setup — I'll explore on my own
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Getting to know you</span>
        </div>
        <button
          onClick={onComplete}
          className="text-xs text-primary font-medium hover:underline"
        >
          Finish setup
        </button>
      </div>

      {/* Chat */}
      <ChatView
        persistedConvId={null}
        onConvIdChange={() => {}}
        systemContext={ONBOARDING_SYSTEM_CONTEXT}
        autoApprove={false}
        initialAssistantMessage={`Hey! I'm your AI life assistant. I'll help you manage your daily routines, tasks, and habits — all through conversation.

To get the most out of this, I'd love to learn a bit about you:

- **What does a typical day look like for you?** (wake time, work hours, wind-down)
- **Any habits you want to build or maintain?** (exercise, reading, meditation, etc.)
- **What's on your plate right now?** (tasks, goals, things you keep forgetting)

Just start telling me about yourself and I'll set things up as we go. Everything I create will need your approval first, so don't worry — nothing happens without your say-so.`}
      />
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

const START_DAY_OPTIONS: { value: StartDay; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 0, label: "Sunday" },
  { value: 6, label: "Saturday" },
];

const COMMON_TIMEZONES = Intl.supportedValuesOf?.("timeZone") ?? [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

function SettingsView({ settings, onUpdate }: { settings: LifeSettings; onUpdate: (s: LifeSettings) => void }) {
  const [calStatus, setCalStatus] = useState<GCalStatus | null>(null);
  const [calLoading, setCalLoading] = useState(true);
  const [calConnecting, setCalConnecting] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

  const loadCalStatus = useCallback(async () => {
    try {
      const s = await getGCalStatus();
      setCalStatus(s);
    } catch {
      setCalStatus({ connected: false });
    } finally {
      setCalLoading(false);
    }
  }, []);

  useEffect(() => { loadCalStatus(); }, [loadCalStatus]);

  const handleCalConnect = async () => {
    setCalConnecting(true);
    setCalError(null);
    try {
      const { url } = await getGCalAuthUrl();
      window.open(url, "_self");
    } catch (e) {
      setCalError(e instanceof Error ? e.message : "Failed to get auth URL");
      setCalConnecting(false);
    }
  };

  const handleCalDisconnect = async () => {
    setCalConnecting(true);
    setCalError(null);
    try {
      await disconnectGCal();
      setCalStatus({ connected: false });
    } catch (e) {
      setCalError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setCalConnecting(false);
    }
  };

  const [tzSearch, setTzSearch] = useState("");
  const [tzOpen, setTzOpen] = useState(false);
  const filteredTz = COMMON_TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(tzSearch.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-lg space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-xs text-muted-foreground mt-1">Configure your Life Tool preferences.</p>
        </div>

        {/* General */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">General</h3>

          <div className="rounded-lg border bg-card divide-y divide-border">
            {/* Start day */}
            <div className="px-4 py-3.5 space-y-2.5">
              <div>
                <p className="text-sm font-medium">Start day of week</p>
                <p className="text-xs text-muted-foreground mt-0.5">First day shown in calendar and weekly views.</p>
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg border bg-muted/20 w-fit">
                {START_DAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onUpdate({ ...settings, startDayOfWeek: opt.value })}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                      settings.startDayOfWeek === opt.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div className="px-4 py-3.5 space-y-2.5">
              <div>
                <p className="text-sm font-medium">Timezone</p>
                <p className="text-xs text-muted-foreground mt-0.5">Used for scheduling and time-based features.</p>
              </div>
              <div className="relative w-fit">
                <button
                  onClick={() => setTzOpen(!tzOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-md border bg-background hover:bg-muted/50 transition-colors min-w-[220px] text-left"
                >
                  <span className="truncate flex-1">{settings.timezone}</span>
                  <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", tzOpen && "rotate-180")} />
                </button>
                {tzOpen && (
                  <div className="absolute left-0 top-full mt-1 w-72 max-h-60 rounded-lg border bg-popover shadow-lg z-50 flex flex-col overflow-hidden">
                    <div className="p-2 border-b">
                      <input
                        type="text"
                        value={tzSearch}
                        onChange={(e) => setTzSearch(e.target.value)}
                        placeholder="Search timezones..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredTz.map((tz) => (
                        <button
                          key={tz}
                          onClick={() => {
                            onUpdate({ ...settings, timezone: tz });
                            setTzOpen(false);
                            setTzSearch("");
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted/50 transition-colors",
                            settings.timezone === tz && "bg-muted text-foreground font-medium"
                          )}
                        >
                          {tz}
                        </button>
                      ))}
                      {filteredTz.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No timezones match.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Agent */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent</h3>

          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Auto-approve actions</p>
                <p className="text-xs text-muted-foreground mt-0.5">Let the agent create actionables, update routines, and save memories without asking first.</p>
              </div>
              <button
                onClick={() => onUpdate({ ...settings, autoApproveActions: !settings.autoApproveActions })}
                className="relative shrink-0"
              >
                <div className={cn(
                  "h-5 w-9 rounded-full transition-colors",
                  settings.autoApproveActions ? "bg-primary" : "bg-muted-foreground/20"
                )} />
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  settings.autoApproveActions ? "translate-x-[18px]" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>
        </section>

        {/* Calendar */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calendar</h3>

          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {calLoading
                    ? "Checking connection..."
                    : calStatus?.connected
                    ? <>Connected as <span className="font-medium text-foreground">{calStatus.email ?? "unknown"}</span></>
                    : "Connect to sync events and schedules with the agent."}
                </p>
              </div>
              <div className="shrink-0">
                {calLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : calStatus?.connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCalDisconnect}
                    disabled={calConnecting}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    {calConnecting && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCalConnect}
                    disabled={calConnecting}
                    className="text-xs"
                  >
                    {calConnecting ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CalendarDays className="h-3 w-3 mr-1.5" />}
                    Connect
                  </Button>
                )}
              </div>
            </div>
            {calError && (
              <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-destructive border-t">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {calError}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Life Tool (main export) ──────────────────────────────────────────────────

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

function LifeTabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNewChat,
  onReorder,
  onPin,
}: {
  tabs: LifeTab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNewChat: () => void;
  onReorder: (tabs: LifeTab[]) => void;
  onPin: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  // Sort tabs: pinned first, preserve order within groups
  const sortedTabs = useMemo(() => {
    const pinned = tabs.filter((t) => t.pinned);
    const unpinned = tabs.filter((t) => !t.pinned);
    return [...pinned, ...unpinned];
  }, [tabs]);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Convert vertical scroll to horizontal when cursor is on the tab bar
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("scroll", checkOverflow, { passive: true });
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("scroll", checkOverflow);
      ro.disconnect();
    };
  }, [checkOverflow]);

  // Recheck overflow when tabs change
  useEffect(() => { checkOverflow(); }, [tabs.length, checkOverflow]);

  // Scroll active tab into view
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-tab-id="${CSS.escape(activeTabId)}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  return (
    <div className="relative shrink-0 border-b bg-muted/10">
      <div
        ref={scrollRef}
        className="flex items-end overflow-x-auto min-h-[36px] hide-scrollbar"
      >
        {sortedTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDragging = dragId === tab.id;
          const isDropTarget = dropTarget === tab.id && dragId !== tab.id;
          const isPinned = !!tab.pinned;
          const label = tab.type === "chat"
            ? (tab.title ?? `Chat #${tab.chatNum ?? ""}`)
            : (tab.title ?? TAB_LABELS[tab.type]);
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              draggable
              onDragStart={(e) => {
                setDragId(tab.id);
                e.dataTransfer.effectAllowed = "move";
                const img = new Image();
                img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                e.dataTransfer.setDragImage(img, 0, 0);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTarget(tab.id);
              }}
              onDragLeave={() => {
                setDropTarget((prev) => prev === tab.id ? null : prev);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== tab.id) {
                  const fromIdx = tabs.findIndex((t) => t.id === dragId);
                  const toIdx = tabs.findIndex((t) => t.id === tab.id);
                  if (fromIdx !== -1 && toIdx !== -1) {
                    const reordered = [...tabs];
                    const [moved] = reordered.splice(fromIdx, 1);
                    reordered.splice(toIdx, 0, moved);
                    onReorder(reordered);
                  }
                }
                setDragId(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropTarget(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs cursor-grab select-none",
                "border-r border-border/50 shrink-0 max-w-[180px] group transition-colors",
                isActive
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                isPinned && !isActive && "bg-primary/[0.04] text-foreground/80",
                isDragging && "opacity-40",
                isDropTarget && "border-l-2 border-l-primary",
              )}
              onClick={() => onSwitch(tab.id)}
            >
              <span className={TAB_COLORS[tab.type]}>{TAB_ICONS[tab.type]}</span>
              <span className="truncate font-medium">{label}</span>
              {isPinned ? (
                <Pin className="h-2.5 w-2.5 shrink-0 text-primary/50 -mr-0.5 rotate-45" />
              ) : (
                <button
                  className={cn(
                    "shrink-0 rounded hover:bg-muted transition-colors p-0.5 -mr-0.5",
                    isActive
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                  aria-label={`Close ${label}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}
        {/* Tab context menu */}
        {ctxMenu && (
          <div
            className="fixed z-50 min-w-[140px] rounded-md border bg-popover py-1 shadow-md text-popover-foreground animate-in fade-in-0 zoom-in-95"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const t = tabs.find((t) => t.id === ctxMenu.tabId);
              const isPinned = !!t?.pinned;
              return (
                <>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                    onClick={() => { onPin(ctxMenu.tabId); setCtxMenu(null); }}
                  >
                    {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                    {isPinned ? "Unpin tab" : "Pin tab"}
                  </button>
                  {!isPinned && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-destructive transition-colors"
                      onClick={() => { onClose(ctxMenu.tabId); setCtxMenu(null); }}
                    >
                      <X className="size-3" />
                      Close tab
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
        <button
          className="flex items-center justify-center h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-sm transition-colors"
          onClick={onNewChat}
          aria-label="New chat"
          title="New Chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scroll-right fade indicator */}
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pr-1.5 transition-opacity"
          style={{ background: "linear-gradient(to right, transparent, var(--background) 60%)" }}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LifeTool() {
  const pathname = usePathname();
  const router = useRouter();
  const stateSync = useSyncedState<LifePersistedState>("1tt:life-state", DEFAULT_LIFE_STATE);
  const lifeState = stateSync.data;
  const setLifeState = stateSync.setData;
  const chatCounterRef = useRef(0);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Wait for synced state to hydrate from localStorage before rendering content
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Check onboarding status from API on first load
  useEffect(() => {
    if (!hydrated || onboardingChecked) return;
    // If already onboarded locally, skip API check
    if (lifeState.onboarded) {
      setOnboardingChecked(true);
      return;
    }
    // Fetch profile to get canonical onboarded flag
    fetch("/api/proxy/life/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { profile?: { onboarded?: boolean } }) => {
        if (data.profile?.onboarded) {
          setLifeState((prev) => ({ ...prev, onboarded: true }));
        }
      })
      .catch(() => {})
      .finally(() => setOnboardingChecked(true));
  }, [hydrated, onboardingChecked, lifeState.onboarded, setLifeState]);

  const completeOnboarding = useCallback(() => {
    markOnboarded().catch(() => {});
    setLifeState((prev) => ({ ...prev, onboarded: true }));
  }, [setLifeState]);

  // Enable cloud sync by default on first use
  useEffect(() => {
    if (stateSync.isLoggedIn && stateSync.syncMode === "local") {
      const hasBeenSet = localStorage.getItem("sync-mode:1tt:life-state");
      if (!hasBeenSet) {
        stateSync.setSyncMode("cloud");
      }
    }
  }, [stateSync.isLoggedIn, stateSync.syncMode, stateSync.setSyncMode]);

  // Derive next chat number from existing tabs
  useEffect(() => {
    const chatNums = lifeState.tabs
      .filter((t) => t.type === "chat")
      .map((t) => t.chatNum ?? 0);
    chatCounterRef.current = chatNums.length > 0 ? Math.max(...chatNums) : 0;
  }, [lifeState.tabs]);

  const tabs = lifeState.tabs;
  const activeTabId = lifeState.activeTabId;

  // Update URL when active tab changes
  const updateUrl = useCallback((tab: LifeTab | null) => {
    if (!tab) return;
    const url = tabToUrl(tab);
    if (pathname !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [pathname]);

  // On mount: resolve initial tab from URL
  const initializedFromUrl = useRef(false);
  const urlSyncReady = useRef(false);
  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;

    const parsed = urlToTab(pathname);
    if (!parsed) return;

    if (parsed.type === "chat" && parsed.convId) {
      // URL has a specific conversation — open/find that chat tab
      setLifeState((prev) => {
        const existing = prev.tabs.find((t) => t.type === "chat" && t.convId === parsed.convId);
        if (existing) return { ...prev, activeTabId: existing.id };
        const num = (prev.tabs.filter((t) => t.type === "chat").map((t) => t.chatNum ?? 0).reduce((a, b) => Math.max(a, b), 0)) + 1;
        const newTab: LifeTab = { id: `tab:chat:${parsed.convId}`, type: "chat", convId: parsed.convId, chatNum: num };
        return { ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
      });
    } else if (parsed.type === "routine-detail" && parsed.routineId) {
      const id = `tab:routine:${parsed.routineId}`;
      setLifeState((prev) => {
        const existing = prev.tabs.find((t) => t.id === id);
        return {
          ...prev,
          tabs: existing ? prev.tabs : [...prev.tabs, { id, type: "routine-detail", routineId: parsed.routineId, title: "Routine" }],
          activeTabId: id,
        };
      });
    } else if (parsed.type !== "chat") {
      // Non-chat tab from URL
      const id = `tab:${parsed.type}`;
      setLifeState((prev) => {
        const existing = prev.tabs.find((t) => t.id === id);
        return {
          ...prev,
          tabs: existing ? prev.tabs : [...prev.tabs, { id, type: parsed.type }],
          activeTabId: id,
        };
      });
    }
    // If just /tools/life with no specific path, use the persisted active tab

    // Allow URL sync after a tick so the URL-driven state takes priority over persisted state
    requestAnimationFrame(() => { urlSyncReady.current = true; });
  }, [pathname, setLifeState]);

  // Sync URL when active tab changes (only after URL init has settled)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  useEffect(() => {
    if (urlSyncReady.current) updateUrl(activeTab);
  }, [activeTab, updateUrl]);


  const switchTab = useCallback((id: string) => {
    setLifeState((prev) => ({ ...prev, activeTabId: id }));
  }, [setLifeState]);

  const openTab = useCallback((type: LifeTabType) => {
    if (type === "chat") {
      // "Chat" in sidebar opens a new chat or focuses the first chat tab
      setLifeState((prev) => {
        const firstChat = prev.tabs.find((t) => t.type === "chat");
        if (firstChat) return { ...prev, activeTabId: firstChat.id };
        const num = (prev.tabs.filter((t) => t.type === "chat").map((t) => t.chatNum ?? 0).reduce((a, b) => Math.max(a, b), 0)) + 1;
        const newTab: LifeTab = { id: `tab:chat:new-${num}`, type: "chat", chatNum: num };
        return { ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
      });
      return;
    }
    const id = `tab:${type}`;
    setLifeState((prev) => {
      const existing = prev.tabs.find((t) => t.id === id);
      return {
        ...prev,
        tabs: existing ? prev.tabs : [...prev.tabs, { id, type }],
        activeTabId: id,
      };
    });
  }, [setLifeState]);

  const openNewChat = useCallback(() => {
    setLifeState((prev) => {
      const num = (prev.tabs.filter((t) => t.type === "chat").map((t) => t.chatNum ?? 0).reduce((a, b) => Math.max(a, b), 0)) + 1;
      const newTab: LifeTab = { id: `tab:chat:new-${num}`, type: "chat", chatNum: num };
      return { ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
    });
  }, [setLifeState]);

  const openRoutineDetail = useCallback((routineId: string, name: string) => {
    const id = `tab:routine:${routineId}`;
    setLifeState((prev) => {
      const existing = prev.tabs.find((t) => t.id === id);
      return {
        ...prev,
        tabs: existing ? prev.tabs : [...prev.tabs, { id, type: "routine-detail" as LifeTabType, routineId, title: name }],
        activeTabId: id,
      };
    });
  }, [setLifeState]);

  const closeTab = useCallback((id: string) => {
    setLifeState((prev) => {
      const tab = prev.tabs.find((t) => t.id === id);
      if (tab?.pinned) return prev; // can't close pinned tabs
      const idx = prev.tabs.findIndex((t) => t.id === id);
      const next = prev.tabs.filter((t) => t.id !== id);
      const newActive = prev.activeTabId === id
        ? (next[Math.min(idx, next.length - 1)]?.id ?? null)
        : prev.activeTabId;
      return { ...prev, tabs: next, activeTabId: newActive };
    });
  }, [setLifeState]);

  const pinTab = useCallback((id: string) => {
    setLifeState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.id === id ? { ...t, pinned: !t.pinned } : t
      ),
    }));
  }, [setLifeState]);

  // When a chat tab gets a conversation ID, update the tab's convId and URL
  const onChatConvIdChange = useCallback((tabId: string, convId: string | null) => {
    setLifeState((prev) => {
      const newTabs = prev.tabs.map((t) =>
        t.id === tabId && t.type === "chat"
          ? { ...t, convId: convId ?? undefined, id: convId ? `tab:chat:${convId}` : t.id }
          : t
      );
      const newActiveTabId = prev.activeTabId === tabId && convId
        ? `tab:chat:${convId}`
        : prev.activeTabId;
      return { ...prev, tabs: newTabs, activeTabId: newActiveTabId };
    });
    if (convId) {
      window.history.replaceState(null, "", `${LIFE_BASE}/c/${convId}`);
    }
  }, [setLifeState]);

  if (!hydrated) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar skeleton */}
        <div className="border-b shrink-0">
          <div className="flex items-center gap-2 px-4 py-2">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Life Tool</span>
          </div>
        </div>
        {/* Body skeleton */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar skeleton */}
          <aside className="w-52 shrink-0 border-r bg-muted/20 p-3 space-y-4">
            {[...Array(4)].map((_, g) => (
              <div key={g} className="space-y-1.5">
                <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
                {[...Array(g === 0 ? 1 : 2)].map((_, i) => (
                  <div key={i} className="h-7 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ))}
          </aside>
          {/* Content skeleton */}
          <div className="flex-1 flex flex-col">
            <div className="h-9 border-b bg-muted/10" />
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show onboarding if not yet completed
  if (onboardingChecked && !lifeState.onboarded) {
    return (
      <AuthGate>
        <div className="flex flex-col h-full overflow-hidden">
          <OnboardingView onComplete={completeOnboarding} onOpenTab={openTab} />
        </div>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <div className="border-b shrink-0">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className={cn(
                "p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground",
                sidebarOpen && "bg-muted/50 text-foreground"
              )}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
            </button>
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Life Tool</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {sidebarOpen && (
            <LifeSidebar
              activeTabType={activeTab?.type ?? null}
              onOpenTab={openTab}
            />
          )}

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Tab bar */}
            <LifeTabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSwitch={switchTab}
              onClose={closeTab}
              onNewChat={openNewChat}
              onReorder={(reordered) => setLifeState((prev) => ({ ...prev, tabs: reordered }))}
              onPin={pinTab}
            />

            {/* Tab content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {activeTab === null ? (
                <PlaceholderView tab="today" />
              ) : activeTab.type === "chat" ? (
                <ChatView
                  key={activeTab.id}
                  persistedConvId={activeTab.convId ?? null}
                  onConvIdChange={(id) => onChatConvIdChange(activeTab.id, id)}
                  onNewChat={openNewChat}
                  onOpenRoutine={openRoutineDetail}
                  autoApprove={lifeState.settings?.autoApproveActions}
                />
              ) : activeTab.type === "memories" ? (
                <MemoriesView />
              ) : activeTab.type === "actionables" ? (
                <ActionablesView />
              ) : activeTab.type === "routines" ? (
                <RoutinesView onOpenRoutine={openRoutineDetail} />
              ) : activeTab.type === "routine-detail" && activeTab.routineId ? (
                <RoutineDetailView key={activeTab.routineId} routineId={activeTab.routineId} />
              ) : activeTab.type === "channels" ? (
                <ChannelsView />
              ) : activeTab.type === "calendar" ? (
                <CalendarView />
              ) : activeTab.type === "tasks" ? (
                <TasksView />
              ) : activeTab.type === "settings" ? (
                <SettingsView
                  settings={lifeState.settings ?? DEFAULT_SETTINGS}
                  onUpdate={(s) => setLifeState((prev) => ({ ...prev, settings: s }))}
                />
              ) : (
                <PlaceholderView tab={activeTab.type} />
              )}
            </div>
          </div>
        </div>

      </div>
    </AuthGate>
  );
}
