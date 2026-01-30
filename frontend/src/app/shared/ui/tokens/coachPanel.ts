// src/app/shared/ui/tokens/coachPanels.ts
import type { CSSProperties } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SURFACE_CARD, SURFACE_SUBCARD } from "./core";

/* ============================================================================
   COACH PANELS (colors via style)
   - fix: remove "white frames" by enforcing borderColor from appColors
============================================================================ */

export const COACH_CARD = SURFACE_CARD;
export const COACH_CARD_STYLE: CSSProperties = {
  background: appColors.surfaceCard,
  borderColor: appColors.surfaceCardBorder,
};

export const COACH_SUBCARD = SURFACE_SUBCARD;
export const COACH_SUBCARD_STYLE: CSSProperties = {
  background: appColors.surfaceSolid,
  borderColor: appColors.surfaceCardBorder,
};

/** Bar track (no white frame) */
export const COACH_BAR_TRACK = "h-2.5 w-full rounded-full overflow-hidden";
export const COACH_BAR_TRACK_STYLE: CSSProperties = {
  background: appColors.backgroundAlt,
};