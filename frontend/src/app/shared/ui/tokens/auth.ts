// src/app/shared/ui/tokens/auth.ts

import type React from "react";
import {
  CARD,
  SURFACE_INSET,
  MUTED_TEXT,
  SURFACE_SUBCARD,
  SURFACE_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens";

import { appColors } from "@/app/shared/theme/app_colors";
import {} from "@/app/shared/ui/tokens/core";

/* ============================================================================
   AUTH PAGES TOKENS
   - layout classes only
   - all colors via STYLE objects (single source: appColors)
============================================================================ */

/* Notices (success/error) */
export const AUTH_NOTICE = [SURFACE_SUBCARD, "px-3", "py-2", "text-xs"].join(
  " "
);

export const AUTH_NOTICE_SUCCESS_STYLE: React.CSSProperties = {
  ...SURFACE_SUBCARD_STYLE,
  color: appColors.statusSuccess,
};

export const AUTH_NOTICE_ERROR_STYLE: React.CSSProperties = {
  ...SURFACE_SUBCARD_STYLE,
  color: appColors.statusError,
};

// --- Update password / generic auth states -------------------------------

export const AUTH_HINT = "text-xs opacity-70";

export const AUTH_ERROR_TEXT = "text-sm";
export const AUTH_ERROR_STYLE: React.CSSProperties = {
  color: appColors.statusError,
};

export const AUTH_SUCCESS_TEXT = "text-sm";
export const AUTH_SUCCESS_STYLE: React.CSSProperties = {
  color: appColors.statusSuccess,
};

export const AUTH_CARD_SM = "max-w-sm"; // keď chceš užší card než max-w-md shell

/* ============================================================================
   AUTH LAYOUT TOKENS (single source of truth)
============================================================================ */

/** Password row (TextField + toggle) */
export const AUTH_PWD_ROW = "flex items-center gap-2";
export const AUTH_PWD_TOGGLE = [
  "shrink-0",
  "rounded-full",
  "border",
  "px-3 py-2",
  "text-sm",
  "bg-transparent",
  "hover:bg-white/5",
].join(" ");
export const AUTH_PWD_TOGGLE_STYLE: React.CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
  color: appColors.textMuted,
};

/** Strength meter */
export const AUTH_METER_ROW = "flex gap-1";
export const AUTH_METER_BAR = "h-1.5 flex-1 rounded border";
export const AUTH_METER_LABEL = "text-xs";
export const AUTH_REQ_LIST = "text-xs space-y-1";


/* ============================================================================
   AUTH LAYOUT TOKENS (single source of truth)
============================================================================ */

export const AUTH_PAGE = "min-h-dvh flex items-center justify-center";
export const AUTH_PAGE_PAD = "px-4 py-10";
export const AUTH_SHELL = "w-full max-w-md";

/** Card wrapper */
export const AUTH_CARD = [CARD, "p-5"].join(" ");
export const AUTH_CARD_STYLE: React.CSSProperties = {
  background: appColors.surfaceCard,
  borderColor: appColors.surfaceCardBorder,
};

export const AUTH_STACK = "space-y-4";
export const AUTH_HEADER = "space-y-1";
export const AUTH_TITLE = "text-2xl font-semibold";
export const AUTH_TEXT = MUTED_TEXT;

export const AUTH_FORM = "space-y-4";

/** Field block */
export const AUTH_FIELD = "space-y-2";
export const AUTH_LABEL = "text-xs font-medium tracking-wide opacity-80 select-none";

/** Inline feedback box */
export const AUTH_FEEDBACK = [SURFACE_INSET, "px-3 py-2 text-xs leading-snug"].join(" ");
export const AUTH_FEEDBACK_SUCCESS_STYLE: React.CSSProperties = {
  color: appColors.statusSuccess,
};
export const AUTH_FEEDBACK_ERROR_STYLE: React.CSSProperties = {
  color: appColors.statusError,
};
export const AUTH_FEEDBACK_INFO_STYLE: React.CSSProperties = {
  color: appColors.textSecondary,
};

/** Links row */
export const AUTH_LINK_ROW = "flex items-center justify-between text-xs";
export const AUTH_LINK = "underline underline-offset-2";
export const AUTH_LINK_STYLE: React.CSSProperties = { color: appColors.brandPrimary };
export const AUTH_LINK_MUTED_STYLE: React.CSSProperties = { color: appColors.textPrimary };

/** Footer */
export const AUTH_FOOTER_ROW = "pt-2 flex items-center justify-between text-[11px]";
export const AUTH_FOOTER_TEXT = "opacity-80";

/** Badge “Powered by Strava” */
export const AUTH_BADGE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[2px] uppercase tracking-wide text-[10px] backdrop-blur";
export const AUTH_BADGE_STYLE: React.CSSProperties = {
  background: appColors.pillBg,
  border: `1px solid ${appColors.pillBorder}`,
  color: appColors.textSecondary,
};
export const AUTH_BADGE_DOT = "h-3 w-3 rounded-full";
export const AUTH_BADGE_DOT_STYLE: React.CSSProperties = {
  background: appColors.statusWarning,
  boxShadow: `0 0 0 3px ${appColors.pillActiveBg}`,
};

/** Minimal loading block (Suspense fallback) */
export const AUTH_LOADING = [AUTH_PAGE, "px-4"].join(" ");
export const AUTH_LOADING_CARD = [CARD, "p-5"].join(" ");
export const AUTH_LOADING_CARD_STYLE: React.CSSProperties = AUTH_CARD_STYLE;
export const AUTH_LOADING_TEXT = MUTED_TEXT;