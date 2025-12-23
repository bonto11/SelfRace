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

export const PARETO_SPORTS_DEFAULT = ["run", "ride", "mixed", "skate"] as const;
