// src/features/coach/types/zonesTypes.ts

export type ZoneSport = "running" | "cycling" | "other";

/** Normalizovaný výstup z BE – aktuálne zóny pre daný šport. */
export type ZonesOut = {
  sport: ZoneSport;
  hr_max: number | null;
  z1_min: number | null; z1_max: number | null;
  z2_min: number | null; z2_max: number | null;
  z3_min: number | null; z3_max: number | null;
  z4_min: number | null; z4_max: number | null;
  z5_min: number | null; z5_max: number | null;
  created_at?: string | null;
};