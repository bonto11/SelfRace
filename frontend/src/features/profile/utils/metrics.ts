// src/features/profile/utils/metrics.ts

import { THEME } from "@/shared/theme/tokens";
import type { LatestMetricsMap } from "@/features/profile/types/metricsTypes";

/** Lokalizovaný dátum pre summary. */
export function formatMetricDate(d?: string | null): string {
  const loc = THEME.i18n?.dateLocale ?? "sk-SK";
  return d ? new Date(d).toLocaleDateString(loc) : "—";
}

/** BMI text z latest mapy. */
export function formatBmiFromLatest(latest: LatestMetricsMap | null): string {
  const bmi = latest?.BMI?.value;
  return Number.isFinite(bmi as number) ? (bmi as number).toFixed(1) : "—";
}

/** Placeholder texty pre inputs. */
export function buildMetricPlaceholders(latest: LatestMetricsMap | null) {
  return {
    weight_kg:
      (latest?.weight_kg?.value != null
        ? String(latest.weight_kg.value)
        : "80") + " kg",
    body_fat_pct:
      (latest?.body_fat_pct?.value != null
        ? String(latest.body_fat_pct.value)
        : "12") + " %",
    HR_max:
      (latest?.HR_max?.value != null
        ? String(latest.HR_max.value)
        : "201") + " bpm",
    VO2Max_measured:
      (latest?.VO2Max_measured?.value != null
        ? String(latest.VO2Max_measured.value)
        : "46") + " mL/kg/min",
    VO2Max_estimated:
      (latest?.VO2Max_estimated?.value != null
        ? String(latest.VO2Max_estimated.value)
        : "48") + " mL/kg/min",
  };
}