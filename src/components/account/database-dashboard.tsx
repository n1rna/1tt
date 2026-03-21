"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { AuthGate } from "@/components/layout/auth-gate";
import { useBillingStatus } from "@/lib/billing";
import {
  useDatabases,
  createDatabase,
  deleteDatabase,
} from "@/lib/databases";
import {
  useHostedSqliteDbs,
  uploadSqliteDb,
  deleteHostedSqliteDb,
  type HostedSqliteDB,
} from "@/lib/hosted-sqlite";
import {
  useRedis,
  createRedis,
  deleteRedis,
  getRedisDetail,
  type UserRedis,
  type RedisDetail,
} from "@/lib/redis";
import {
  useStorageBuckets,
  createBucket,
  deleteBucket,
  type StorageBucket,
} from "@/lib/storage";
import { ConnectionDialog } from "@/components/account/connection-dialog";
import { ApiInfoDialog } from "@/components/account/hosted-sqlite-api-dialog";
import { TunnelConnectDialog } from "@/components/account/tunnel-connect-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileUp,
  Globe,
  HardDrive,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Wifi,
} from "lucide-react";
import Link from "next/link";

// ── Constants ──────────────────────────────────────

const REGIONS: { value: string; label: string }[] = [
  { value: "aws-us-east-1", label: "US East (N. Virginia)" },
  { value: "aws-us-west-2", label: "US West (Oregon)" },
  { value: "aws-eu-central-1", label: "EU Central (Frankfurt)" },
  { value: "aws-ap-southeast-1", label: "Asia Pacific (Singapore)" },
];

const REDIS_REGIONS: { value: string; label: string }[] = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-central-1", label: "EU Central (Frankfurt)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ── Types ──────────────────────────────────────────

type UnifiedDb =
  | { type: "neon"; id: string; name: string; region: string; status: string; createdAt: string }
  | { type: "sqlite"; db: HostedSqliteDB }
  | { type: "redis"; db: UserRedis }
  | { type: "storage"; db: StorageBucket };

// ── Helpers ────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function nameFromFile(filename: string): string {
  return filename.replace(/\.(sqlite3?|db3?)$/i, "");
}

function regionLabel(value: string): string {
  return (
    REGIONS.find((r) => r.value === value)?.label ??
    REDIS_REGIONS.find((r) => r.value === value)?.label ??
    value
  );
}

function getCreatedAt(item: UnifiedDb): string {
  if (item.type === "neon") return item.createdAt;
  if (item.type === "sqlite") return item.db.createdAt;
  return item.db.createdAt;
}

// ── Sub-components ─────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500",
    ready: "bg-green-500",
    deleting: "bg-yellow-500",
    creating: "bg-blue-500",
    processing: "bg-blue-500",
    error: "bg-red-500",
  };
  const labels: Record<string, string> = {
    active: "Active",
    ready: "Active",
    deleting: "Deleting",
    creating: "Creating",
    processing: "Processing",
    error: "Error",
  };
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${colors[status] ?? "bg-muted-foreground"}`}
      />
      {labels[status] ?? status}
    </span>
  );
}

function TypeBadge({ type }: { type: "neon" | "sqlite" | "redis" | "storage" }) {
  if (type === "neon") {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
        Postgres
      </span>
    );
  }
  if (type === "redis") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 shrink-0">
        Redis
      </span>
    );
  }
  if (type === "storage") {
    return (
      <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
        Storage
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
      SQLite
    </span>
  );
}

// ── Storage Bucket Card ─────────────────────────────

function StorageBucketCard({
  bucket,
  onDeleted,
}: {
  bucket: StorageBucket;
  onDeleted: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBucket(bucket.id);
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/account/storage/${bucket.id}`}
          className="flex items-center gap-3 min-w-0 flex-1 group"
        >
          <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate group-hover:underline underline-offset-2">
                {bucket.name}
              </p>
              <TypeBadge type="storage" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {formatBytes(bucket.totalSize)}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {bucket.objectCount} {bucket.objectCount === 1 ? "object" : "objects"}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(bucket.createdAt)}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={bucket.status} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            title="Delete bucket"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <DeleteDatabaseDialog
        dbName={bucket.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
        deleting={deleting}
      />
    </div>
  );
}

