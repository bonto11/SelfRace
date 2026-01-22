// src/app/shared/ui/tokens/core.ts
import { appColors } from "@/app/shared/theme/app_colors";

/* ===== SURFACES (JEDINÝ ZDROJ PRAVDY PRE KARTY) ======================== */

export const SURFACE_CARD = [
  "rounded-2xl",
  "shadow-lg",
  "border",
  `border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.surfaceCard}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_SUBCARD = [
  "rounded-2xl",
  "border",
  `border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.surfaceSolid}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_INSET = [
  "rounded-2xl",
  "border",
  `border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.surfaceSolid}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_INLINE = [
  "rounded-xl",
  "border",
  `border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.backgroundAlt}]`,
  "text-left",
].join(" ");

/* ===== PADDING PRE KARTY ============================================== */

export const PAD = {
  card: "p-3",
  head: "px-3 pb-1.5",
  foot: "px-3 pt-1.5 pb-3",
  note: "mt-1.5",
};

/* ===== KOMPAT ALIASY =================================================== */

export const CARD = SURFACE_CARD;
export const SUBCARD = SURFACE_SUBCARD;
export const PANEL = SURFACE_INSET;

/* ===== DETAIL / FLUSH VARIANTY ======================================== */

export const FLUSH_DETAIL = [
  "mt-2",
  "-mx-5 px-5 pt-2 pb-4",
  "border-t",
  `border-[${appColors.surfaceCardBorder}]`,
].join(" ");

export const FLUSH_DETAIL_PB = [
  "mt-2",
  "overflow-hidden rounded-xl",
  "border",
  `border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.backgroundAlt}]`,
  "px-3 md:px-4 pb-3",
].join(" ");

/* ===== GLOBAL SAFETY =================================================== */

export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
export const NO_X = NO_X_OVERFLOW;
export const FLEX_SHRINK_FIX = "min-w-0";