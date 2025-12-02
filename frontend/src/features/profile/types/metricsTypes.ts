// src/features/profile/types/metricsTypes.ts

/** Kľúče metrík, ktoré eviduješ v profile/metrics. */
export type MetricKey =
  | "weight_kg"
  | "body_fat_pct"
  | "HR_max"
  | "VO2Max_measured"
  | "VO2Max_estimated"
  | "BMI";

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

export type EditableMetricKey =
  | "weight_kg"
  | "body_fat_pct"
  | "HR_max"
  | "VO2Max_measured"
  | "VO2Max_estimated";

export type MetricHistoryRow = {
  measured_at: string; // ISO datetime
  value_num: number | null;
};