// ── Create Bucket Dialog ────────────────────────────

const BUCKET_NAME_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

function CreateBucketDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = BUCKET_NAME_RE.test(name);

  const handleCreate = async () => {
    if (!isValid) return;
    setCreating(true);
    setError(null);
    try {
      await createBucket(name.trim());
      onOpenChange(false);
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bucket");
    } finally {
      setCreating(false);
    }
  };

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Storage Bucket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="bucket-name">Name</Label>
              <Input
                id="bucket-name"
                placeholder="my-bucket"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase alphanumeric and hyphens, 3–63 characters.
              </p>
            </div>
            {name.length > 0 && !isValid && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Must be 3–63 lowercase alphanumeric characters or hyphens.
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            <Button
              className="w-full gap-2"
              onClick={() => void handleCreate()}
              disabled={creating || !isValid}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? "Creating…" : "Create Bucket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
}

// ── Delete Dialog (shared) ─────────────────────────

function DeleteDatabaseDialog({
  dbName,
  open,
  onOpenChange,
  onConfirm,
  deleting,
}: {
  dbName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (!v) setConfirmText("");
    onOpenChange(v);
  };

  const matches = confirmText === dbName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete Database
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete the database{" "}
            <span className="font-semibold text-foreground">{dbName}</span> and
            all of its data. This action cannot be undone.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Type <span className="font-mono text-foreground">{dbName}</span>{" "}
              to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={dbName}
              className="font-mono text-sm"
              autoFocus
              disabled={deleting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={onConfirm}
              disabled={!matches || deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {deleting ? "Deleting…" : "Delete Database"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Neon Database Card ─────────────────────────────

function NeonDatabaseCard({
  db,
  onDeleted,
}: {
  db: { id: string; name: string; region: string; status: string; createdAt: string };
  onDeleted: () => void;
}) {
  const [connOpen, setConnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDatabase(db.id);
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/account/postgres/${db.id}`}
          className="flex items-center gap-3 min-w-0 flex-1 group"
        >
          <Database className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate group-hover:underline underline-offset-2">
                {db.name}
              </p>
              <TypeBadge type="neon" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                {regionLabel(db.region)}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(db.createdAt)}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={db.status} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setConnOpen(true)}
            title="Connection details"
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            title="Delete database"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <ConnectionDialog
        dbId={db.id}
        dbName={db.name}
        open={connOpen}
        onOpenChange={setConnOpen}
      />
      <DeleteDatabaseDialog
        dbName={db.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
        deleting={deleting}
      />
    </div>
  );
}

// ── SQLite Database Card ───────────────────────────

function SqliteDatabaseCard({
  db,
  onDeleted,
}: {
  db: HostedSqliteDB;
  onDeleted: () => void;
}) {
  const [apiOpen, setApiOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteHostedSqliteDb(db.id);
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/account/sqlite/${db.id}`}
          className="flex items-center gap-3 min-w-0 flex-1 group"
        >
          <Database className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate group-hover:underline underline-offset-2">
                {db.name}
              </p>
              <TypeBadge type="sqlite" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {db.tursoHostname
                  ? "Turso"
                  : db.fileSize > 0
                    ? formatBytes(db.fileSize)
                    : "Turso"}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(db.createdAt)}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={db.status} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 gap-1.5"
            onClick={() => setApiOpen(true)}
            title="Connection details"
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            title="Delete database"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <ApiInfoDialog db={db} open={apiOpen} onOpenChange={setApiOpen} />
      <DeleteDatabaseDialog
        dbName={db.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
        deleting={deleting}
      />
    </div>
  );
}

// ── Redis Database Card ────────────────────────────

function RedisConnectionDialog({
  dbId,
  dbName,
  open,
  onOpenChange,
}: {
  dbId: string;
  dbName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<RedisDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setRevealed(false);
    getRedisDetail(dbId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, dbId]);

  const copyValue = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const redisUrl = detail
    ? `rediss://default:${detail.password}@${detail.endpoint}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            {dbName} — Connection Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : detail ? (
          <div className="space-y-3">
            {/* Connection URL */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Connection URL</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 min-w-0 text-xs font-mono bg-muted rounded px-2 py-1.5 break-all">
                  {revealed ? redisUrl : redisUrl.replace(/:([^:@]+)@/, ":••••••••@")}
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setRevealed((v) => !v)}>
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void copyValue(redisUrl, "url")}>
                  {copied === "url" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Individual fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Endpoint</p>
                <div className="flex items-center gap-1">
                  <code className="text-xs font-mono text-foreground truncate">{detail.endpoint}</code>
                  <button className="shrink-0" onClick={() => void copyValue(detail.endpoint, "endpoint")}>
                    {copied === "endpoint" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Password</p>
                <div className="flex items-center gap-1">
                  <code className="text-xs font-mono text-foreground truncate">
                    {revealed ? detail.password : "••••••••"}
                  </code>
                  <button className="shrink-0" onClick={() => void copyValue(detail.password, "password")}>
                    {copied === "password" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />}
                  </button>
                </div>
              </div>
            </div>

            {/* REST Token */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">REST Token</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 min-w-0 text-xs font-mono bg-muted rounded px-2 py-1.5 truncate">
                  {revealed ? detail.restToken : "••••••••••••••••"}
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void copyValue(detail.restToken, "rest")}>
                  {copied === "rest" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Failed to load connection details.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RedisDatabaseCard({
  db,
  onDeleted,
}: {
  db: UserRedis;
  onDeleted: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRedis(db.id);
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/account/redis/${db.id}`}
          className="flex items-center gap-3 min-w-0 flex-1 group"
        >
          <Database className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate group-hover:underline underline-offset-2">
                {db.name}
              </p>
              <TypeBadge type="redis" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                {regionLabel(db.region)}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(db.createdAt)}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={db.status} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setConnOpen(true)}
            title="Connection details"
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            title="Delete Redis instance"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <RedisConnectionDialog
        dbId={db.id}
        dbName={db.name}
        open={connOpen}
        onOpenChange={setConnOpen}
      />
      <DeleteDatabaseDialog
        dbName={db.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
        deleting={deleting}
      />
    </div>
  );
}

