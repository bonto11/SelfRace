// src/features/billing/components/BillingTierSelector.tsx
"use client";

import React from "react";
import { useT } from "@/app/shared/i18n/useT";
import type { AppSubscriptionTier } from "@/app/features/billing/types/billing";

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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier) => {
        const isActive = activeTierCode === tier.code;
        // Ak užívateľ zadal zrušenie na "free", ukážeme to ako target
        const isPlannedTarget = plannedChange?.to_tier_code === tier.code;
        
        let cardClass = "card bg-base-100 border transition-all ";
        if (isActive) {
          cardClass += "border-primary shadow-md ring-1 ring-primary/20 ";
        } else if (isPlannedTarget) {
          cardClass += "border-warning border-dashed ";
        } else {
          cardClass += "border-base-content/10 hover:border-base-content/30 ";
        }

        // Lokálny preklad pre názvy tierov (ak máš pridané v sk.ts, použijeme to)
        const nameFallback = tier.name || tier.code.toUpperCase();
        
        // Zistenie, akú akciu tlačidlo robí
        let btnText = "Zvoliť plán";
        let btnClass = "btn btn-sm btn-outline";
        let btnDisabled = isBusy;

        if (isActive) {
          if (plannedChange) {
            btnText = "Aktuálny (dočasne)";
            btnDisabled = true;
          } else if (tier.code === "free") {
            btnText = "Základný plán";
            btnDisabled = true;
          } else {
            // Sme na prémium, tlačidlo pôjde na správu predplatného (Portal)
            btnText = "Spravovať plán";
            btnClass = "btn btn-sm btn-primary btn-outline";
          }
        } else if (isPlannedTarget) {
          btnText = "Plánovaný prechod";
          btnClass = "btn btn-sm btn-warning btn-outline";
          btnDisabled = true;
        } else {
          // Prechod na iný tier
          if (tier.code === "free") {
            btnText = "Zrušiť predplatné";
            btnClass = "btn btn-sm btn-outline btn-error";
          } else {
            btnText = `Aktivovať ${nameFallback}`;
            btnClass = "btn btn-sm btn-primary";
          }
        }

        return (
          <div key={tier.code} className={cardClass}>
            <div className="card-body p-5 gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="card-title text-lg flex items-center gap-2">
                    {nameFallback}
                    {isActive && !plannedChange && (
                      <span className="text-primary text-sm font-normal">
                        ✓ {t("common.set") || "aktívny"}
                      </span>
                    )}
                  </h3>
                  <div className="text-xs opacity-60 uppercase tracking-wide">
                    {tier.ai_monthly_tokens_limit > 0
                      ? `${(tier.ai_monthly_tokens_limit / 1000).toFixed(0)}k tokenov/mes.`
                      : "Základný limit"}
                  </div>
                </div>
              </div>

              <div className="text-sm opacity-80 min-h-[40px]">
                {tier.description || "Základné funkcie aplikácie bez garantovanej kvóty pre AI trénera."}
              </div>

              <div className="card-actions justify-end mt-2">
                <button
                  className={btnClass}
                  disabled={btnDisabled}
                  onClick={() => onSetTier(tier.code)}
                >
                  {isBusy && !isActive && <span className="loading loading-spinner loading-xs"></span>}
                  {btnText}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}