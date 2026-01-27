//shared/components/ui/SportBadge
"use client";

import Pill from "@/app/shared/ui/components/Pill";
import { THEME } from "@/app/shared/theme/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  swim: appColors.chartSwim,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  walk: appColors.chartWalk,
  other: appColors.chartOther,
};

const SPORT_LABELS: Record<string, string> = {
  run: "Run",
  ride: "Ride",
  swim: "Swim",
  strength: "Strength",
  mixed: "Mixed",
  skate: "Skate",
  walk: "Walk",
  other: "Other",
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
  const key = String(sport || "other").toLowerCase();
  const label = SPORT_LABELS[key] ?? SPORT_LABELS.other;
  const color = getSportColor(key);

  // jemné doladenie veľkosti cez extra classy; základ robí Pill
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