// ── Create Redis Dialog ────────────────────────────

function CreateRedisDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createRedis(name.trim(), region);
      onOpenChange(false);
      setName("");
      setRegion("us-east-1");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Redis instance");
    } finally {
      setCreating(false);
    }
  };

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Redis Database</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="redis-name">Name</Label>
              <Input
                id="redis-name"
                placeholder="my-cache"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="redis-region">Region</Label>
              <Select
                value={region}
                onValueChange={(v) => {
                  if (v !== null) setRegion(v);
                }}
              >
                <SelectTrigger id="redis-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REDIS_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            <Button
              className="w-full gap-2"
              onClick={() => void handleCreate()}
              disabled={creating || !name.trim()}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? "Creating…" : "Create Redis"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
}

// ── Create Postgres Dialog ─────────────────────────

function CreatePostgresDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("aws-us-east-1");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createDatabase(name.trim(), region);
      onOpenChange(false);
      setName("");
      setRegion("aws-us-east-1");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create database");
    } finally {
      setCreating(false);
    }
  };

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Postgres Database</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="db-name">Name</Label>
              <Input
                id="db-name"
                placeholder="my-database"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db-region">Region</Label>
              <Select
                value={region}
                onValueChange={(v) => {
                  if (v !== null) setRegion(v);
                }}
              >
                <SelectTrigger id="db-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            <Button
              className="w-full gap-2"
              onClick={() => void handleCreate()}
              disabled={creating || !name.trim()}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? "Creating…" : "Create Database"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
}

