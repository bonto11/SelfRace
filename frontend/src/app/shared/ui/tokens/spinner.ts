// src/app/shared/ui/tokens/spinner.ts
import { appColors } from "@/app/shared/ui/theme/app_colors";

/* ===== SPINNER ========================================================= */
export type SpinnerPreset = {
  px: number;
  accent: string;
  track: string;
  dot?: string;
};

export const SPINNER_CFG: Record<"widget" | "trend" | "screen", SpinnerPreset> =
  {
    widget: {
      px: 18,
      accent: appColors.chartLine1,
      track: appColors.sliderTrack,
      dot: appColors.chartLine2,
    },
    trend: {
      px: 32,
      accent: appColors.brandPrimary,
      track: appColors.sliderTrack,
      dot: appColors.brandMuted,
    },
    screen: {
      px: 56,
      accent: appColors.accentTeal,
      track: appColors.sliderTrack,
      dot: appColors.accentLime,
    },
  };

// src/app/shared/ui/tokens/spinner.ts
export const SPINNER_WRAP = "relative inline-flex items-center justify-center";
