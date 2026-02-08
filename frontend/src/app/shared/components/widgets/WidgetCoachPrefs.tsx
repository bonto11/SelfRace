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

type Props = { onOpenDetail?: () => void };

const TOOLTIP_COACH_PREFS = [
  "Toto sú tréningové preferencie, z ktorých AI tréner vychádza pri tvorbe plánu.",
  "",
  "Čo tu typicky spadá:",
  "• Goal (cieľ) – čo je hlavná priorita (napr. 5 km výkon, vytrvalosť, kopce, Spartan…).",
  "• Weeks – na koľko týždňov dopredu má byť plán vygenerovaný.",
  "• Sports – ktoré športy má coach brať do úvahy (hlavný šport + doplnkové).",
  "",
  "Prečo je to dôležité:",
  "• Ak je goal nejasný alebo nesedí, plán bude „správne“ vypočítaný, ale pre zlý cieľ.",
  "• Ak chýbajú doplnkové športy, coach môže prehliadnuť bicykel/plávanie/posilku a preťažiť beh.",
  "• Weeks ovplyvní štruktúru blokov (build/peak/deload) – krátky plán vie byť agresívnejší, dlhší plán býva konzervatívnejší.",
  "",
  "Tip:",
  "• Keď meníš preferencie, ideálne potom sprav nový weekly/daily plan, aby to bolo konzistentné.",
].join("\n");

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

  return (
    <WidgetCard
      title="Tréningové preferencie"
      tooltip={TOOLTIP_COACH_PREFS}
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