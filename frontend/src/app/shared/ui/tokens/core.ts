// src/app/shared/ui/tokens/core.ts
import type * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

/* ===== SURFACES (layout-only classnames) =============================== */

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

export const SURFACE_INLINE = ["rounded-xl", "border", "text-left"].join(" ");

export const SURFACE_INLINE_STYLE: React.CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

/* ===== PADDING ========================================================= */

export const PAD = {
  card: "p-3",
  head: "px-3 pb-1.5",
  foot: "px-3 pt-1.5 pb-3",
  note: "mt-1.5",
};

/* ===== COMPAT ALIASES ================================================== */

export const CARD = SURFACE_CARD;
export const SUBCARD = SURFACE_SUBCARD;
export const PANEL = SURFACE_INSET;

/* ===== DETAIL / FLUSH VARIANTS ======================================== */

export const FLUSH_DETAIL = ["mt-2", "-mx-5 px-5 pt-2 pb-4", "border-t"].join(
  " ",
);

export const FLUSH_DETAIL_STYLE: React.CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
};

export const FLUSH_DETAIL_PB = [
  "mt-2",
  "overflow-hidden rounded-xl",
  "border",
  "px-3 md:px-4 pb-3",
].join(" ");

export const FLUSH_DETAIL_PB_STYLE: React.CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

/* ===== SAFETY / LAYOUT UTILS ========================================== */

export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
export const NO_X = NO_X_OVERFLOW;
export const FLEX_SHRINK_FIX = "min-w-0";

export const SCROLL_X = [
  "w-full",
  "max-w-full",
  "overflow-x-auto",
  "overflow-y-hidden",
  "min-w-0",
  "touch-pan-x",
  "[scrollbar-gutter:stable]",
].join(" ");

/* ===== CARD INSETS (consistent padding) ================================ */

export const CARD_INSET = "px-4 py-4";
export const CARD_INSET_X = "px-4";
export const CARD_HEAD_INSET = "px-4 pt-4 pb-2";
export const CARD_BODY_INSET = "px-4 pb-4";

/* ===== TEXT HELPERS ==================================================== */
/** trieda pre “muted text”; farba ide cez MUTED_TEXT_STYLE */
export const MUTED_TEXT = "opacity-70";
export const MUTED_TEXT_STYLE: React.CSSProperties = {
  color: appColors.textMuted,
};
