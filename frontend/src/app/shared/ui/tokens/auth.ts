// src/app/shared/ui/tokens/auth.ts
import type React from "react";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  CARD,
  SURFACE_INSET,
  SURFACE_INSET_STYLE,
  SURFACE_SUBCARD,
  SURFACE_SUBCARD_STYLE,
  MUTED_TEXT,
  MUTED_TEXT_STYLE,
} from "@/app/shared/ui/tokens";

/* Notices */
export const AUTH_NOTICE = [SURFACE_SUBCARD, "px-3", "py-2", "text-xs"].join(" ");

export const AUTH_NOTICE_SUCCESS_STYLE: React.CSSProperties = {
  ...SURFACE_SUBCARD_STYLE,
  color: appColors.statusSuccess,
};

export const AUTH_NOTICE_ERROR_STYLE: React.CSSProperties = {
  ...SURFACE_SUBCARD_STYLE,
  color: appColors.statusError,
};

/* Hints / statuses */
export const AUTH_HINT = "text-xs opacity-70";

export const AUTH_ERROR_TEXT = "text-sm";
export const AUTH_ERROR_STYLE: React.CSSProperties = { color: appColors.statusError };

export const AUTH_SUCCESS_TEXT = "text-sm";
export const AUTH_SUCCESS_STYLE: React.CSSProperties = { color: appColors.statusSuccess };

export const AUTH_CARD_SM = "max-w-sm";

/* Layout */
export const AUTH_PAGE = "min-h-dvh flex items-center justify-center";
export const AUTH_PAGE_PAD = "px-4 py-10";
export const AUTH_SHELL = "w-full max-w-md";

export const AUTH_CARD = [CARD, "p-5"].join(" ");
export const AUTH_CARD_STYLE: React.CSSProperties = {
  background: appColors.surfaceCard,
  borderColor: appColors.surfaceCardBorder,
};

export const AUTH_STACK = "space-y-4";
export const AUTH_HEADER = "space-y-1";
export const AUTH_TITLE = "text-2xl font-semibold";

/** muted text */
export const AUTH_TEXT = MUTED_TEXT;
export const AUTH_TEXT_STYLE: React.CSSProperties = { ...MUTED_TEXT_STYLE };

export const AUTH_FORM = "space-y-4";

export const AUTH_FIELD = "space-y-2";
export const AUTH_LABEL =
  "text-xs font-medium tracking-wide opacity-80 select-none";

/* Feedback */
export const AUTH_FEEDBACK = [SURFACE_INSET, "px-3 py-2 text-xs leading-snug"].join(" ");
export const AUTH_FEEDBACK_STYLE: React.CSSProperties = { ...SURFACE_INSET_STYLE };

export const AUTH_FEEDBACK_SUCCESS_STYLE: React.CSSProperties = { color: appColors.statusSuccess };
export const AUTH_FEEDBACK_ERROR_STYLE: React.CSSProperties = { color: appColors.statusError };
export const AUTH_FEEDBACK_INFO_STYLE: React.CSSProperties = { color: appColors.textSecondary };

/* Links */
export const AUTH_LINK_ROW = "flex items-center justify-between text-xs";
export const AUTH_LINK = "underline underline-offset-2";
export const AUTH_LINK_STYLE: React.CSSProperties = { color: appColors.brandPrimary };
export const AUTH_LINK_MUTED_STYLE: React.CSSProperties = { color: appColors.textPrimary };

/* Footer */
export const AUTH_FOOTER_ROW = "pt-2 flex items-center justify-between text-[11px]";
export const AUTH_FOOTER_TEXT = "opacity-80";

/* Badge */
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

/* Password row */
export const AUTH_PWD_ROW = "flex items-center gap-2";
export const AUTH_PWD_TOGGLE = [
  "shrink-0 rounded-full border px-3 py-2 text-sm bg-transparent",
].join(" ");
export const AUTH_PWD_TOGGLE_STYLE: React.CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
  color: appColors.textMuted,
};

/* Meter */
export const AUTH_METER_ROW = "flex gap-1";
export const AUTH_METER_BAR = "h-1.5 flex-1 rounded border";
export const AUTH_METER_LABEL = "text-xs";
export const AUTH_REQ_LIST = "text-xs space-y-1";

/* Loading */
export const AUTH_LOADING = [AUTH_PAGE, "px-4"].join(" ");
export const AUTH_LOADING_CARD = [CARD, "p-5"].join(" ");
export const AUTH_LOADING_CARD_STYLE: React.CSSProperties = AUTH_CARD_STYLE;
export const AUTH_LOADING_TEXT = MUTED_TEXT;
export const AUTH_LOADING_TEXT_STYLE: React.CSSProperties = { ...MUTED_TEXT_STYLE };