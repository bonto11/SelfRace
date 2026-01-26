// src/features/widgets/WidgetCoachPrefs.tsx
"use client";

import WidgetCard from "@/app/shared/components/components/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import SportBadge from "@/app/shared/components/components/SportBadge";
import type { SportKind } from "@/app/features/prefs/types/prefs";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  WIDGET_INFO_GRID,
  WIDGET_LABEL_MUTED,
  WIDGET_VALUE_STRONG,
  WIDGET_BADGES_WRAP,
} from "@/app/shared/ui/tokens";

type Props = { onOpenDetail?: () => void };

function pickAccent(goal?: string | null, primarySport?: string | null) {
  const g = (goal || "").toLowerCase();

  if (
    g.includes("vo2") ||
    g.includes("speed") ||
    g.includes("5k") ||
    g.includes("10k")
  ) {
    return appColors.accentTeal;
  }

  if (g.includes("fat") || g.includes("weight") || g.includes("cut")) {
    return appColors.accentLime;
  }

  if (g.includes("base") || g.includes("z2") || g.includes("endurance")) {
    return appColors.brandPrimary;
  }

  if (primarySport) {
    if (primarySport === "run") return appColors.brandPrimary;
    if (primarySport === "ride") return appColors.accentTeal;
    if (primarySport === "swim") return appColors.statusInfo;
    if (primarySport === "strength") return appColors.accentLime;
  }

  return appColors.textMuted;
}

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  const { prefs } = useCoachData();

  const mainSport = (prefs?.main_sport ?? "other") as SportKind | "other";

  const addOns: SportKind[] = Array.isArray(prefs?.add_on_sports)
    ? (prefs.add_on_sports as SportKind[])
    : [];

  const sports: string[] = [mainSport, ...addOns]
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .filter((s) => s !== "other");

  const accentHex = pickAccent(prefs?.goal_kind ?? null, mainSport);

  return (
    <WidgetCard
      title="Coach — Preferences"
      note="Tapni pre detail nastavení."
      accent={accentHex}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      <div className={WIDGET_INFO_GRID}>
        <div className={WIDGET_LABEL_MUTED}>Goal</div>
        <div className={WIDGET_VALUE_STRONG}>{prefs?.goal_kind ?? "—"}</div>

        <div className={WIDGET_LABEL_MUTED}>Weeks</div>
        <div className={WIDGET_VALUE_STRONG}>{prefs?.weeks ?? "—"}</div>

        <div className={WIDGET_LABEL_MUTED}>Sports</div>
        <div className={WIDGET_BADGES_WRAP}>
          {sports.length ? (
            sports.map((sport) => <SportBadge key={sport} sport={sport} />)
          ) : (
            <span className={WIDGET_VALUE_STRONG}>—</span>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}
