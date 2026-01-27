// src/app/shared/ui/tokens/toast.ts
import type * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

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

export const TOAST_SUCCESS_STYLE: React.CSSProperties = {
  background: appColors.statusSuccess,
  color: appColors.textInverse,
  borderColor: appColors.statusSuccess,
};

export const TOAST_ERROR_STYLE: React.CSSProperties = {
  background: appColors.statusError,
  color: appColors.textInverse,
  borderColor: appColors.statusError,
};

export const TOAST_INFO_STYLE: React.CSSProperties = {
  background: appColors.panelBg,
  color: appColors.panelText,
  borderColor: appColors.panelBorder,
};
