export type HistoryRow = { VO2Max: number | null; updated_at: string };
export type EstRow = {
  value?: number | null;
  updated_at?: string | null;
  success?: boolean;
};
export type Range = { label: string; min: number | null; max: number | null };
export type Group = {
  sex: Sex;
  age_min: number;
  age_max: number;
  ranges: { label: string; min: number | null; max: number | null }[];
};
export type Sex = "M" | "F" | null;

export type StaticProfile = {
  sex: Sex;
  birth_date: string | null;
  height_cm: number | null;
};

export type StaticProfileSuccess = {
  success: true;
  data: StaticProfile;
};

export type StaticApiFail = {
  success: false;
  detail?: string;
};

/** Kľúče metrík, ktoré eviduješ v profile/metrics. */
export type MetricKey =
  | "weight_kg"
  | "body_fat_pct"
  | "HR_max"
  | "VO2Max_measured"
  | "VO2Max_estimated"
  | "BMI";

export type EditableMetricKey =
  | "weight_kg"
  | "body_fat_pct"
  | "HR_max"
  | "VO2Max_measured"
  | "VO2Max_estimated";

/** Jeden latest záznam (summary) pre metriku. */
export type LatestMetric = {
  value: number | null;
  unit?: string | null;
  updated_at?: string | null;
} | null;

/** Map metrík, ktorý vracia BE pre `/profile/metrics/latest`. */
export type LatestMetricsMap = {
  weight_kg?: LatestMetric;
  body_fat_pct?: LatestMetric;
  HR_max?: LatestMetric;
  VO2Max_measured?: LatestMetric;
  VO2Max_estimated?: LatestMetric;
  BMI?: LatestMetric;
};

/** Success odpoveď pre latest. */
export type LatestMetricsResponse = {
  success: true;
  data: LatestMetricsMap;
};

/** Vstup pre uloženie jednej hodnoty. */
export type MetricEntryInput = {
  metric: MetricKey;
  value_num: number;
  unit: string;
  measured_at: string;
  source: string;
};

/** Odpoveď na uloženie metrík. */
export type SaveMetricsSuccess = {
  success: true;
  inserted?: number;
};

export type MetricsApiFail = {
  success: false;
  detail?: string;
};


export type MetricHistoryRow = {
  measured_at: string; // ISO datetime
  value_num: number | null;
};

export type MetricState = Record<EditableMetricKey, number | null>;
export type DirtyMap = Record<EditableMetricKey, boolean>;

export type Vo2HistoryApiOk = {
  success: true;
  history: HistoryRow[];
  sex: "M" | "F" | null;
  birth_date: string | null;
};

export type Vo2EstimateApiOk = {
  success: boolean;
  value: number | null;
  updated_at: string | null;
};
