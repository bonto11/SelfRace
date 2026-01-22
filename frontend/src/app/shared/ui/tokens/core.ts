// src/app/shared/ui/tokens/core.ts
import { appColors } from "@/app/shared/theme/app_colors";

/* ===== SURFACES (globálne konzistentné) =============================== */
export const SURFACE_CARD = [
  "rounded-2xl",
  "shadow-lg",
  `border border-[${appColors.widgetBorder}]`,
  `bg-[${appColors.surfaceCard}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_SUBCARD = [
  "rounded-2xl",
  `border border-[${appColors.widgetBorder}]`,
  `bg-[${appColors.surfaceSolid}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_INSET = [
  "rounded-2xl",
  `border border-[${appColors.widgetBorder}]`,
  `bg-[${appColors.surfaceSolid}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_INLINE = [
  "rounded-2xl",
  `border border-[${appColors.widgetBorder}]`,
  `bg-[${appColors.backgroundAlt}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const PAD = {
  card: "p-3",
  head: "px-3 pb-3 pb-1.5",
  foot: "px-3 pb-3 pt-1.5",
  note: "mt-1.5",
};

/* ===== KOMPAT ALIASY =================================================== */
export const CARD = SURFACE_CARD;
export const SUBCARD = SURFACE_SUBCARD;
export const PANEL = SURFACE_INSET;

/* ===== DETAIL – FLUSH VARIANTY ======================================== */
export const FLUSH_DETAIL =
  `mt-2 -mx-5 px-5 pb-4 pt-2 border-t border-[${appColors.divider}] md:-mx-5`;

export const FLUSH_DETAIL_PB = [
  "mt-2",
  "overflow-hidden rounded-xl",
  `border border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.backgroundAlt}]`,
  "px-3 md:px-4 pb-3",
].join(" ");

/* ====== GLOBAL SAFETY (limit horizontálneho tečenia) =================== */
export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
export const NO_X = NO_X_OVERFLOW;
export const FLEX_SHRINK_FIX = "min-w-0";