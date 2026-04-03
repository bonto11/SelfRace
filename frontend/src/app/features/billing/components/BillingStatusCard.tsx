"use client";

import React from "react";
import { useT } from "@/app/shared/i18n/useT";
import type { BillingStatusCardProps } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import BillingUsageBar from "./BillingUsageBar";
import Button from "@/app/shared/ui/components/Button";

export default function BillingStatusCard({
  status,
  activeTierCode,
  plannedChange,
  loadingStatus,
  loadingAny,
  error,
  onCancelPlannedChange,
}: BillingStatusCardProps) {
  const t = useT();

  if (loadingStatus) {
    return (
      <div className="flex justify-center p-4 rounded-xl border" style={{ borderColor: appColors.surfaceCardBorder, background: appColors.surfaceCard }}>
        <span className="loading loading-spinner loading-sm text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error text-xs rounded-xl p-3">
        <span>{error}</span>
      </div>
    );
  }

  const subStatus = status?.active_subscription?.status || "none";
  const currentEnd = status?.active_subscription?.current_period_end;
  const isCanceled = status?.active_subscription?.cancel_at_period_end;

  const getTierColor = (code: string) => {
    switch (code.toLowerCase()) {
      case "family": return appColors.brandFamily || "#a855f7";
      case "pro": return appColors.brandPro || "#eab308";
      case "classic": return appColors.brandClassic || "#94a3b8";
      default: return appColors.brandFree || "#6b7280";
    }
  };

  const activeColor = getTierColor(activeTierCode);

  return (
    <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: appColors.surfaceCardBorder, background: appColors.surfaceCard }}>
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        {/* TIER INFO */}
        <div className="flex-shrink-0 text-center sm:text-left w-full sm:w-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5">
            {t("subscription.statusCard.tierPrefix" as any) || "Aktuálny plán"}
          </div>
          <div className="text-xl font-bold flex items-center justify-center sm:justify-start gap-2">
            <span style={{ color: activeColor }}>
              {activeTierCode.toUpperCase()}
            </span>
            
            {subStatus === "active" && !isCanceled && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border uppercase" style={{ borderColor: appColors.brandPrimary, color: appColors.brandPrimary }}>
                {t("subscription.statusCard.active" as any) || "Aktívny"}
              </span>
            )}
            {subStatus === "active" && isCanceled && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border uppercase" style={{ borderColor: appColors.statusWarning || "#eab308", color: appColors.statusWarning || "#eab308" }}>
                {t("subscription.statusCard.canceling" as any) || "Ruší sa"}
              </span>
            )}
          </div>
          
          {currentEnd && (
            <div className="text-[10px] opacity-60 mt-1">
              Obnova: {new Date(currentEnd).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* USAGE BARS (Kompaktné) */}
        <div className="w-full sm:max-w-[280px]">
           <BillingUsageBar aiQuota={status?.ai_quota} />
        </div>
      </div>

      {/* PLANNED CHANGE (Kompaktné) */}
      {plannedChange && (
        <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="text-xs">
            <span className="text-yellow-500 font-bold mr-2">Zmena plánu:</span>
            <span className="font-bold uppercase" style={{ color: getTierColor(plannedChange.to_tier_code || "free") }}>
              {plannedChange.to_tier_code || "FREE"}
            </span>
            {plannedChange.effective_from && (
              <span className="opacity-70 ml-2">od {new Date(plannedChange.effective_from).toLocaleDateString()}</span>
            )}
          </div>
          <Button variant="ghost" onClick={onCancelPlannedChange} disabled={loadingAny} className="btn-xs text-red-400">
            {loadingAny ? "..." : "Zrušiť zmenu"}
          </Button>
        </div>
      )}
    </div>
  );
}
