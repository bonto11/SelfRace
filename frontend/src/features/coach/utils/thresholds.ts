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


/** Má draft reálne nejaké dáta (HR / pace / power)? */
function hasNonEmptyDraft(t: any): boolean {
  if (!t || typeof t !== "object") return false;
  const keys: Array<keyof typeof t> = ["hr_bpm", "pace_sec_km", "power_watt"];
  return keys.some((k) => t[k] != null && t[k] !== "");
}

/**
 * Vyberie počiatočný draft thresholdu:
 *  - 1. preferuje to, čo je uložené v prefs.thresholds (ak nie je prázdne)
 *  - 2. inak zoberie najnovší riadok z thresholds tabuľky
 *     (preferuje running + LT2, ak existuje)
 */
export function pickInitialThresholdDraft(
  prefsFromDB: any,
  latestRows: UserThresholdRow[] | null
): any | undefined {
  const fromPrefs = prefsFromDB?.thresholds;

  // 1) ak sú v prefs už nejaké rozumné dáta → použijeme tie
  if (hasNonEmptyDraft(fromPrefs)) {
    return {
      sport: fromPrefs.sport ?? "running",
      threshold_type: fromPrefs.threshold_type ?? "LT2",
      hr_bpm: fromPrefs.hr_bpm ?? null,
      pace_sec_km: fromPrefs.pace_sec_km ?? null,
      power_watt: fromPrefs.power_watt ?? null,
      measurement_type: fromPrefs.measurement_type ?? "estimate garmin",
    };
  }

  // 2) fallback: posledné riadky z DB
  const rows = Array.isArray(latestRows) ? latestRows : [];
  if (!rows.length) return undefined;

  const preferred =
    rows.find(
      (r) =>
        (r.sport ?? "").toLowerCase() === "running" &&
        (r.threshold_type ?? "").toUpperCase() === "LT2"
    ) ?? rows[0];

  return {
    sport: preferred.sport ?? "running",
    threshold_type: preferred.threshold_type ?? "LT2",
    hr_bpm: preferred.hr_bpm ?? null,
    pace_sec_km: preferred.pace_sec_km ?? null,
    power_watt: preferred.power_watt ?? null,
    measurement_type:
      preferred.measurement_type ??
      fromPrefs?.measurement_type ??
      "estimate garmin",
  };
}