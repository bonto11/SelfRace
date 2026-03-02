import type {
  StaticProfile,
  LatestMetricsMap,
} from "@/app/features/profile/types/profile";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export function levelColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("excellent") || l.includes("elite"))
    return appColors.stateExcellent;
  if (l.includes("superior")) return appColors.stateSuperior;
  if (l.includes("good")) appColors.stateGood;
  if (l.includes("fair") || l.includes("average"))
    return appColors.stateAverage;
  if (l.includes("poor")) return appColors.statePoor;
  return appColors.stateNeutral;
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
export function buildMetricPlaceholders(t: any, latest: LatestMetricsMap | null) {
  return {
    weight_kg:
      (latest?.weight_kg?.value != null
        ? String(latest.weight_kg.value)
        : "80") + " " + t("common.units.kg"),
    body_fat_pct:
      (latest?.body_fat_pct?.value != null
        ? String(latest.body_fat_pct.value)
        : "12") + t("common.units.pct"),
    HR_max:
      (latest?.HR_max?.value != null ? String(latest.HR_max.value) : "201 ") +
     " " + t("common.units.hr"),
    VO2Max_measured:
      (latest?.VO2Max_measured?.value != null
        ? String(latest.VO2Max_measured.value)
        : "46") + " " + t("common.units.vo2max"),
    VO2Max_estimated:
      (latest?.VO2Max_estimated?.value != null
        ? String(latest.VO2Max_estimated.value)
        : "48") + " " + t("common.units.vo2max"),
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
          16,
        )
      : parseInt(h, 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export function colorForBodyFatBand(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete")) return appColors.stateAthletes;
  if (l.includes("fitness")) return appColors.stateFitness;
  if (l.includes("average")) return appColors.stateAverage;
  if (l.includes("essential")) return appColors.stateEssential;
  if (l.includes("obese")) return appColors.stateObese;
  return appColors.stateNeutral;
}

export function colorForVo2RangeLabel(label: string) {
  const l = (label || "").toLowerCase();
  if (l.includes("excellent") || l.includes("elite"))
    return appColors.stateExcellent;
  if (l.includes("superior")) return appColors.stateSuperior;
  if (l.includes("good")) return appColors.stateGood;
  if (l.includes("fair") || l.includes("average")) return appColors.stateFair;
  if (l.includes("poor")) return appColors.statePoor;
  return appColors.stateNeutral;
}
