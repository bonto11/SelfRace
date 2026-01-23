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
import { appColors } from "@/app/shared/theme/app_colors";
import {
  SECTION,
  SECTION_STYLE,
  SURFACE_INLINE,
  PANEL,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  PANEL_STACK,
  PANEL_CARD_TITLE,
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
  const [open, setOpen] = useState(true);

  const plannedChange: PlannedChange = status?.scheduled_change ?? null;
  const tiers: AppSubscriptionTier[] = status?.tiers ?? [];

  const isStatusLoading = loading === "status";
  const isAnyActionLoading = loading === "set-tier";

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
    if (!userId) return "Musíš byť prihlásený, aby si videl predplatné.";

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
  }, [userId, status, activeTierCode, plannedChange]);

  if (!userId) {
    return (
      <section className={SECTION} style={SECTION_STYLE}>
        <div className={PANEL_SECTION_HEAD}>
          <div>
            <div
              className={PANEL_SECTION_TITLE}
              style={{ color: appColors.textPrimary }}
            >
              Predplatné
            </div>
            <div
              className={PANEL_SECTION_SUBTITLE}
              style={{ color: appColors.textMuted }}
            >
              Programy, AI limity a história.
            </div>
          </div>
        </div>

        <div
          className={[SURFACE_INLINE, PANEL_PREVIEW].join(" ")}
          style={{
            background: appColors.surfaceCard,
            borderColor: appColors.surfaceCardBorder,
            color: appColors.textMuted,
          }}
        >
          Musíš byť prihlásený, aby si videl nastavenia účtu.
        </div>
      </section>
    );
  }

  return (
    <section className={SECTION} style={SECTION_STYLE}>
      <div className={PANEL_SECTION_HEAD}>
        <div>
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            Predplatné
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            Programy, AI limity a história.
          </div>
        </div>

        <DisclosureToggle
          open={open}
          onToggle={() => setOpen((v) => !v)}
          labelWhenOpen="Zbaliť predplatné"
          labelWhenClosed="Rozbaliť predplatné"
        />
      </div>

      {!open && (
        <div
          className={[SURFACE_INLINE, PANEL_PREVIEW].join(" ")}
          style={{
            background: appColors.surfaceCard,
            borderColor: appColors.surfaceCardBorder,
            color: appColors.textMuted,
          }}
        >
          {previewText}
        </div>
      )}

      {open && (
        <div className={PANEL_STACK}>
          <BillingStatusCard
            status={status}
            activeTierCode={activeTierCode}
            plannedChange={plannedChange}
            loadingStatus={isStatusLoading}
            loadingAny={isAnyActionLoading}
            error={error}
            onCancelPlannedChange={handleCancelPlannedChange}
          />

          <section
            className={PANEL}
            style={{
              background: appColors.surfaceCard,
              borderColor: appColors.surfaceCardBorder,
              color: appColors.textPrimary,
            }}
          >
            <div>
              <h2
                className={PANEL_CARD_TITLE}
                style={{ color: appColors.textPrimary }}
              >
                Programy
              </h2>
              <p
                className={PANEL_SECTION_SUBTITLE}
                style={{ color: appColors.textMuted }}
              >
                DEV režim: zvýšenie hneď, zníženie alebo prechod na free od
                ďalšieho obdobia.
              </p>
            </div>

            <BillingTierSelector
              tiers={tiers}
              activeTierCode={activeTierCode}
              plannedChange={plannedChange}
              isBusy={isAnyActionLoading}
              onSetTier={handleSetTier}
            />
          </section>

          <section
            className={PANEL}
            style={{
              background: appColors.surfaceCard,
              borderColor: appColors.surfaceCardBorder,
              color: appColors.textPrimary,
            }}
          >
            <h2
              className={PANEL_CARD_TITLE}
              style={{ color: appColors.textPrimary }}
            >
              História
            </h2>

            <BillingHistory history={history} />
          </section>
        </div>
      )}
    </section>
  );
}
