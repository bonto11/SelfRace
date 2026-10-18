// src/features/calendar/detail/RaceDayCards.tsx
"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useRaceDays, useRaceResult } from "@/app/features/calendar/hooks/useRaceDays";
import type { RunRaceTarget } from "@/app/features/prefs/types/prefs";

/**
 * Karty pretekov v daný deň (detail dňa v kalendári aj denný plán).
 * Preteky idú z cieľov usera (prefs), nie z plánu – klik vedie na ich úpravu.
 */
export default function RaceDayCards({ dateIso, className = "" }: { dateIso: string; className?: string }) {
  const t = useT();
  const router = useRouter();
  const races = useRaceDays().get(dateIso) ?? [];
  const result = useRaceResult(dateIso);
  if (!races.length) return null;

  // "✓ Odbehnuté · 11,4 km · 52:10" – beh z toho dňa = pretek
  const resultLine = (() => {
    if (!result) return null;
    const parts = [t("calendar.raceDone")];
    if (result.distance_m) parts.push(`${(result.distance_m / 1000).toFixed(1).replace(".", ",")} km`);
    const sec = Number(result.moving_time_s ?? result.elapsed_time_s ?? 0);
    if (sec > 0) {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s2 = String(sec % 60).padStart(2, "0");
      parts.push(h ? `${h}:${String(m).padStart(2, "0")}:${s2}` : `${m}:${s2}`);
    }
    return `✓ ${parts.join(" · ")}`;
  })();

  // "10 km · Terén · +450 m · Priorita A · cieľ 0:45:00"
  const raceLine = (r: RunRaceTarget): string => {
    const parts: string[] = [];
    if ((r.race_goal === "other" || r.race_goal === "ultra") && r.custom_distance_km) {
      parts.push(`${r.custom_distance_km} km`);
    } else if (r.race_goal) {
      parts.push(t(`prefs.sections.goalSection.enums.race.${r.race_goal}` as any));
    }
    if (r.race_type) parts.push(t(`prefs.sections.goalSection.enums.type.${r.race_type}` as any));
    if (r.elevation_gain_m) parts.push(`+${r.elevation_gain_m} m`);
    if (r.priority) parts.push(fmt(t("calendar.racePriority"), { p: r.priority }));
    if (r.target_time) parts.push(fmt(t("calendar.raceTarget"), { time: r.target_time }));
    return parts.join(" · ");
  };

  return (
    <ul className={`space-y-2 ${className}`}>
      {races.map((r, i) => {
        const line = raceLine(r);
        return (
          <li key={`race-${r.id ?? i}`}>
            <button
              type="button"
              // odbehnutý pretek otvorí aktivitu, budúci jeho nastavenie
              onClick={() =>
                router.push(result ? `/activities/detail/${result.activity_id}` : "/coach/prefs")
              }
              className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors cursor-pointer"
              style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.brandPrimary}` }}
            >
              <span
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                style={{ background: appColors.surfaceSolid }}
                aria-hidden="true"
              >
                🏆
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate" style={{ color: appColors.textPrimary }}>
                  {r.name?.trim() || t("calendar.race")}
                </span>
                {line ? (
                  <span className="block text-xs" style={{ color: appColors.textMuted }}>
                    {line}
                  </span>
                ) : null}
                {resultLine ? (
                  <span className="block text-xs font-semibold" style={{ color: appColors.brandPrimary }}>
                    {resultLine}
                  </span>
                ) : null}
              </span>
              <ChevronRight size={16} color={appColors.textMuted} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
