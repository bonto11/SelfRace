// src/app/shared/components/ui/SportBadge.tsx
"use client";

import Pill from "@/app/shared/ui/components/Pill";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

export const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  bike: appColors.chartBike,
  swim: appColors.chartSwim,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  walk: appColors.chartWalk,
  football: appColors.chartOther, // Priradené k iným, ak nemáš extra farbu
  other: appColors.chartOther,
};

export type SportBadgeSize = "sm" | "md";

type Props = {
  sport: string;
  size?: SportBadgeSize;
  className?: string;
  outline?: boolean;
};

export function getSportColor(sport: string): string {
  const key = String(sport || "other").toLowerCase();
  return SPORT_COLORS[key] ?? SPORT_COLORS.other;
}

export default function SportBadge({
  sport,
  size = "sm",
  className,
  outline = false,
}: Props) {
  const t = useT();
  const key = String(sport || "other").toLowerCase();
  
  // Získame preklad z common.sports. Ak kľúč neexistuje, vráti sa "Iné"
  const labelKey = `common.sports.${key}`;
  const translated = t(labelKey as any);
  const label = translated === labelKey ? t("common.sports.other" as any) : translated;

  const color = getSportColor(key);

  // Jemné doladenie veľkosti cez extra classy; základ robí Pill
  const sizeCls =
    size === "md" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5";

  return (
    <Pill
      label={label}
      color={color}
      outline={outline}
      className={[sizeCls, className || ""].join(" ")}
      title={label}
    />
  );
}