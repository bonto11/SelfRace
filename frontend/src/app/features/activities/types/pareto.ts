export type ParetoWeekPick = { start?: string; end?: string; sport: string };

export type ParetoRow = {
  label: string;
  easy_min: number;
  hard_min: number;
  easy_pct: number;
  hard_pct: number;
  /** kĺzavý podiel ľahkej záťaže za 4 týždne (null = bez dát) */
  rolling_easy_pct?: number | null;
  start?: string;
  end?: string;
};

export const PARETO_SPORTS_DEFAULT = ["run", "ride", "mixed", "skate"] as const;

export type ParetoTrendResponse = {
  trend: Array<{
    label: string;
    easy_min: number;
    hard_min: number;
    easy_pct: number;
    hard_pct: number;
    start?: string;
    end?: string;
  }>;
  availableSports: string[];
};
