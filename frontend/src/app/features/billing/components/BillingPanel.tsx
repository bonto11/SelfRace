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

import InputsCard from "@/app/shared/components/ui/InputsCard";

import {
  INPUTS_CARD_BODY,
  PANEL_STACK,
} from "@/app/shared/ui/tokens";

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

  // InputsCard default: closed
  const [open, setOpen] = useState(false);

  const plannedChange: PlannedChange = status?.scheduled_change ?? null;
  const tiers: AppSubscriptionTier[] = status?.tiers ?? [];

  const isStatusLoading = loading === "status";
  const isAnyActionLoading = loading === "set-tier";

  // --- load status ---
  useEffect(() => {
    if (!userId) {
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
          // fallback
          setStatus(null);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Nepodarilo sa načítať stav predplatného.");
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // --- load history ---
  useEffect(() => {
    if (!userId) {
      setHistory([]);
      return;
    }

    let alive = true;

    (async () => {
      // nech neprepisuje "status" loading ak beží
      setLoading((prev) => prev || "history");
      try {
        const h = await apiGetAppSubscriptionHistory(userId, 20);
        if (!alive) return;
        setHistory(h);
      } catch {
        // len info
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  async function handleSetTier(tierCode: string) {
    if (!userId) {
      toast.error("Chýba používateľ – prihlás sa znova.");
      return;
    }
    if (!tierCode) return;

    setLoading("set-tier");
    setError(null);
    try {
      await apiSetAppSubscriptionTierManual(userId, tierCode);
      toast.success("Program bol zmenený.");

      const st = await apiGetAppSubscriptionStatus(userId);
      const code = st?.tier_code || tierCode;

      setStatus(st);
      setActiveTierCode(code);
      setSubscriptionTier(code);

      const h = await apiGetAppSubscriptionHistory(userId, 20);
      setHistory(h);
    } catch (e: any) {
      const msg = e?.message || "Nepodarilo sa zmeniť program.";
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
      toast.success("Plánovaná zmena bola zrušená.");

      const st = await apiGetAppSubscriptionStatus(userId);
      const code = st?.tier_code || "free";

      setStatus(st);
      setActiveTierCode(code);
      setSubscriptionTier(code);

      const h = await apiGetAppSubscriptionHistory(userId, 20);
      setHistory(h);
    } catch (e: any) {
      const msg = e?.message || "Nepodarilo sa zrušiť plánovanú zmenu.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  const previewText = useMemo(() => {
    if (!userId) return "Neprihlásený.";

    // keď je zatvorené, toto je dosť podstatné aby to neklamalo
    if (loading === "status" && !status) return "Načítavam stav predplatného…";

    const tier = status?.tier_code || activeTierCode || "free";
    const parts: string[] = [`Program: ${tier.toUpperCase()}`];

    if (plannedChange?.kind) {
      const kindLabel =
        plannedChange.kind === "upgrade"
          ? "zvýšenie"
          : plannedChange.kind === "downgrade"
            ? "zníženie"
            : "zrušenie";

      const toTier = plannedChange.to_tier_code
        ? plannedChange.to_tier_code.toUpperCase()
        : "FREE";

      const when = plannedChange.effective_from
        ? plannedChange.effective_from.slice(0, 10)
        : null;

      parts.push(`Plán: ${kindLabel} → ${toTier}${when ? ` (${when})` : ""}`);
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
      parts.push(`AI: ~${pct}%`);
    }

    return parts.join(" • ");
  }, [userId, loading, status, activeTierCode, plannedChange]);

  const disabledNoUser = !userId;

  return (
    <InputsCard
      title="Predplatné"
      subtitle="Programy, AI limity a história."
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={null}
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {disabledNoUser ? (
          <div className="text-sm opacity-80">
            Musíš byť prihlásený, aby si videl nastavenia účtu.
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
                <div className="text-sm font-semibold">Programy</div>
                <div className="mt-1 text-xs opacity-75">
                  DEV režim: zvýšenie hneď, zníženie alebo prechod na free od
                  ďalšieho obdobia.
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
                <div className="text-sm font-semibold">História</div>
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