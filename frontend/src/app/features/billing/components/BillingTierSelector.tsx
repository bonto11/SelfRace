// src/features/billing/components/BillingTierSelector.tsx
"use client";

import React from "react";
import { useT } from "@/app/shared/i18n/useT";
import type { AppSubscriptionTier } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";

type PlannedChange = {
  kind: "cancel" | "downgrade" | "upgrade";
  to_tier_code: string | null;
  effective_from: string | null;
} | null;

type Props = {
  tiers: AppSubscriptionTier[];
  activeTierCode: string;
  plannedChange: PlannedChange;
  isBusy: boolean;
  onSetTier: (code: string) => void;
};

export default function BillingTierSelector({
  tiers,
  activeTierCode,
  plannedChange,
  isBusy,
  onSetTier,
}: Props) {
  const t = useT();

  if (!tiers.length) {
    return (
      <div className="text-sm opacity-50 italic">
        {t("common.noData")}
      </div>
    );
  }

  const getTierColor = (code: string) => {
    switch (code) {
      case "family": return appColors.brandFamily;
      case "pro": return appColors.brandPro;
      case "classic": return appColors.brandClassic;
      default: return appColors.brandFree;
    }
  };

  // Helper na odhadnutie limitov podľa tier_code pre UI (kým si nepridáš stĺpce do DB)
  const getLimitsForUI = (code: string) => {
    if (code === "classic") return "300k IN / 50k OUT";
    if (code === "pro") return "1M IN / 150k OUT";
    if (code === "family") return "Neobmedzené";
    return "Základné limity";
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier) => {
        const isActive = activeTierCode === tier.code;
        const isPlannedTarget = plannedChange?.to_tier_code === tier.code;
        const tierColor = getTierColor(tier.code);
        
        let cardStyle: React.CSSProperties = {
          borderColor: appColors.surfaceCardBorder,
          background: appColors.surfaceCard,
        };

        if (isActive) {
          cardStyle = {
            borderColor: appColors.brandPrimary,
            background: appColors.surfaceCardHover,
            boxShadow: `0 0 15px -3px ${appColors.brandPrimary}20`,
          };
        } else if (isPlannedTarget) {
          cardStyle = {
            borderColor: appColors.statusWarning,
            borderStyle: "dashed",
            background: appColors.surfaceCard,
          };
        }

        const tierName = tier.name || tier.code.toUpperCase();
        
        let btnText = "";
        let btnVariant: "primary" | "danger" = "primary";
        let btnDisabled = isBusy;

        if (isActive) {
          if (plannedChange) {
            btnText = t("subscription.tiers.btnCurrentTemp");
            btnDisabled = true;
          } else if (tier.code === "free") {
            btnText = t("subscription.tiers.btnBasic");
            btnDisabled = true;
          } else {
            btnText = t("subscription.tiers.btnManage");
          }
        } else if (isPlannedTarget) {
          btnText = t("subscription.tiers.btnPlanned");
          btnDisabled = true;
        } else {
          if (tier.code === "free") {
            btnText = t("subscription.tiers.btnCancel");
            btnVariant = "danger";
          } else {
            btnText = t("subscription.tiers.btnActivate").replace("{{tier}}", tierName);
          }
        }

        return (
          <div key={tier.code} className="card transition-all rounded-xl border-2" style={cardStyle}>
            <div className="card-body p-6 gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="card-title text-xl flex items-center gap-2" style={{ color: isActive ? tierColor : appColors.textPrimary }}>
                    {tierName}
                    {isActive && !plannedChange && (
                      <span className="text-sm font-normal opacity-80 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {t("common.set")}
                      </span>
                    )}
                  </h3>
                  
                  {/* NOVÝ ZÁZNAM PRE LIMITY */}
                  <div className="text-xs opacity-60 uppercase tracking-widest mt-1 font-semibold">
                    {getLimitsForUI(tier.code)}
                  </div>
                  
                </div>
              </div>

              <div className="text-sm opacity-80 leading-relaxed min-h-[48px]">
                {tier.description}
              </div>

              <div className="card-actions justify-end mt-4">
                <Button
                  variant={btnVariant}
                  disabled={btnDisabled}
                  onClick={() => onSetTier(tier.code)}
                  className="w-full sm:w-auto"
                >
                  {isBusy && !isActive && <span className="loading loading-spinner loading-xs mr-2"></span>}
                  {btnText}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
