// src/app/shared/ui/tokens/core.ts
import type * as React from "react";
import { appColors } from "@/app/shared/theme/app_colors";

/* ===== SURFACES (JEDINÝ ZDROJ PRAVDY PRE KARTY) ======================== */
/**
 * Tokeny sú LEN layout classnames.
 * Farby idú cez inline style – aby sme nemali runtime Tailwind (bg-[${...}]).
 */

export const SURFACE_CARD = [
  "rounded-2xl",
  "shadow-lg",
  "border",
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_CARD_STYLE: React.CSSProperties = {
  background: appColors.surfaceCard,
  borderColor: appColors.surfaceCardBorder,
};

export const SURFACE_SUBCARD = [
  "rounded-2xl",
  "border",
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_SUBCARD_STYLE: React.CSSProperties = {
  background: appColors.surfaceSolid,
  borderColor: appColors.surfaceCardBorder,
};

export const SURFACE_INSET = [
  "rounded-2xl",
  "border",
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_INSET_STYLE: React.CSSProperties = {
  background: appColors.surfaceSolid,
  borderColor: appColors.surfaceCardBorder,
};

export const SURFACE_INLINE = [
  "rounded-xl",
  "border",
  "text-left",
].join(" ");

export const SURFACE_INLINE_STYLE: React.CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

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
/** Layout-only */
export const FLUSH_DETAIL = [
  "mt-2",
  "-mx-5 px-5 pt-2 pb-4",
  "border-t",
].join(" ");

/** Farby pre FLUSH_DETAIL */
export const FLUSH_DETAIL_STYLE: React.CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
};

/** Layout-only */
export const FLUSH_DETAIL_PB = [
  "mt-2",
  "overflow-hidden rounded-xl",
  "border",
  "px-3 md:px-4 pb-3",
].join(" ");

/** Farby pre FLUSH_DETAIL_PB */
export const FLUSH_DETAIL_PB_STYLE: React.CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

/* ===== GLOBAL SAFETY =================================================== */

export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
export const NO_X = NO_X_OVERFLOW;
export const FLEX_SHRINK_FIX = "min-w-0";

// src/app/shared/ui/tokens/core.ts

export const CARD_INSET = "px-4 py-4";          // default padding vnútri karty
export const CARD_INSET_X = "px-4";             // keď chceš riešiť y osobitne
export const CARD_HEAD_INSET = "px-4 pt-4 pb-2"; // header padding (ako si mal)
export const CARD_BODY_INSET = "px-4 pb-4";      // body padding

export const MUTED_TEXT = appColors.textMuted;


export const SCROLL_X = [
  "w-full",
  "max-w-full",
  "overflow-x-auto",
  "overflow-y-hidden",
  "min-w-0",
  "touch-pan-x",
  "[scrollbar-gutter:stable]",
].join(" ");