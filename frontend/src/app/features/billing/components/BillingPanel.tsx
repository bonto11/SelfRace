// src/features/billing/components/BillingPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { toast } from "@/app/shared/components/ui/Toast";

import {
  apiGetAppSubscriptionStatus,
  apiGetAppSubscriptionHistory,
  apiSetAppSubscriptionTierManual,
  apiCancelPlannedSubscriptionChange,
} from "@/app/features/billing/api/billing";

import type {
  AppSubscriptionStatus,
  AppSubscriptionTier,
  AppUserSubscription,
} from "@/app/features/billing/types/billing";

import {
  getSubscriptionTier,
  setSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";

import BillingStatusCard from "./BillingStatusCard";
import BillingTierSelector from "./BillingTierSelector";
import BillingHistory from "./BillingHistory";

import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/tokens";

type LoadingKind = "status" | "history" | "set-tier" | null;

type PlannedChange = {
  kind: "cancel" | "downgrade" | "upgrade";
  to_tier_code: string | null;
  effective_from: string | null;
} | null;

export default function BillingPanel() {
  const { userId } = useUserId();
  const [status, setStatus] = useState<AppSubscriptionStatus | null>(null);
  const [history, setHistory] = useState<AppUserSubscription[]>([]);
  const [loading, setLoading] = useState<LoadingKind>("status");
  const [error, setError] = useState<string | null>(null);
  const [activeTierCode, setActiveTierCode] = useState<string>(
    () => getSubscriptionTier() || "free"
  );
  const [open, setOpen] = useState(true);

  const plannedChange: PlannedChange = status?.scheduled_change ?? null;
  const tiers: AppSubscriptionTier[] = status?.tiers ?? [];

  const isStatusLoading = loading === "status";
  const isAnyActionLoading = loading === "set-tier";

  // --------- LOAD STATUS ----------
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading("status");
      setError(null);
      try {
        const st = await apiGetAppSubscriptionStatus(userId);
        if (!alive) return;
        if (st) {
          const code = st.tier_code || "free";
          setStatus(st);
          setActiveTierCode(code);
          setSubscriptionTier(code);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load subscription status.");
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // --------- LOAD HISTORY ----------
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading((prev) => prev || "history");
      try {
        const h = await apiGetAppSubscriptionHistory(userId, 20);
        if (!alive) return;
        setHistory(h);
      } catch {
        // history je len info, chybu ignorujeme
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // --------- ACTIONS ----------
  async function handleSetTier(tierCode: string) {
    if (!userId) {
      toast.error("Missing user id.");
      return;
    }
    if (!tierCode) return;

    setLoading("set-tier");
    setError(null);
    try {
      await apiSetAppSubscriptionTierManual(userId, tierCode);
      toast.success(`Tier switched to "${tierCode}".`);

      const st = await apiGetAppSubscriptionStatus(userId);
      const code = st?.tier_code || tierCode;

      setStatus(st);
      setActiveTierCode(code);
      setSubscriptionTier(code);

      const h = await apiGetAppSubscriptionHistory(userId, 20);
      setHistory(h);
    } catch (e: any) {
      const msg = e?.message || "Failed to set subscription tier.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  async function handleCancelPlannedChange() {
    if (!userId) return;

    setLoading("set-tier");
    setError(null);
    try {
      await apiCancelPlannedSubscriptionChange(userId);
      toast.success("Plánovaná zmena zrušená. Zostáva aktuálny program.");

      const st = await apiGetAppSubscriptionStatus(userId);
      const code = st?.tier_code || "free";

      setStatus(st);
      setActiveTierCode(code);
      setSubscriptionTier(code);

      const h = await apiGetAppSubscriptionHistory(userId, 20);
      setHistory(h);
    } catch (e: any) {
      const msg = e?.message || "Failed to cancel scheduled change.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  const previewText = useMemo(() => {
    if (!userId) return "Musíš byť prihlásený, aby si videl billing.";

    const tier = status?.tier_code || activeTierCode || "free";

    const parts: string[] = [`Tier: ${tier.toUpperCase()}`];

    if (plannedChange?.kind) {
      const kindLabel =
        plannedChange.kind === "upgrade"
          ? "upgrade"
          : plannedChange.kind === "downgrade"
          ? "downgrade"
          : "cancel";
      const toTier = plannedChange.to_tier_code
        ? plannedChange.to_tier_code.toUpperCase()
        : "FREE";
      const when = plannedChange.effective_from
        ? plannedChange.effective_from.slice(0, 10)
        : null;
      parts.push(`Planned ${kindLabel} → ${toTier}${when ? ` (${when})` : ""}`);
    }

    const quota = (status as any)?.ai_quota as
      | {
          monthly_limit_tokens?: number | null;
          used_tokens_this_month?: number | null;
        }
      | undefined;

    if (
      quota &&
      typeof quota.monthly_limit_tokens === "number" &&
      quota.monthly_limit_tokens > 0 &&
      typeof quota.used_tokens_this_month === "number"
    ) {
      const pct = Math.round(
        (quota.used_tokens_this_month / quota.monthly_limit_tokens) * 100
      );
      parts.push(`AI usage ~${pct}%`);
    }

    return parts.join(" • ");
  }, [userId, status, activeTierCode, plannedChange]);

  // --------- RENDER ----------

  if (!userId) {
    return (
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">
            Billing & Subscription
          </div>
        </div>
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-70 select-none",
          ].join(" ")}
        >
          Musíš byť prihlásený, aby si videl nastavenia účtu.
        </div>
      </section>
    );
  }

  return (
    <section className={SECTION}>
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium opacity-90">
            Billing & Subscription
          </div>
          <div className="text-xs opacity-70">
            Tiers, AI limity a história fakturácie.
          </div>
        </div>

        <DisclosureToggle
          open={open}
          onToggle={() => setOpen((v) => !v)}
          labelWhenOpen="Collapse billing section"
          labelWhenClosed="Expand billing section"
        />
      </div>

      {/* closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-70 select-none",
          ].join(" ")}
        >
          {previewText}
        </div>
      )}

      {/* obsah billing-u */}
      {open && (
        <div className="space-y-6">
          {/* 1) Status + usage bar + cancel planned change */}
          <BillingStatusCard
            status={status}
            activeTierCode={activeTierCode}
            plannedChange={plannedChange}
            loadingStatus={isStatusLoading}
            loadingAny={isAnyActionLoading}
            error={error}
            onCancelPlannedChange={handleCancelPlannedChange}
          />

          {/* 2) Tiers grid */}
          <section className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Tiers</h2>
                <p className="text-xs opacity-70">
                  DEV: upgrade hneď, downgrade alebo prechod na free od ďalšieho
                  obdobia.
                </p>
              </div>
            </div>

            <BillingTierSelector
              tiers={tiers}
              activeTierCode={activeTierCode}
              plannedChange={plannedChange}
              isBusy={isAnyActionLoading}
              onSetTier={handleSetTier}
            />
          </section>

          {/* 3) History */}
          <section className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">History</h2>
            </div>

            <BillingHistory history={history} />
          </section>
        </div>
      )}
    </section>
  );
}
