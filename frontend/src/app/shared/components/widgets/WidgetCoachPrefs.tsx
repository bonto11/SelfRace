// src/features/widgets/WidgetCoachPrefs.tsx
"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import SportBadge from "@/app/shared/ui/components/SportBadge";
import type { SportKind } from "@/app/features/prefs/types/prefs";
import {
  WIDGET_INFO_GRID,
  WIDGET_LABEL_MUTED,
  WIDGET_VALUE_STRONG,
  WIDGET_BADGES_WRAP,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type Props = { onOpenDetail?: () => void };

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  const { prefs } = useCoachData();

  const mainSport = (prefs?.main_sport ?? "other") as SportKind | "other";
  const t = useT();
  
  const addOns: SportKind[] = Array.isArray(prefs?.add_on_sports)
    ? (prefs.add_on_sports as SportKind[])
    : [];

  const sports: string[] = [mainSport, ...addOns]
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .filter((s) => s !== "other");

  return (
    <WidgetCard
      title="Tréningové preferencie"
      tooltip={t("coachPrefs.widget.tooltip")}
      note="Tapni pre detail nastavení."
      accent="none"
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