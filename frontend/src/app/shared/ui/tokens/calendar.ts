// src/app/shared/ui/tokens/calendar.ts
import type * as React from "react";
import { SURFACE_CARD, SURFACE_CARD_STYLE } from "./core";

/* ============================================================================
   CALENDAR TOKENS – rám stránky kalendára. Dni a značky (malý aj veľký
   kalendár, denný widget) kreslí DayTile / StatusMark z WidgetParts.
============================================================================ */

export const CALENDAR_PAGE_WRAP = "space-y-3";

export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";
export const CALENDAR_CONTAINER_STYLE: React.CSSProperties = {
  ...SURFACE_CARD_STYLE,
};

export const CALENDAR_TITLE_ROW = "flex items-center justify-between gap-3";
export const CALENDAR_TITLE = "text-lg font-semibold";

export const CALENDAR_NAV_ROW = "flex items-center gap-2";
export const CALENDAR_NAV_NUDGE = "translate-y-[2px]";
export const CALENDAR_MONTH_LABEL = "mx-1 text-base font-semibold min-w-[160px] text-center";

export const CALENDAR_ERROR_LINE = "mt-1 mb-1 text-[11px] text-red-300 line-clamp-2";
