// Typy a základné konštanty pre tréningový plán (FE-only)

/** Poradie dní – používa sa na generovanie DayKey aj na UI. */
export const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Kľúč dňa v týždni (Mon..Sun) používaný v FE pláne. */
export type DayKey = (typeof DAY_ORDER)[number];

export type DailyItem = {
  title?: string;
  activity?: string; // "run" | "ride" | "strength" | ... (voľné texty z AI)
  duration_min?: number | null;
  duration?: number | null;
  intensity?: string | null;
  zone?: string | null;
  notes?: string | null;
  target_pace_min_per_km?: string | null;
  target_hr_bpm_range?: [number, number] | null;
  target_power_watts?: number | null;
  structure?: any;
  focus?: string;
};

/** Jednoduchý denný plán – deň + pole session itemov. */
export type DailyPlan = { day: DayKey; items: DailyItem[] };