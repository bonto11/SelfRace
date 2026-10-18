"use client";

/*
 * Preteky z coach prefs (targets.run.races) po dňoch. PREČO z prefs a nie
 * z plánu: preteky sú cieľ usera, nie tréning - v pláne ich nemusí byť
 * (advisor, plán ešte nebeží), a v kalendári ich chce vidieť vždy.
 */

import * as React from "react";
import { useCoachDataOptional } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useActivityDataOptional } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import type { RunRaceTarget } from "@/app/features/prefs/types/prefs";
import type { ActivityRow } from "@/app/features/activities/types/activities";

/** Bežecká aktivita (beh, trail) – tá v deň pretekov = odbehnutý pretek. */
export function isRaceSport(sport: unknown): boolean {
  const v = String(sport ?? "").toLowerCase();
  return v.includes("run") || v.includes("trail");
}

const NO_RACES = new Map<string, RunRaceTarget[]>();

export function useRaceDays(): Map<string, RunRaceTarget[]> {
  const coach = useCoachDataOptional();
  const races = coach?.prefs?.targets?.run?.races;
  return React.useMemo(() => {
    if (!Array.isArray(races) || !races.length) return NO_RACES;
    const map = new Map<string, RunRaceTarget[]>();
    for (const r of races) {
      const d = String(r?.date ?? "").slice(0, 10);
      if (d.length !== 10) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(r);
    }
    return map;
  }, [races]);
}

/**
 * Odbehnutý pretek = najdlhšia bežecká aktivita v deň pretekov. PREČO pri
 * čítaní (ako externé aktivity): preteky nie sú riadky plánu, nie je čo
 * spárovať v DB a dátum + šport stačí.
 */
export function useRaceResult(dateIso: string): ActivityRow | null {
  const act = useActivityDataOptional();
  const select = act?.selectByRange;
  return React.useMemo(() => {
    if (!select) return null;
    const runs = (select(dateIso, dateIso) as ActivityRow[]).filter((r) =>
      isRaceSport(r.sport_type_ovrd ?? r.sport_type_fe ?? r.sport_type),
    );
    if (!runs.length) return null;
    return runs.reduce((a, b) => ((b.distance_m ?? 0) > (a.distance_m ?? 0) ? b : a));
  }, [select, dateIso]);
}
