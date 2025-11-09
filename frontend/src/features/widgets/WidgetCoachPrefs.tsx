// src/features/widgets/WidgetCoachPrefs.tsx
"use client";

import WidgetCard from "@/shared/components/ui/WidgetCard";
import Pill from "@/shared/components/ui/Pill";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { THEME } from "@/shared/theme/tokens";

// LIVE hook (dal si ho do utils):
import useCoachPrefsLive from "@/features/coach/utils/useCoachPrefsLive";

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
  if (g.includes("vo2") || g.includes("speed") || g.includes("5k") || g.includes("10k"))
    return THEME.chart.athletes;
  if (g.includes("fat") || g.includes("weight") || g.includes("cut"))
    return THEME.chart.fair;
  if (g.includes("base") || g.includes("z2") || g.includes("endurance"))
    return THEME.chart.fitness;
  if (primarySport && SPORT_ACCENT[primarySport]) return SPORT_ACCENT[primarySport];
  return THEME.chart.neutral;
}

function fmtWeeks(v: unknown): string {
  const n = typeof v === "number" && isFinite(v) ? v : null;
  if (n === null) return "—";
  // zachovaj 0 ak by si niekedy chcel „týždeň 0“ (napr. setup)
  return String(n);
}

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  // 1) zdroj z provideru (pôvodné správanie)
  const { prefs: ctxPrefs } = useCoachData();
  // 2) LIVE prefs (z localStorage + custom event) – má prednosť
  const livePrefs = useCoachPrefsLive();
  // zlúč, aby si nestratil staré polia z provideru
  const prefs = { ...(ctxPrefs ?? {}), ...(livePrefs ?? {}) } as any;

  // športy (legacy aj nové)
  const sports: string[] = (prefs.primary_sports ?? prefs.sports ?? []) as string[];

  // hlavný šport z nového poľa, fallback na prvý zo zoznamu
  const mainSport: string = (prefs.main_sport as string) || sports?.[0] || "other";
  const accentHex = pickAccent(prefs.goal_kind, mainSport);

  // sekundárny mix (nové pole): [{ sport, role, share_pct }]
  const secondary: Array<{ sport: string; role: string; share_pct: number }> =
    (prefs.secondary_mix ?? []) as any[];

  // ak nemáš secondary_mix, skús aspoň zobraziť zvyšné športy bez percent
  const fallbackSecondary = !secondary?.length
    ? (sports || []).filter((s) => s !== mainSport).map((s) => ({ sport: s, role: "supplement", share_pct: 0 }))
    : [];

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
        <div className="font-semibold tabular-nums">{fmtWeeks(prefs.weeks)}</div>

        {/* Hlavný šport */}
        <div className="opacity-75">Main sport</div>
        <div className="font-semibold">
          <Pill
            label={String(mainSport)}
            color={SPORT_ACCENT[mainSport] ?? THEME.chart.neutral}
          />
        </div>

        {/* Primárne (legacy) – stále zobrazíme, aby si videl celé nastavenie */}
        <div className="opacity-75">Sports</div>
        <div className="flex flex-wrap gap-1.5">
          {sports.length ? (
            sports.map((s) => (
              <Pill
                key={s}
                label={s}
                color={SPORT_ACCENT[s] ?? THEME.chart.neutral}
              />
            ))
          ) : (
            <span className="font-semibold">—</span>
          )}
        </div>

        {/* Sekundárny mix (nové) */}
        {(secondary?.length || fallbackSecondary.length) ? (
          <>
            <div className="opacity-75">Secondary mix</div>
            <div className="flex flex-wrap gap-1.5">
              {(secondary?.length ? secondary : fallbackSecondary).map((s) => (
                <Pill
                  key={s.sport}
                  label={
                    s.share_pct
                      ? `${s.sport} • ${s.role} • ${s.share_pct}%`
                      : `${s.sport} • ${s.role}`
                  }
                  color={SPORT_ACCENT[s.sport] ?? THEME.chart.neutral}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </WidgetCard>
  );
}