// ── Upload SQLite Dialog ───────────────────────────

function UploadSqliteDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded: (db: HostedSqliteDB) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setName("");
    setError(null);
    setUploading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError(`File is too large (max 50 MB, got ${formatBytes(f.size)})`);
      return;
    }
    setError(null);
    setFile(f);
    if (!name) setName(nameFromFile(f.name));
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const db = await uploadSqliteDb(file, name.trim());
      onOpenChange(false);
      reset();
      onUploaded(db);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload SQLite Database</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Your database will be hosted on{" "}
              <a
                href="https://turso.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                Turso
              </a>{" "}
              (powered by{" "}
              <a
                href="https://github.com/tursodatabase/libsql"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                libSQL
              </a>
              ). You&apos;ll get a native{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-[10px]">libsql://</code>{" "}
              connection URL and an auth token to connect from any app using
              official SDKs for JavaScript, Python, Go, and Rust.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="sqlite-file">File</Label>
              <input
                id="sqlite-file"
                ref={fileInputRef}
                type="file"
                accept=".sqlite,.db,.sqlite3,.db3"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-accent transition-colors"
              >
                <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
                {file ? (
                  <span className="truncate font-medium">{file.name}</span>
                ) : (
                  <span className="text-muted-foreground">
                    Choose a .sqlite, .db, .sqlite3, or .db3 file (max 50 MB)
                  </span>
                )}
              </button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sqlite-name">Name</Label>
              <Input
                id="sqlite-name"
                placeholder="my-database"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleUpload();
                }}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            <Button
              className="w-full gap-2"
              onClick={() => void handleUpload()}
              disabled={uploading || !file || !name.trim()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileUp className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
}

// ── Main inner component ───────────────────────────

