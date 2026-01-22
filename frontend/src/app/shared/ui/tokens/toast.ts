// src/app/shared/ui/tokens/toast.ts
import { appColors } from "@/app/shared/theme/app_colors";

/* ===== TOAST =========================================================== */
export const TOAST_LAYER =
  "pointer-events-none fixed inset-0 z-[60] flex justify-center pt-[12vh]";
export const TOAST_STACK = "w-full flex flex-col items-center gap-2";

export const TOAST_PILL_BASE = [
  "pointer-events-auto select-none",
  "w-[calc(100vw-24px)] sm:w-[520px]",
  "rounded-[22px] px-4 py-3",
  "backdrop-blur-md shadow-lg border",
  "text-[15px] leading-snug font-medium",
].join(" ");

export const TOAST_SUCCESS =
  `bg-[${appColors.statusSuccess}] text-[${appColors.textInverse}] border-[${appColors.statusSuccess}]`;
export const TOAST_ERROR =
  `bg-[${appColors.statusError}] text-[${appColors.textInverse}] border-[${appColors.statusError}]`;
export const TOAST_INFO =
  `bg-[${appColors.panelBg}] text-[${appColors.panelText}] border-[${appColors.panelBorder}]`;