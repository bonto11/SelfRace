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

  if (!tiers.length) return <div className="text-xs opacity-50">Žiadne dáta</div>;

  const getTierTheme = (code: string) => {
    switch (code.toLowerCase()) {
      case "family": return { color: appColors.brandFamily || "#a855f7", bg: "rgba(168, 85, 247, 0.05)" };
      case "pro": return { color: appColors.brandPro || "#eab308", bg: "rgba(234, 179, 8, 0.05)" };
      case "classic": return { color: appColors.brandClassic || "#94a3b8", bg: "rgba(148, 163, 184, 0.05)" };
      default: return { color: appColors.brandFree || "#6b7280", bg: "rgba(107, 114, 128, 0.05)" };
    }
  };

  // Ľudsky čitateľné limity (namiesto čísla tokenov)
  const getHumanDescription = (code: string) => {
    switch (code.toLowerCase()) {
      case "free": return "Základný plán (Bez hĺbkových AI analýz)";
      case "classic": return "Plná AI automatizácia + cca 10 podrobných AI analýz tréningov / mesiac";
      case "pro": return "Nekonečné preplánovanie a neobmedzené detailné AI analýzy";
      case "family": return "Všetko z verzie Pro pre 4 členov rodiny";
      default: return "Základné funkcie";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {tiers.map((tier) => {
        const isActive = activeTierCode === tier.code;
        const isPlannedTarget = plannedChange?.to_tier_code === tier.code;
        const theme = getTierTheme(tier.code);
        
        const tierName = tier.name || tier.code.toUpperCase();
        
        let btnText = "Aktivovať";
        let btnVariant: "primary" | "secondary" | "danger" | "ghost" = "secondary";
        let btnDisabled = isBusy;

        if (isActive) {
          if (plannedChange) { btnText = "Aktuálny"; btnDisabled = true; btnVariant = "ghost"; }
          else if (tier.code === "free") { btnText = "Základný"; btnDisabled = true; btnVariant = "ghost"; }
          else { btnText = "Spravovať"; btnVariant = "ghost"; }
        } else if (isPlannedTarget) {
          btnText = "Naplánované"; btnDisabled = true; btnVariant = "ghost";
        } else {
          if (tier.code === "free") { btnText = "Zrušiť"; btnVariant = "danger"; }
          else { btnVariant = "primary"; }
        }

        return (
          <div 
            key={tier.code} 
            className="flex items-center justify-between p-3 rounded-lg transition-all"
            style={{ 
              border: `1px solid ${isActive ? appColors.brandPrimary : appColors.surfaceCardBorder}`,
              borderLeft: `4px solid ${isPlannedTarget ? appColors.statusWarning : theme.color}`,
              background: isActive ? appColors.surfaceCardHover : theme.bg,
            }}
          >
            {/* ĽAVÁ ČASŤ - Info */}
            <div className="flex flex-col flex-1 pr-3 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isActive ? appColors.brandPrimary : theme.color }}>
                  {tierName}
                </span>
                {isActive && !plannedChange && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/30 text-blue-400 bg-blue-500/10 uppercase">Aktívny</span>
                )}
                <span className="text-[10px] font-mono opacity-50 ml-auto whitespace-nowrap hidden sm:block">
                  {(tier.monthly_price_cents / 100).toFixed(2)} € / mes
                </span>
              </div>
              <div className="text-[10px] opacity-70 mt-0.5 truncate sm:whitespace-normal">
                {getHumanDescription(tier.code)}
              </div>
            </div>

            {/* PRAVÁ ČASŤ - Tlačidlo */}
            <div className="flex-shrink-0">
              <Button
                variant={btnVariant}
                disabled={btnDisabled}
                onClick={() => onSetTier(tier.code)}
                className="btn-xs h-8 px-3"
              >
                {isBusy && !isActive && <span className="loading loading-spinner loading-xs mr-1"></span>}
                {btnText}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
