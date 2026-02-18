"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation"; 
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

import { PANEL_STACK } from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors"; // Pridaný import farieb
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
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);

  const [status, setStatus] = useState<AppSubscriptionStatus | null>(null);
  const [history, setHistory] = useState<AppUserSubscription[]>([]);
  const [loading, setLoading] = useState<LoadingKind>("status");
  const [error, setError] = useState<string | null>(null);

  const [activeTierCode, setActiveTierCode] = useState<string>("free");

  const plannedChange: PlannedChange = status?.scheduled_change ?? null;
  const tiers: AppSubscriptionTier[] = status?.tiers ?? [];

  const isStatusLoading = loading === "status";
  const isAnyActionLoading = loading === "set-tier";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // SPRACOVANIE NÁVRATU ZO STRIPE (TOASTY)
  useEffect(() => {
    if (!isMounted) return;
    const paymentStatus = searchParams.get("status");
    if (paymentStatus === "success") {
      toast.success(t("subscription.toasts.paymentSuccess"));
      router.replace(pathname, { scroll: false });
    } else if (paymentStatus === "canceled") {
      toast.error(t("subscription.toasts.paymentCanceled"));
      router.replace(pathname, { scroll: false });
    }
  }, [isMounted, searchParams, pathname, router, t]);

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
        setError(t(e?.message as any) || t("api.common.fetchFailed"));
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => { alive = false; };
  }, [userId, t, isMounted]);

  useEffect(() => {
    if (!userId || !isMounted) { setHistory([]); return; }
    let alive = true;
    (async () => {
      setLoading((prev) => prev || "history");
      try {
        const h = await apiGetAppSubscriptionHistory(userId, 20);
        if (!alive) return;
        setHistory(h);
      } catch { } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();
    return () => { alive = false; };
  }, [userId, isMounted]);

  async function handleSetTier(tierCode: string) {
    if (!userId) {
      toast.error(t("api.common.missingUserAuth"));
      return;
    }
    if (!tierCode) return;

    setLoading("set-tier");
    setError(null);
    try {
      if (activeTierCode !== "free") {
        const url = await apiCreateStripePortal(userId);
        window.location.href = url;
        return;
      }
      
      const url = await apiCreateStripeCheckout(userId, tierCode);
      window.location.href = url;
    } catch (e: any) {
      const msg = t(e?.message as any) || t("api.billing.tierChangeFailed");
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
      const url = await apiCreateStripePortal(userId);
      window.location.href = url;
    } catch (e: any) {
      const msg = t(e?.message as any) || t("api.billing.cancelPlannedFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  if (!isMounted) {
    return (
      <div className="p-10 text-center opacity-50 text-sm">...</div>
    );
  }

  return (
    <div className={PANEL_STACK}>
      {!userId ? (
        <div className="text-sm opacity-80">{t("subscription.notLoggedInDesc")}</div>
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
            <section className="space-y-4">
              
              {/* ✅ Osobný Pitch Box zobrazený iba používateľom, ktorí ešte neplatia */}
              {activeTierCode === "free" && !isStatusLoading && (
                <div 
                  className="p-5 sm:p-6 rounded-2xl border-l-4 shadow-sm"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    borderColor: appColors.brandPrimary,
                  }}
                >
                  <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>
                    {t("subscription.pitch.title") || "Prečo do toho ísť?"}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                    {t("subscription.pitch.body") || "Selfrace nie je len ďalšia predplatená služba. Je to investícia do tvojho napredovania, ktorú riadi jeden z vás. Tvojím predplatným nepodporuješ akcionárov, ale ďalší vývoj funkcií, o ktoré si sám napíšeš. Daj nám šancu na jeden mesiac a uvidíš, že trénovať sa dá aj s úsmevom."}
                  </p>
                </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-2">{t("subscription.sections.tiers")}</div>
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
              <div className="text-sm font-semibold mb-2">{t("subscription.sections.history")}</div>
              <BillingHistory history={history} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}