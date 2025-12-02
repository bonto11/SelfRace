// src/features/coach/types/thresholdsTypes.ts

/** Jeden riadok z user_thresholds (normalizovaná DB štruktúra). */
export type UserThresholdRow = {
  sport: string | null;
  threshold_type: string | null;
  updated_at: string | null;
  hr_bpm: number | null;
  pace_sec_km: number | null;
  power_watt: number | null;
  measurement_type: string | null;
};