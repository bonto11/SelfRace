// src/features/coach/utils/thresholds.ts
import type { UserThresholdRow } from "@/features/coach/types/thresholdsTypes";

/**
 * Počiatočný draft thresholdu pre CoachPrefs:
 *  - vyberie najnovší riadok z latestRows (prefer running + LT2)
 *  - prefs.thresholds NEPOUŽÍVAME (zabránime tým ťahaniu starých hodnôt)
 */
export function pickInitialThresholdDraft(
  _prefsFromDB: any,
  latestRows: UserThresholdRow[] | null
): any | undefined {
  const rows = Array.isArray(latestRows) ? latestRows : [];
  if (!rows.length) return undefined;

  // preferujeme running + LT2, inak prvý riadok
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
    measurement_type: preferred.measurement_type ?? "estimate garmin",
  };
}