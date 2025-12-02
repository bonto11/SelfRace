// src/features/profile/utils/chartColors.ts
import { THEME } from "@/shared/theme/tokens";

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
  if (l.includes("athlete")) return THEME.chart.athletes;
  if (l.includes("fitness")) return THEME.chart.fitness;
  if (l.includes("average")) return THEME.chart.average;
  if (l.includes("essential")) return THEME.chart.essential;
  if (l.includes("obese")) return THEME.chart.obese;
  return THEME.chart.neutral;
}

export function colorForVo2RangeLabel(label: string) {
  const l = (label || "").toLowerCase();
  if (l.includes("excellent") || l.includes("elite"))
    return THEME.chart.excellent;
  if (l.includes("superior")) return THEME.chart.superior;
  if (l.includes("good")) return THEME.chart.good;
  if (l.includes("fair") || l.includes("average")) return THEME.chart.fair;
  if (l.includes("poor")) return THEME.chart.poor;
  return THEME.chart.neutral;
}