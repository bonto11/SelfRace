"use client";

/*
 * Preteky z coach prefs (targets.run.races) po dňoch. PREČO z prefs a nie
 * z plánu: preteky sú cieľ usera, nie tréning - v pláne ich nemusí byť
 * (advisor, plán ešte nebeží), a v kalendári ich chce vidieť vždy.
 */

import * as React from "react";
import { useCoachDataOptional } from "@/app/shared/components/dataProviders/CoachDataProvider";
import type { RunRaceTarget } from "@/app/features/prefs/types/prefs";

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
