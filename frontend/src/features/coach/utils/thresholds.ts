import type { UserThresholdRow } from "@/features/coach/types/thresholdsTypes";

/** Má draft reálne nejaké dáta (HR / pace / power)? */
function hasNonEmptyDraft(t: any): boolean {
  if (!t || typeof t !== "object") return false;
  const keys: Array<keyof typeof t> = ["hr_bpm", "pace_sec_km", "power_watt"];
  return keys.some((k) => t[k] != null && t[k] !== "");
}

/**
 * Počiatočný draft thresholdu pre CoachPrefs:
 *
 *  1. PRIORITA: latestRows z DB (prefer running + LT2, ak existuje)
 *  2. fallback: prefs.thresholds (ak obsahuje nejaké dáta)
 */
export function pickInitialThresholdDraft(
  prefsFromDB: any,
  latestRows: UserThresholdRow[] | null
): any | undefined {
  const rows = Array.isArray(latestRows) ? latestRows : [];
  const fromPrefs = prefsFromDB?.thresholds;

  // 1) Najprv DB – posledné uložené thresholds
  if (rows.length > 0) {
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
      // measurement_type – ak nie je v DB, skús z prefs, inak default
      measurement_type:
        preferred.measurement_type ??
        fromPrefs?.measurement_type ??
        "estimate garmin",
    };
  }

  // 2) Fallback – staré hodnoty uložené v prefs
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

  // nič rozumné nemáme
  return undefined;
}