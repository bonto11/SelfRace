// src/features/coach/types/day.ts
export type DayAbbrev = "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun";
export const DAY_ORDER: DayAbbrev[] = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// spätná kompatibilita, ak to niekde používaš
export type DayKey = DayAbbrev;

export type DailyItem = {
  title?: string;
  activity?: string;
  name?: string;
  duration_min?: number;
  duration?: number;
  intensity?: string;
  zone?: string;
  notes?: string;
  comment?: string;
};

export type DailyPlan = { day: DayAbbrev; items: DailyItem[] };