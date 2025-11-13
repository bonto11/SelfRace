// src/features/widgets/WidgetCoachPrefs.tsx
"use client";

import WidgetCard from "@/shared/components/ui/WidgetCard";
import Pill from "@/shared/components/ui/Pill";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { THEME } from "@/shared/theme/tokens";

type Props = { onOpenDetail?: () => void };

const SPORT_ACCENT: Record<string, string> = {
  run: THEME.chart.run,
  ride: THEME.chart.ride,
  swim: THEME.chart.swim,
  strength: THEME.chart.strength,
  mixed: THEME.chart.mixed,
  skate: THEME.chart.skate,
  walk: THEME.chart.walk,
  other: THEME.chart.other,
};

function pickAccent(goal?: string | null, primarySport?: string | null) {
  const g = (goal || "").toLowerCase();
  if (g.includes("vo2") || g.includes("speed") || g.includes("5k") || g.includes("10k")) return THEME.chart.athletes;
  if (g.includes("fat") || g.includes("weight") || g.includes("cut")) return THEME.chart.fair;
  if (g.includes("base") || g.includes("z2") || g.includes("endurance")) return THEME.chart.fitness;
  if (primarySport && SPORT_ACCENT[primarySport]) return SPORT_ACCENT[primarySport];
  return THEME.chart.neutral;
}

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  const { prefs } = useCoachData();

  // 1) urč hlavný šport
  const mainSport: string =
    (prefs.main_sport as string) ||
    prefs.primary_sports?.[0] ||
    (prefs.sports?.[0] as string) ||
    "other";

  // 2) sekundárne aktívne športy = share > 0
  const secActive: string[] = (prefs.secondary_mix ?? [])
    .filter((s: any) => Number(s?.share_pct) > 0)
    .map((s: any) => String(s.sport));

  // 3) finálny zoznam pre UI (bez duplicit)
  const sports: string[] = [mainSport, ...secActive].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  const accentHex = pickAccent(prefs.goal_kind, mainSport);

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
        <div className="font-semibold truncate">{prefs.goal_kind ?? "—"}</div>

        <div className="opacity-75">Weeks</div>
        <div className="font-semibold">{prefs.weeks ?? "—"}</div>

        <div className="opacity-75">Sports</div>
        <div className="flex flex-wrap gap-1.5">
          {sports.length ? (
            sports.map((s) => (
              <Pill key={s} label={s} color={SPORT_ACCENT[s] ?? THEME.chart.neutral} />
            ))
          ) : (
            <span className="font-semibold">—</span>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}