export type WeeklyMonoStrainRow = {
  week: string;
  label: string;
  start: string;
  end: string;
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
};

export type WeeklyMonoStrainApiResponse = {
  success?: boolean;
  weeks?: any[];
  data?: any[];
};

export type WeeklyMonoStrainOptions = {
  weeks?: number;
  sport?: string;
};

export type WeekRow = WeeklyMonoStrainRow;

export type Rolling7 = {
  last: {
    sum: number;
    mono: number | null;
    strain: number | null;
    daily: number[];
    range: { start: string; end: string };
  };
  prev: {
    sum: number;
    mono: number | null;
    strain: number | null;
    daily: number[];
    range: { start: string; end: string };
  };
};

export type MonoStrainApiRow = {
  week?: string;
  label?: string;
  start?: string;
  end?: string;
  monotony?: number;
  strain?: number;
};