export type ParetoWeekPick = { start?: string; end?: string; sport: string };

export type ParetoRow = {
  label: string;
  easy_min: number;
  hard_min: number;
  easy_pct: number;
  hard_pct: number;
  start?: string;
  end?: string;
};