function DatabaseDashboardInner() {
  const { data: session } = useSession();
  const { data: neonDbs, loading: neonLoading, error: neonError, refetch: refetchNeon } = useDatabases();
  const { data: sqliteDbs, loading: sqliteLoading, error: sqliteError, refetch: refetchSqlite } = useHostedSqliteDbs();
  const { data: redisDbs, loading: redisLoading, error: redisError, refetch: refetchRedis } = useRedis();
  const { data: storageBuckets, loading: storageLoading, error: storageError, refetch: refetchStorage } = useStorageBuckets();
  const { data: billing, loading: billingLoading } = useBillingStatus();
  const [pendingApiDb, setPendingApiDb] = useState<HostedSqliteDB | null>(null);
  const [tunnelOpen, setTunnelOpen] = useState(false);
  const [postgresOpen, setPostgresOpen] = useState(false);
  const [sqliteOpen, setSqliteOpen] = useState(false);
  const [redisOpen, setRedisOpen] = useState(false);
  const [bucketOpen, setBucketOpen] = useState(false);

  const loading = neonLoading || sqliteLoading || redisLoading || storageLoading;
  const error = neonError ?? sqliteError ?? redisError ?? storageError ?? null;
  const isPaidPlan = billing != null && billing.plan !== "free";
  const billingResolved = !billingLoading && billing != null;

  const refetchAll = () => {
    void refetchNeon();
    void refetchSqlite();
    void refetchRedis();
    void refetchStorage();
  };

  // Build and sort unified list
  const unified: UnifiedDb[] = [
    ...(neonDbs ?? []).map((db): UnifiedDb => ({ type: "neon", ...db })),
    ...(sqliteDbs ?? []).map((db): UnifiedDb => ({ type: "sqlite", db })),
    ...(redisDbs ?? []).map((db): UnifiedDb => ({ type: "redis", db })),
    ...(storageBuckets ?? []).map((db): UnifiedDb => ({ type: "storage", db })),
  ].sort(
    (a, b) =>
      new Date(getCreatedAt(b)).getTime() - new Date(getCreatedAt(a)).getTime()
  );

  const isEmpty = !loading && !error && unified.length === 0;

  const handleSqliteUploaded = (db: HostedSqliteDB) => {
    void refetchSqlite();
    setPendingApiDb(db);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Databases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Postgres, SQLite, Redis, and object storage.
          </p>
        </div>
        {!loading && !error && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  New
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPostgresOpen(true)}>
                  <Database className="h-4 w-4" />
                  PostgreSQL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRedisOpen(true)}>
                  <Database className="h-4 w-4" />
                  Redis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSqliteOpen(true)}>
                  <FileUp className="h-4 w-4" />
                  Upload SQLite
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBucketOpen(true)}>
                  <HardDrive className="h-4 w-4" />
                  Storage Bucket
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTunnelOpen(true)}>
                  <Wifi className="h-4 w-4" />
                  Connect External
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CreatePostgresDialog open={postgresOpen} onOpenChange={setPostgresOpen} onCreated={refetchAll} />
            <UploadSqliteDialog open={sqliteOpen} onOpenChange={setSqliteOpen} onUploaded={handleSqliteUploaded} />
            <CreateRedisDialog open={redisOpen} onOpenChange={setRedisOpen} onCreated={refetchAll} />
            <CreateBucketDialog open={bucketOpen} onOpenChange={setBucketOpen} onCreated={refetchAll} />
            <TunnelConnectDialog open={tunnelOpen} onOpenChange={setTunnelOpen} />
          </>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to load databases.</span>
          <button
            className="underline underline-offset-2 hover:no-underline"
            onClick={refetchAll}
          >
            Retry
          </button>
        </div>
      )}

      {/* Postgres plan warning (free users) */}
      {!loading && !error && billingResolved && !isPaidPlan && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-center gap-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Postgres databases require a paid plan.{" "}
            <Link
              href="/account/billing"
              className="underline underline-offset-2 hover:no-underline font-medium"
            >
              Upgrade to Pro
            </Link>{" "}
            to create serverless Postgres databases.
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-lg border divide-y">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-lg border px-6 py-12 flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Database className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No databases yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first database to get started.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Create
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setPostgresOpen(true)}>
                <Database className="h-4 w-4" />
                PostgreSQL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRedisOpen(true)}>
                <Database className="h-4 w-4" />
                Redis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSqliteOpen(true)}>
                <FileUp className="h-4 w-4" />
                Upload SQLite
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBucketOpen(true)}>
                <HardDrive className="h-4 w-4" />
                Storage Bucket
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTunnelOpen(true)}>
                <Wifi className="h-4 w-4" />
                Connect External
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Unified database list */}
      {!loading && unified.length > 0 && (
        <div className="rounded-lg border divide-y">
          {unified.map((item) =>
            item.type === "neon" ? (
              <NeonDatabaseCard
                key={`neon-${item.id}`}
                db={item}
                onDeleted={refetchAll}
              />
            ) : item.type === "redis" ? (
              <RedisDatabaseCard
                key={`redis-${item.db.id}`}
                db={item.db}
                onDeleted={refetchAll}
              />
            ) : item.type === "storage" ? (
              <StorageBucketCard
                key={`storage-${item.db.id}`}
                bucket={item.db}
                onDeleted={refetchAll}
              />
            ) : (
              <SqliteDatabaseCard
                key={`sqlite-${item.db.id}`}
                db={item.db}
                onDeleted={refetchAll}
              />
            )
          )}
        </div>
      )}

      {/* Post-upload API key dialog */}
      {pendingApiDb && (
        <ApiInfoDialog
          db={pendingApiDb}
          open={true}
          onOpenChange={(v) => {
            if (!v) setPendingApiDb(null);
          }}
        />
      )}

      {/* Account info footer */}
      {session?.user && (
        <p className="text-xs text-muted-foreground">
          Account:{" "}
          <span className="font-medium">{session.user.email}</span>
        </p>
      )}
    </div>
  );
}

export function DatabaseDashboard() {
  return (
    <AuthGate>
      <DatabaseDashboardInner />
    </AuthGate>
  );
}
