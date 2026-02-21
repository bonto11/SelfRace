// src/features/billing/components/BillingStatusCard.tsx
"use client";

import React from "react";
import { useT } from "@/app/shared/i18n/useT";
import type { AppSubscriptionStatus } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import BillingUsageBar from "./BillingUsageBar";
import Button from "@/app/shared/ui/components/Button";

type PlannedChange = {
  kind: "cancel" | "downgrade" | "upgrade";
  to_tier_code: string | null;
  effective_from: string | null;
} | null;

type Props = {
  status: AppSubscriptionStatus | null;
  activeTierCode: string;
  plannedChange: PlannedChange;
  loadingStatus: boolean;
  loadingAny: boolean;
  error: string | null;
  onCancelPlannedChange: () => void;
};

export default function BillingStatusCard({
  status,
  activeTierCode,
  plannedChange,
  loadingStatus,
  loadingAny,
  error,
  onCancelPlannedChange,
}: Props) {
  const t = useT();

  if (loadingStatus) {
    return (
      <div className="flex justify-center p-6 rounded-xl border" style={{ borderColor: appColors.surfaceCardBorder, background: appColors.surfaceCard }}>
        <span className="loading loading-spinner text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error text-sm rounded-xl">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  const subStatus = status?.active_subscription?.status || "none";
  const currentEnd = status?.active_subscription?.current_period_end;
  const isCanceled = status?.active_subscription?.cancel_at_period_end;

  const getTierColor = (code: string) => {
    switch (code.toLowerCase()) {
      case "family": return appColors.brandFamily;
      case "pro": return appColors.brandPro;
      case "classic": return appColors.brandClassic;
      default: return appColors.brandFree;
    }
  };

  const activeColor = getTierColor(activeTierCode);

  return (
    <div className="rounded-xl border-2 p-5 space-y-4 shadow-sm transition-all" style={{ borderColor: appColors.brandPrimary, background: appColors.surfaceCard }}>
      <div className="flex flex-wrap gap-6 items-start justify-between">
        <div>
          <div className="text-sm font-medium opacity-70 mb-1">
            {t("subscription.statusCard.tierPrefix")}
          </div>
          <div className="text-2xl font-bold flex items-center gap-3 bg-transparent">
            <span style={{ color: activeColor }}>
              {activeTierCode.toUpperCase()}
            </span>
            
            {subStatus === "active" && !isCanceled && (
              <span 
                className="text-xs font-semibold px-2 py-1 rounded border tracking-wide uppercase"
                style={{ 
                  borderColor: appColors.brandPrimary, 
                  color: appColors.brandPrimary,
                  backgroundColor: "transparent"
                }}
              >
                {t("subscription.statusCard.active")}
              </span>
            )}
            {subStatus === "active" && isCanceled && (
              <span 
                className="text-xs font-semibold px-2 py-1 rounded border tracking-wide uppercase"
                style={{ 
                  borderColor: appColors.statusWarning || "#eab308", 
                  color: appColors.statusWarning || "#eab308",
                  backgroundColor: "transparent"
                }}
              >
                {t("subscription.statusCard.canceling")}
              </span>
            )}
          </div>
        </div>

        <div className="w-full max-w-[320px]">
           <BillingUsageBar 
             limitTokens={status?.ai_quota?.monthly_limit_tokens ?? undefined} 
             usedTokens={status?.ai_quota?.used_tokens_this_month ?? undefined}
             resetAt={null} 
           />
        </div>
      </div>

      {(currentEnd || plannedChange) && (
        <div className="pt-4 border-t text-sm space-y-3" style={{ borderColor: appColors.divider }}>
          {currentEnd && (
            <div className="flex justify-between items-center text-white/80">
              <span className="opacity-70">{t("subscription.statusCard.periodEnds")}</span>
              <span className="font-medium">
                {new Date(currentEnd).toLocaleDateString()}
              </span>
            </div>
          )}

          {plannedChange && (
            <div className="flex flex-col gap-3 p-4 rounded-lg border bg-yellow-500/5 border-yellow-500/20">
              <div className="flex justify-between items-center">
                <span className="text-yellow-400 font-semibold">
                  ⚠️ {t("subscription.planned.previewLabel")} ({t(`subscription.planned.kinds.${plannedChange.kind}`)}):
                </span>
                <span className="font-bold bg-transparent" style={{ color: getTierColor(plannedChange.to_tier_code || "free") }}>
                  {plannedChange.to_tier_code?.toUpperCase() || "FREE"}
                </span>
              </div>
              {plannedChange.effective_from && (
                <div className="text-xs text-yellow-400/70">
                  {t("subscription.statusCard.changeEffective")}{" "}
                  {new Date(plannedChange.effective_from).toLocaleDateString()}
                </div>
              )}

              <div className="mt-1 flex justify-end">
                <Button
                  variant="danger"
                  onClick={onCancelPlannedChange}
                  disabled={loadingAny}
                >
                  {loadingAny && <span className="loading loading-spinner loading-xs mr-2"></span>}
                  {t("subscription.statusCard.cancelChangeBtn")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}