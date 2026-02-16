// src/features/billing/components/BillingPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetAppSubscriptionStatus,
  apiGetAppSubscriptionHistory,
  apiCreateStripeCheckout,
  apiCreateStripePortal,
} from "@/app/features/billing/api/billing";

import type {
  AppSubscriptionStatus,
  AppSubscriptionTier,
  AppUserSubscription,
} from "@/app/features/billing/types/billing";

import { setSubscriptionTier } from "@/app/shared/state/subscriptionTierStore";

import BillingStatusCard from "./BillingStatusCard";
import BillingTierSelector from "./BillingTierSelector";
import BillingHistory from "./BillingHistory";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type LoadingKind = "status" | "history" | "set-tier" | null;

type PlannedChange = {
  kind: "cancel" | "downgrade" | "upgrade";
  to_tier_code: string | null;
  effective_from: string | null;
} | null;

export default function BillingPanel() {
  const { userId } = useUserId();
  const t = useT();

  // ✅ BEZPEČNOSTNÝ ŠTÍT PRE SSR (Zabráni pádu servera)
  const [isMounted, setIsMounted] = useState(false);

  const [status, setStatus] = useState<AppSubscriptionStatus | null>(null);
  const [history, setHistory] = useState<AppUserSubscription[]>([]);
  const [loading, setLoading] = useState<LoadingKind>("status");
  const [error, setError] = useState<string | null>(null);

  const [activeTierCode, setActiveTierCode] = useState<string>("free");
  const [open, setOpen] = useState(false);

  const plannedChange: PlannedChange = status?.scheduled_change ?? null;
  const tiers: AppSubscriptionTier[] = status?.tiers ?? [];

  const isStatusLoading = loading === "status";
  const isAnyActionLoading = loading === "set-tier";

  // Tento useEffect sa spustí LEN v prehliadači.
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!userId || !isMounted) {
      setStatus(null);
      setError(null);
      setLoading(null);
      return;
    }

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
        } else {
          setStatus(null);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || t("billing.errors.loadStatus"));
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t, isMounted]);

  useEffect(() => {
    if (!userId || !isMounted) {
      setHistory([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoading((prev) => prev || "history");
      try {
        const h = await apiGetAppSubscriptionHistory(userId, 20);
        if (!alive) return;
        setHistory(h);
      } catch {
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, isMounted]);

  async function handleSetTier(tierCode: string) {
    if (!userId) {
      toast.error(t("common.errors.missingUserAuth"));
      return;
    }
    if (!tierCode) return;

    setLoading("set-tier");
    setError(null);
    try {
      if (tierCode === "free" && activeTierCode !== "free") {
        // ✅ Pridané userId
        const url = await apiCreateStripePortal(userId);
        window.location.href = url;
        return;
      }

      // ✅ Pridané userId
      const url = await apiCreateStripeCheckout(userId, tierCode);
      window.location.href = url;
    } catch (e: any) {
      const msg = e?.message || t("billing.errors.tierChangeFailed");
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
      // ✅ Pridané userId
      const url = await apiCreateStripePortal(userId);
      window.location.href = url;
    } catch (e: any) {
      const msg = e?.message || t("billing.errors.cancelPlannedFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  const previewText = useMemo(() => {
    if (!userId) return t("billing.status.notLoggedIn");
    if (loading === "status" && !status) return t("billing.status.loading");

    const tier = status?.tier_code || activeTierCode || "free";
    const parts: string[] = [
      `${t("billing.status.tierPrefix")}: ${tier.toUpperCase()}`,
    ];

    if (plannedChange?.kind) {
      const kindLabel = t(`billing.planned.kinds.${plannedChange.kind}`);
      const toTier = plannedChange.to_tier_code
        ? plannedChange.to_tier_code.toUpperCase()
        : "FREE";
      const when = plannedChange.effective_from
        ? plannedChange.effective_from.slice(0, 10)
        : null;
      parts.push(
        `${t("billing.planned.previewLabel")}: ${kindLabel} → ${toTier}${when ? ` (${when})` : ""}`,
      );
    }

    const quota = (status as any)?.ai_quota as any;
    if (quota?.monthly_limit_tokens > 0) {
      const pct = Math.round(
        (quota.used_tokens_this_month / quota.monthly_limit_tokens) * 100,
      );
      parts.push(`AI: ~${pct}%`);
    }
    return parts.join(" • ");
  }, [userId, loading, status, activeTierCode, plannedChange, t]);

  // ✅ AK EŠTE NIE SME V PREHLIADAČI (SSR) vrátime len bezpečnú škrupinu
  if (!isMounted) {
    return (
      <InputsCard
        title={t("billing.title")}
        subtitle={t("billing.subtitle")}
        preview={t("billing.status.loading")}
        open={false}
        onOpenChange={() => {}}
        backdropVariant="default"
        actions={null}
      >
        <div className="p-4 text-center opacity-50 text-sm">...</div>
      </InputsCard>
    );
  }

  return (
    <InputsCard
      title={t("billing.title")}
      subtitle={t("billing.subtitle")}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={null}
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {!userId ? (
          <div className="text-sm opacity-80">
            {t("billing.notLoggedInDesc")}
          </div>
        ) : (
          <>
            <BillingStatusCard
              status={status}
              activeTierCode={activeTierCode}
              plannedChange={plannedChange}
              loadingStatus={isStatusLoading}
              loadingAny={isAnyActionLoading}
              error={error}
              onCancelPlannedChange={handleCancelPlannedChange}
            />

            <div className={PANEL_STACK}>
              <section>
                <div className="text-sm font-semibold">
                  {t("billing.sections.tiers")}
                </div>
                <div className="mt-1 text-xs opacity-75">
                  {t("billing.devModeNote")}
                </div>
                <div className="mt-2">
                  <BillingTierSelector
                    tiers={tiers}
                    activeTierCode={activeTierCode}
                    plannedChange={plannedChange}
                    isBusy={isAnyActionLoading}
                    onSetTier={handleSetTier}
                  />
                </div>
              </section>

              <section>
                <div className="text-sm font-semibold">
                  {t("billing.sections.history")}
                </div>
                <div className="mt-2">
                  <BillingHistory history={history} />
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </InputsCard>
  );
}
