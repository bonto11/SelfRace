// src/features/coach/utils/thresholds.ts
import type { UserThresholdRow } from "@/features/coach/types/thresholdsTypes";

/**
 * Z ALL/LATEST spraví „latest per (sport,type)“ – pre istotu na FE.
 * Ak príde viac riadkov pre tú istú kombináciu, nechá ten s najnovším updated_at.
 */
export function reduceLatestByCombo(
  rows: UserThresholdRow[]
): UserThresholdRow[] {
  const map = new Map<string, UserThresholdRow>();

  for (const r of rows ?? []) {
    const key = `${(r.sport ?? "running").toLowerCase()}|${(
      r.threshold_type ?? "LT2"
    ).toUpperCase()}`;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, r);
      continue;
    }

    const a = Date.parse(prev.updated_at ?? "") || 0;
    const b = Date.parse(r.updated_at ?? "") || 0;
    if (b >= a) map.set(key, r);
  }

  return Array.from(map.values());
}

/** Pekný debug výpis do konzoly. */
export function debugLogLatestThresholds(rows: UserThresholdRow[]) {
  const out = rows.map((r) => ({
    sport: r.sport,
    type: r.threshold_type,
    HR: r.hr_bpm,
    pace: r.pace_sec_km,
    power: r.power_watt,
    at: r.updated_at,
  }));
  console.debug("[thresholds.latest]", out);
}