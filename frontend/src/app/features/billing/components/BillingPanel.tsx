"use client";

import { useEffect, useState } from "react";
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
import { appColors } from "@/app/shared/ui/theme/app_colors";
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
  
  const allTiers: AppSubscriptionTier[] = status?.tiers ?? [];
  const visibleTiers = allTiers.filter(
    (tier) => tier.code !== "family" || tier.code === activeTierCode
  );

  const isStatusLoading = loading === "status";
  const isAnyActionLoading = loading === "set-tier";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const paymentStatus = searchParams.get("status");
    if (paymentStatus === "success") {
      toast.success(t("subscription.toasts.paymentSuccess" as any) || "Platba prebehla úspešne.");
      router.replace(pathname, { scroll: false });
    } else if (paymentStatus === "canceled") {
      toast.error(t("subscription.toasts.paymentCanceled" as any) || "Platba bola zrušená.");
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
        setError(t(e?.message as any) ?? t("api.common.fetchFailed"));
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
      if (tierCode === activeTierCode && activeTierCode !== "free") {
        try {
          const url = await apiCreateStripePortal(userId);
          window.location.href = url;
          return;
        } catch (portalError: any) {
          const checkoutUrl = await apiCreateStripeCheckout(userId, tierCode);
          window.location.href = checkoutUrl;
          return;
        }
      }
      
      const url = await apiCreateStripeCheckout(userId, tierCode);
      window.location.href = url;
    } catch (e: any) {
      const msg = t(e?.message as any) ?? t("api.billing.tierChangeFailed");
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
      const msg = t(e?.message as any) ?? t("api.billing.cancelPlannedFailed");
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
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
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

          <div className="flex flex-col gap-4">
            <section>
              <BillingTierSelector
                tiers={visibleTiers}
                activeTierCode={activeTierCode}
                plannedChange={plannedChange}
                isBusy={isAnyActionLoading}
                onSetTier={handleSetTier}
              />
            </section>

            <section className="pt-2">
              <div className="text-[11px] font-bold mb-2 tracking-wide uppercase opacity-50">
                {t("subscription.sections.history" as any) || "História platieb"}
              </div>
              <BillingHistory history={history} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
