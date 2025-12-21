export type WeeklyLoadRow = {
  week: string;
  label: string;
  start: string;
  end: string;
  km_run: number;
  km_ride: number;
  km_mixed: number;
  km_skate: number;
  time_run_min: number;
  time_ride_min: number;
  time_strength_min: number;
  time_mixed_min: number;
  time_skate_min: number;
  time_other_min: number;
  trimp_run: number;
  trimp_ride: number;
  trimp_strength: number;
  trimp_mixed: number;
  trimp_skate: number;
  trimp_other: number;

  monotony?: { km?: number; time?: number; trimp?: number };
  strain?: { km?: number; time?: number; trimp?: number };
};

export type WeeklyLoadApiResponse = {
  success?: boolean;
  weeks?: any[];
  data?: any[];
};

export type WeeklyLoadOptions = {
  weeks?: number;
  sport?: string;
};

export type WeekRow = WeeklyLoadRow;
