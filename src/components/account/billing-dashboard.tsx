"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { AuthGate } from "@/components/layout/auth-gate";
import { useBillingStatus } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WobbleCard } from "@/components/ui/wobble-card";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Loader2,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
};

const PLAN_PRICES: Record<string, string> = {
  free: "€0",
  pro: "€5",
  max: "€15",
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: "Get started with the essentials",
  pro: "For power users and creators",
  max: "For teams & high-volume usage",
};

const METRIC_LABELS: Record<string, string> = {
  "paste-created": "Pastes",
  "og-image-view": "OG Image Views",
  "ai-token-used": "AI Tokens",
};

const PLAN_FEATURE_LIST: {
  label: string;
  free: string;
  pro: string;
  max: string;
}[] = [
  { label: "Pastes / month", free: "5", pro: "100", max: "500" },
  {
    label: "OG Image Views / month",
    free: "1,000",
    pro: "10,000",
    max: "50,000",
  },
  { label: "AI Tokens / month", free: "0", pro: "100,000", max: "500,000" },
  { label: "OG Collections", free: "1", pro: "10", max: "Unlimited" },
  { label: "Postgres databases", free: "0", pro: "1", max: "3" },
  { label: "SQLite databases", free: "0", pro: "3", max: "10" },
  { label: "SQLite max file size", free: "—", pro: "10 MB", max: "50 MB" },
  { label: "Overage billing", free: "—", pro: "Yes", max: "Yes" },
];

const PLAN_COLORS: Record<
  string,
  { card: string; badge: string; check: string; button: string }
> = {
  free: {
    card: "bg-neutral-100 dark:bg-neutral-900",
    badge: "bg-neutral-200/80 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    check: "text-neutral-500 dark:text-neutral-500",
    button: "",
  },
  pro: {
    card: "bg-blue-600 dark:bg-blue-950",
    badge:
      "bg-blue-500/20 text-blue-100 dark:bg-blue-500/20 dark:text-blue-300",
    check: "text-blue-200 dark:text-blue-400",
    button: "",
  },
  max: {
    card: "bg-violet-600 dark:bg-violet-950",
    badge:
      "bg-violet-500/20 text-violet-100 dark:bg-violet-500/20 dark:text-violet-300",
    check: "text-violet-200 dark:text-violet-400",
    button: "",
  },
};

// ── Helpers ────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function usageColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

function usageTextColor(pct: number): string {
  if (pct >= 90) return "text-red-500";
  if (pct >= 70) return "text-yellow-500";
  return "text-green-500";
}

// ── Sub-components ─────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    pro: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
    max: "bg-violet-500/10 text-violet-500 border border-violet-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[plan] ?? colors.free}`}
    >
      {PLAN_LABELS[plan] ?? plan}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500",
    trialing: "bg-blue-500",
    canceled: "bg-red-500",
    none: "bg-muted-foreground",
  };
  const labels: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    canceled: "Canceled",
    none: "—",
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

function UsageBar({
  label,
  current,
  limit,
  overageEnabled,
}: {
  label: string;
  current: number;
  limit: number;
  overageEnabled: boolean;
}) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const overLimit = current > limit;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {overageEnabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
              overage
            </span>
          )}
          <span
            className={`tabular-nums font-medium ${overLimit ? "text-red-500" : usageTextColor(pct)}`}
          >
            {current.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${usageColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}% used</span>
        {overageEnabled && overLimit && (
          <span className="text-blue-500">
            {(current - limit).toLocaleString()} overage
          </span>
        )}
        {!overageEnabled && pct >= 90 && (
          <span className="text-red-500">Approaching limit</span>
        )}
      </div>
    </div>
  );
}

function ResourceBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const atLimit = limit > 0 && current >= limit;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={`tabular-nums font-medium ${atLimit ? "text-red-500" : limit === 0 ? "text-muted-foreground" : usageTextColor(pct)}`}
        >
          {current} / {limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${limit === 0 ? "bg-muted-foreground/30" : usageColor(pct)}`}
          style={{ width: limit > 0 ? `${pct}%` : "0%" }}
        />
      </div>
      {atLimit && (
        <div className="text-xs text-red-500">Limit reached</div>
      )}
    </div>
  );
}

function PricingCard({
  planKey,
  currentPlan,
  onUpgrade,
  onManage,
  upgrading,
  managing,
}: {
  planKey: "free" | "pro" | "max";
  currentPlan: string;
  onUpgrade: (planKey: string) => void;
  onManage: () => void;
  upgrading: string | null;
  managing: boolean;
}) {
  const isCurrent = currentPlan === planKey;
  const planOrder = ["free", "pro", "max"];
  const isHigher =
    planOrder.indexOf(planKey) > planOrder.indexOf(currentPlan);
  const colors = PLAN_COLORS[planKey];
  const isColored = planKey !== "free";

  return (
    <WobbleCard
      containerClassName={cn(colors.card, "flex-1")}
      className="flex flex-col gap-5 relative z-10"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "text-lg font-bold",
              isColored
                ? "text-white dark:text-white"
                : "text-foreground"
            )}
          >
            {PLAN_LABELS[planKey]}
          </span>
          {isCurrent && (
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
                colors.badge
              )}
            >
              Current
            </span>
          )}
          {planKey === "pro" && !isCurrent && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200 dark:bg-yellow-400/20 dark:text-yellow-300 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Popular
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-sm mt-1",
            isColored
              ? "text-white/60 dark:text-white/50"
              : "text-muted-foreground"
          )}
        >
          {PLAN_DESCRIPTIONS[planKey]}
        </p>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-4xl font-bold tracking-tight",
            isColored ? "text-white dark:text-white" : "text-foreground"
          )}
        >
          {PLAN_PRICES[planKey]}
        </span>
        <span
          className={cn(
            "text-sm",
            isColored
              ? "text-white/50 dark:text-white/40"
              : "text-muted-foreground"
          )}
        >
          / month
        </span>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {PLAN_FEATURE_LIST.map((f) => (
          <li key={f.label} className="flex items-start gap-2.5 text-sm">
            <Check
              className={cn("h-4 w-4 shrink-0 mt-0.5", colors.check)}
            />
            <span
              className={cn(
                isColored
                  ? "text-white/80 dark:text-white/70"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  isColored
                    ? "text-white dark:text-white"
                    : "text-foreground"
                )}
              >
                {f[planKey]}
              </span>{" "}
              {f.label.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="pt-1">
        {isCurrent && currentPlan !== "free" && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full gap-2",
              isColored &&
                "border-white/20 text-white hover:bg-white/10 hover:text-white"
            )}
            onClick={onManage}
            disabled={managing}
          >
            {managing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="h-3.5 w-3.5" />
            )}
            Manage Subscription
          </Button>
        )}
        {isCurrent && currentPlan === "free" && (
          <div
            className={cn(
              "text-xs text-center py-2 rounded-lg border",
              "border-neutral-200/50 text-neutral-500 dark:border-neutral-700/50 dark:text-neutral-500"
            )}
          >
            Your current plan
          </div>
        )}
        {!isCurrent && isHigher && (
          <Button
            size="sm"
            className={cn(
              "w-full gap-2 font-semibold",
              planKey === "pro" &&
                "bg-white text-blue-700 hover:bg-white/90 dark:bg-white dark:text-blue-700 dark:hover:bg-white/90",
              planKey === "max" &&
                "bg-white text-violet-700 hover:bg-white/90 dark:bg-white dark:text-violet-700 dark:hover:bg-white/90"
            )}
            onClick={() => onUpgrade(planKey)}
            disabled={upgrading !== null}
          >
            {upgrading === planKey ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Upgrade to {PLAN_LABELS[planKey]}
          </Button>
        )}
        {!isCurrent && !isHigher && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full gap-2",
              isColored &&
                "border-white/20 text-white hover:bg-white/10 hover:text-white"
            )}
            onClick={onManage}
            disabled={managing}
          >
            {managing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="h-3.5 w-3.5" />
            )}
            Manage Subscription
          </Button>
        )}
      </div>
    </WobbleCard>
  );
}

// ── Main inner component ───────────────────────────

function BillingDashboardInner() {
  const { data: session } = useSession();
  const { data: billing, loading, error, refetch } = useBillingStatus();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [portalSubs, setPortalSubs] = useState<
    { id: string; status: string; product: { name: string }; cancel_at_period_end: boolean; current_period_end: string }[] | null
  >(null);
  const [portalSession, setPortalSession] = useState<{ token: string; baseUrl: string } | null>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);

  const getPortalSession = async () => {
    const res = await fetch("/api/proxy/billing/portal-session", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to create portal session");
    return (await res.json()) as { token: string; baseUrl: string };
  };

  const handleUpgrade = async (planKey: string) => {
    setUpgrading(planKey);
    try {
      const res = await fetch("/api/proxy/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey,
          successUrl: `${window.location.origin}/account/billing?upgraded=1`,
        }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      // ignore
    } finally {
      setUpgrading(null);
    }
  };

  const handleManage = async () => {
    setManaging(true);
    try {
      const session = await getPortalSession();
      setPortalSession(session);
      const subsRes = await fetch(`${session.baseUrl}/v1/customer-portal/subscriptions/`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!subsRes.ok) throw new Error("Failed to list subscriptions");
      const subs = (await subsRes.json()) as { items: typeof portalSubs };
      setPortalSubs(subs.items ?? []);
      setShowManageDialog(true);
    } catch {
      // ignore
    } finally {
      setManaging(false);
    }
  };

  const handleCancelSub = async (subId: string) => {
    if (!portalSession) return;
    if (!confirm("Cancel your subscription? You'll keep access until the end of your billing period.")) return;
    const res = await fetch(`${portalSession.baseUrl}/v1/customer-portal/subscriptions/${subId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${portalSession.token}` },
    });
    if (res.ok) {
      setShowManageDialog(false);
      refetch();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription plan and view usage for the current billing
          period.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to load billing information. </span>
          <button
            className="underline underline-offset-2 hover:no-underline"
            onClick={refetch}
          >
            Retry
          </button>
        </div>
      )}

      {/* Current plan summary */}
      <div className="rounded-lg border divide-y">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">
                Current plan
              </div>
              {loading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <PlanBadge plan={billing?.plan ?? "free"} />
              )}
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <StatusDot status={billing?.status ?? "none"} />
          )}
        </div>

        {/* Cancellation warning */}
        {!loading && billing?.cancelAtPeriodEnd && billing.periodEnd && (
          <div className="px-4 py-3 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Subscription cancels on {formatDate(billing.periodEnd)}. You can
            reactivate from the customer portal.
          </div>
        )}

        {/* Period end */}
        {!loading && billing?.periodEnd && !billing.cancelAtPeriodEnd && (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            Current period ends {formatDate(billing.periodEnd)}
          </div>
        )}
      </div>

      {/* Usage meters */}
      <div>
        <h2 className="text-sm font-medium mb-3">Usage this period</h2>
        {loading ? (
          <div className="rounded-lg border divide-y">
            {[0, 1].map((i) => (
              <div key={i} className="px-4 py-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        ) : billing && Object.keys(billing.usage).length > 0 ? (
          <div className="rounded-lg border divide-y">
            {Object.entries(billing.usage).map(([key, metric]) => (
              <div key={key} className="px-4 py-4">
                <UsageBar
                  label={METRIC_LABELS[key] ?? key}
                  current={metric.current}
                  limit={metric.limit}
                  overageEnabled={metric.overageEnabled}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground text-center">
            No usage data available
          </div>
        )}
      </div>

      {/* Resource usage */}
      {!loading && billing?.resources && (
        <div>
          <h2 className="text-sm font-medium mb-3">Resources</h2>
          <div className="rounded-lg border divide-y">
            <div className="px-4 py-4">
              <ResourceBar
                label="Postgres databases"
                current={billing.resources.databases.current}
                limit={billing.resources.databases.limit}
              />
            </div>
            <div className="px-4 py-4">
              <ResourceBar
                label="SQLite databases"
                current={billing.resources.sqliteDbs.current}
                limit={billing.resources.sqliteDbs.limit}
              />
            </div>
          </div>
        </div>
      )}

      {/* Plan comparison — Wobble Cards */}
      <div>
        <h2 className="text-sm font-medium mb-4">Plans</h2>
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {(["free", "pro", "max"] as const).map((planKey) => (
              <PricingCard
                key={planKey}
                planKey={planKey}
                currentPlan={billing?.plan ?? "free"}
                onUpgrade={handleUpgrade}
                onManage={handleManage}
                upgrading={upgrading}
                managing={managing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Account info footer */}
      {session?.user && (
        <p className="text-xs text-muted-foreground">
          Billing account:{" "}
          <span className="font-medium">{session.user.email}</span>
        </p>
      )}

      {/* Manage subscription dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
          </DialogHeader>
          {portalSubs === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : portalSubs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No active subscriptions found.
            </p>
          ) : (
            <div className="space-y-3">
              {portalSubs.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {sub.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {sub.status}
                        {sub.cancel_at_period_end && " (cancels at period end)"}
                      </p>
                      {sub.current_period_end && (
                        <p className="text-xs text-muted-foreground">
                          Renews {formatDate(sub.current_period_end)}
                        </p>
                      )}
                    </div>
                  </div>
                  {sub.status === "active" && !sub.cancel_at_period_end && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleCancelSub(sub.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel Subscription
                    </Button>
                  )}
                  {sub.cancel_at_period_end && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      Your subscription will end at the current billing period.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BillingDashboard() {
  return (
    <AuthGate>
      <BillingDashboardInner />
    </AuthGate>
  );
}
