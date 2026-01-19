// src/features/widgets/WidgetCoachPrefs.tsx
"use client";

import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { THEME } from "@/app/shared/theme/tokens";
import SportBadge from "@/app/shared/components/ui/SportBadge";
import type { SportKind } from "@/app/features/prefs/types/prefs";

type Props = { onOpenDetail?: () => void };

function pickAccent(goal?: string | null, primarySport?: string | null) {
  const g = (goal || "").toLowerCase();
  if (
    g.includes("vo2") ||
    g.includes("speed") ||
    g.includes("5k") ||
    g.includes("10k")
  )
    return THEME.chart.athletes;
  if (g.includes("fat") || g.includes("weight") || g.includes("cut"))
    return THEME.chart.fair;
  if (g.includes("base") || g.includes("z2") || g.includes("endurance"))
    return THEME.chart.fitness;
  if (primarySport && (THEME.chart as any)[primarySport]) {
    return (THEME.chart as any)[primarySport] as string;
  }
  return THEME.chart.neutral;
}

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  const { prefs } = useCoachData();

  // NEW schema: main_sport + add_on_sports
  const mainSport = (prefs?.main_sport ?? "other") as SportKind | "other";

  const addOns: SportKind[] = Array.isArray(prefs?.add_on_sports)
    ? (prefs.add_on_sports as SportKind[])
    : [];

  // finálny zoznam bez duplicit + safety (add-ons nesmie obsahovať main)
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
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div className="opacity-75">Goal</div>
        <div className="font-semibold truncate">{prefs?.goal_kind ?? "—"}</div>

        <div className="opacity-75">Weeks</div>
        <div className="font-semibold">{prefs?.weeks ?? "—"}</div>

        <div className="opacity-75">Sports</div>
        <div className="flex flex-wrap gap-1.5">
          {sports.length ? (
            sports.map((sport) => <SportBadge key={sport} sport={sport} />)
          ) : (
            <span className="font-semibold">—</span>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}