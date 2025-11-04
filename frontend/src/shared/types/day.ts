// src/shared/types/day.ts
export const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as const;
export type DayAbbrev = typeof DAY_ORDER[number];
export type DayKey = DayAbbrev;

export type DailyItem = {
  title?: string;
  activity?: string;
  name?: string;
  duration_min?: number | null;
  duration?: number | null;
  intensity?: string | null;
  zone?: string | null;
  notes?: string | null;
  comment?: string | null;

  // voliteľné polia – nech to je "future proof"
  target_pace_min_per_km?: string | null;
  target_hr_bpm_range?: [number, number] | null;
  target_power_watts?: number | null;
  structure?: any;
};

export type DailyPlan = { day: DayKey; items: DailyItem[] };