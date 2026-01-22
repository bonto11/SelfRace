// src/app/shared/ui/tokens/charts.ts
import { appColors } from "@/app/shared/theme/app_colors";

/* ===== CHART TOKENS ==================================================== */
export const CHART_HR = {
  maxBpm: 207,
  zoneCuts: [154, 173, 183, 193] as [number, number, number, number],
  colors: {
    z1: appColors.chartLine1,
    z2: appColors.chartLine2,
    z3: appColors.chartLine3,
    z4: appColors.chartLine4,
    z5: appColors.statusError,
  },
  grid: appColors.chartGrid,
  tickText: appColors.textMuted,
  axisText: appColors.textSecondary,
  bandOpacity: 0.08,
  lineWidth: { normal: 2, compact: 1.6 },
  emptyTextClass: "opacity-70 text-sm",
};

export const CHART_SPARK = {
  width: 300,
  lineWidth: 2,
  gradientTop: appColors.chartLine2,
  gradientBottom: appColors.statusError,
  baseline: appColors.chartGrid,
  infoTextClass: "text-xs opacity-75 whitespace-nowrap",
  emptyTextClass: "text-xs opacity-70",
};

export const CHART_TREND = {
  lineColor: appColors.accentTeal,
  bandAlphaHex: "33",
  containerClass: "mt-4",
};

export const CHART_TIGHT = "rounded-md bg-transparent";