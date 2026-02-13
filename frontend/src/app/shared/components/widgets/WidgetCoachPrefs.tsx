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
  const t = useT();

  const mainSport = (prefs?.main_sport ?? "other") as SportKind | "other";

  const addOns: SportKind[] = Array.isArray(prefs?.add_on_sports)
    ? (prefs.add_on_sports as SportKind[])
    : [];

  const sports: string[] = [mainSport, ...addOns]
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .filter((s) => s !== "other");

  // Preklad cieľa z enumu, ktorý sme definovali v GoalSection
  const goalLabel = prefs?.goal_kind 
    ? (t as any)(`prefs.sections.goalSection.enums.overall.${prefs.goal_kind}`)
    : "—";

  return (
    <WidgetCard
      title={t("coachPrefs.widget.title")}
      tooltip={t("coachPrefs.widget.tooltip")}
      note={t("coachPrefs.widget.note")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      <div className={WIDGET_INFO_GRID}>
        <div className={WIDGET_LABEL_MUTED}>{t("coachPrefs.labels.goal")}</div>
        <div className={WIDGET_VALUE_STRONG}>{goalLabel}</div>

        <div className={WIDGET_LABEL_MUTED}>{t("coachPrefs.labels.weeks")}</div>
        <div className={WIDGET_VALUE_STRONG}>{prefs?.weeks ?? "—"}</div>

        <div className={WIDGET_LABEL_MUTED}>{t("coachPrefs.labels.sports")}</div>
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