import { THEME } from "@/app/shared/theme/tokens";
import type {
  StaticProfile,
  LatestMetricsMap,
} from "@/app/features/profile/types/profile";
import { appColors } from "@/app/shared/theme/app_colors";

export function levelColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("excellent") || l.includes("elite"))
    return appColors.chartExcellent;
  if (l.includes("superior"))
    return appColors.chartSuperior;
  if (l.includes("good")) appColors.chartGood;
  if (l.includes("fair") || l.includes("average"))
    return appColors.chartAverage;
  if (l.includes("poor")) return appColors.chartPoor;
  return appColors.chartNeutral;
}

export function summarizeStaticProfile(profile: StaticProfile | null) {
  const p: StaticProfile = profile ?? {
    sex: null,
    birth_date: null,
    height_cm: null,
  };

  const sex = p.sex || "—";
  const bd = p.birth_date || "—";
  const h = Number.isFinite(p.height_cm as number) ? `${p.height_cm} cm` : "—";

  return { sex, bd, h };
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
      (latest?.HR_max?.value != null ? String(latest.HR_max.value) : "201") +
      " bpm",
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

export function hexWithAlpha(hex?: string, a = 0.18): string {
  if (!hex) return `rgba(255,255,255,${a})`;
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? parseInt(
          h
            .split("")
            .map((c) => c + c)
            .join(""),
          16
        )
      : parseInt(h, 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export function colorForBodyFatBand(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete")) return appColors.chartAthletes;
  if (l.includes("fitness")) return appColors.chartFitness;
  if (l.includes("average")) return appColors.chartAverage;
  if (l.includes("essential")) return appColors.chartEssential;
  if (l.includes("obese")) return appColors.chartObese;
  return appColors.chartNeutral;
}

export function colorForVo2RangeLabel(label: string) {
  const l = (label || "").toLowerCase();
  if (l.includes("excellent") || l.includes("elite"))
    return appColors.chartExcellent;
  if (l.includes("superior")) return appColors.chartSuperior;
  if (l.includes("good")) return appColors.chartGood;
  if (l.includes("fair") || l.includes("average")) return appColors.chartFair;
  if (l.includes("poor")) return appColors.chartPoor;
  return appColors.chartNeutral;
}
