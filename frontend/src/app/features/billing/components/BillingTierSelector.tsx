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

  // Definovanie farieb pre jednotlivé plány
  const getTierTheme = (code: string) => {
    switch (code.toLowerCase()) {
      case "family": 
        return { color: appColors.brandFamily || "#a855f7", bg: "rgba(168, 85, 247, 0.05)" }; // Fialová
      case "pro": 
        return { color: appColors.brandPro || "#eab308", bg: "rgba(234, 179, 8, 0.05)" }; // Zlatá
      case "classic": 
        return { color: appColors.brandClassic || "#94a3b8", bg: "rgba(148, 163, 184, 0.05)" }; // Strieborná/Šedá
      default: 
        return { color: appColors.brandFree || "#6b7280", bg: "rgba(107, 114, 128, 0.05)" }; // Default
    }
  };

  // Preklad tokenov do ľudskej reči
  const getHumanLimits = (code: string) => {
    switch (code.toLowerCase()) {
      case "free":
        return ["Základný plán", "Bez hĺbkových AI analýz"];
      case "classic":
        return ["Plná AI automatizácia", "~10 AI analýz tréningov / mesiac"];
      case "pro":
        return ["Nekonečné preplánovanie", "Neobmedzené AI analýzy tréningov"];
      case "family":
        return ["Pre 4 členov rodiny", "Neobmedzené AI analýzy pre všetkých"];
      default:
        return ["Základné funkcie"];
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {tiers.map((tier) => {
        const isActive = activeTierCode === tier.code;
        const isPlannedTarget = plannedChange?.to_tier_code === tier.code;
        const theme = getTierTheme(tier.code);
        
        let borderStyle = `1px solid ${appColors.surfaceCardBorder}`;
        let leftBorder = `4px solid ${theme.color}`;

        if (isActive) {
          borderStyle = `1px solid ${appColors.brandPrimary}`;
          leftBorder = `4px solid ${appColors.brandPrimary}`;
        } else if (isPlannedTarget) {
          borderStyle = `1px dashed ${appColors.statusWarning}`;
          leftBorder = `4px solid ${appColors.statusWarning}`;
        }

        const tierName = tier.name || tier.code.toUpperCase();
        
        let btnText = "";
        let btnVariant: "primary" | "danger" | "ghost" | "outline" | "secondary" = "outline";
        let btnDisabled = isBusy;

        if (isActive) {
          if (plannedChange) {
            btnText = t("subscription.tiers.btnCurrentTemp" as any) || "Aktuálny (Dočasne)";
            btnDisabled = true;
            btnVariant = "ghost";
          } else if (tier.code === "free") {
            btnText = t("subscription.tiers.btnBasic" as any) || "Základný";
            btnDisabled = true;
            btnVariant = "ghost";
          } else {
            btnText = t("subscription.tiers.btnManage" as any) || "Spravovať";
            btnVariant = "primary";
          }
        } else if (isPlannedTarget) {
          btnText = t("subscription.tiers.btnPlanned" as any) || "Naplánované";
          btnDisabled = true;
          btnVariant = "ghost";
        } else {
          if (tier.code === "free") {
            btnText = t("subscription.tiers.btnCancel" as any) || "Zrušiť predplatné";
            btnVariant = "danger";
          } else {
            btnText = t("subscription.tiers.btnActivate" as any)?.replace("{{tier}}", tierName) || "Aktivovať";
            btnVariant = "primary";
          }
        }

        // --- HACK PRE TYPESCRIPT ERROR ---
        // Naše `Button` nepodporuje prop `variant="outline"`, tak to obídeme cez `secondary` a manuálne CSS
        const actualVariant = btnVariant === "outline" ? "secondary" : btnVariant;

        return (
          <div 
            key={tier.code} 
            className="flex items-center justify-between p-3 sm:p-4 rounded-xl transition-all"
            style={{ 
              border: borderStyle,
              borderLeft: leftBorder,
              background: isActive ? appColors.surfaceCardHover : theme.bg,
              boxShadow: isActive ? `0 0 10px -3px ${appColors.brandPrimary}20` : 'none',
            }}
          >
            {/* Ľavá strana: Názov a Limity */}
            <div className="flex flex-col gap-1 pr-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold" style={{ color: isActive ? appColors.brandPrimary : theme.color }}>
                  {tierName}
                </h3>
                {isActive && !plannedChange && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {t("common.set" as any) || "Aktívny"}
                  </span>
                )}
              </div>
              
              <div className="text-xs sm:text-sm opacity-70 leading-snug flex flex-col gap-0.5" style={{ color: appColors.textPrimary }}>
                {getHumanLimits(tier.code).map((limit, idx) => (
                  <span key={idx}>• {limit}</span>
                ))}
              </div>
            </div>

            {/* Pravá strana: Tlačidlo */}
            <div className="flex-shrink-0">
              <Button
                variant={actualVariant as any} // Pretypovanie pre istotu
                disabled={btnDisabled}
                onClick={() => onSetTier(tier.code)}
                className="btn-sm min-w-[90px]"
                style={{
                  // Manuálny "outline" look, ak to bola pôvodná intencia
                  borderColor: btnVariant === "outline" ? theme.color : undefined,
                  color: btnVariant === "outline" ? theme.color : undefined,
                  backgroundColor: btnVariant === "outline" ? "transparent" : undefined
                }}
              >
                {isBusy && !isActive && <span className="loading loading-spinner loading-xs mr-2"></span>}
                {btnText}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
