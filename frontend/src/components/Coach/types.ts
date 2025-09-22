export type DayKey = "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun";
export const DAY_ORDER: DayKey[] = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

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

export type DailyPlan = { day: DayKey; items: DailyItem[] };