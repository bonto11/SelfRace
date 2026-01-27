// src/app/shared/ui/tokens/calendar.ts
import type * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SURFACE_CARD, SURFACE_CARD_STYLE } from "./core";

/* ============================================================================
   CALENDAR TOKENS
   - Layout-only classnames (NO dynamic Tailwind like bg-[${...}] / border-[${...}])
   - All colors are applied in components via inline style (single source: appColors)
============================================================================ */

/* ===== PAGE CALENDAR (full page) ======================================= */

export const CALENDAR_PAGE_WRAP = "space-y-3";

/** Layout-only */
export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";
export const CALENDAR_HEADER_BAR = SURFACE_CARD + " p-3";

/**
 * Farby pre container/header (aby si to nemusel riešiť v každom komponente zvlášť)
 * Default je SURFACE_CARD_STYLE, ale exportujem to tu pre pohodlie.
 */
export const CALENDAR_CONTAINER_STYLE: React.CSSProperties = {
  ...SURFACE_CARD_STYLE,
};

export const CALENDAR_HEADER_BAR_STYLE: React.CSSProperties = {
  ...SURFACE_CARD_STYLE,
};

export const CALENDAR_TITLE_ROW = "flex items-center justify-between gap-3";
export const CALENDAR_TITLE = "text-lg font-semibold";

export const CALENDAR_NAV_ROW = "flex items-center gap-2";
export const CALENDAR_NAV_NUDGE = "translate-y-[2px]";
export const CALENDAR_MONTH_LABEL =
  "mx-1 text-base font-semibold min-w-[160px] text-center";

export const CALENDAR_LEGEND_WRAP =
  "mt-2 mb-1 flex flex-wrap gap-3 text-[11px] opacity-70";
export const CALENDAR_LEGEND_ITEM = "flex items-center gap-1";
export const CALENDAR_LEGEND_DOT = "inline-block w-2 h-2 rounded-full";
export const CALENDAR_LEGEND_TINY = "text-[9px] leading-none";

export const CALENDAR_ERROR_LINE =
  "mt-1 mb-1 text-[11px] text-red-300 line-clamp-2";

/* Day-of-week header row (Po..Ne) */
export const CALENDAR_DOW_ROW =
  "mt-1 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide";
export const CALENDAR_DOW_CELL = "text-center";

/* Main month grid wrapper */
export const CALENDAR_GRID = "mt-2 grid grid-cols-7 gap-2";

/* Single day cell (button) – colors come from inline style in component */
export const CALENDAR_DAY_CELL = [
  "rounded-xl",
  "px-2 py-1.5",
  "text-left w-full",
  "min-h-[56px]",
  "border", // width only (color via style)
  "transition-[background,border-color,box-shadow] duration-150",
  "select-none",
  "touch-manipulation",
  "focus:outline-none",
  "focus-visible:outline-none",
  "outline-none",
].join(" ");

/* Day number */
export const CALENDAR_DAY_NUM =
  "text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5";

/* Dots/marks container inside a day cell */
export const CALENDAR_ITEMS_WRAP =
  "mt-1.5 pl-0.5 pr-0.5 flex flex-wrap gap-1 items-center";

export const CALENDAR_DOT = "inline-block w-1.5 h-1.5 rounded-full";
export const CALENDAR_PLAN_DOT = "inline-block w-1.5 h-1.5 rounded-full border"; // border color via style
export const CALENDAR_MARK = "text-[11px] leading-none font-semibold";
export const CALENDAR_MORE = "text-[10px] opacity-70";

/* ============================================================================
   CALENDAR WIDGET (weekly mini) — used in WidgetActivitiesCalendar
============================================================================ */

export const CAL_WIDGET_WRAP = "mt-1";

export const CAL_WIDGET_DOW_ROW =
  "grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2 px-2";
export const CAL_WIDGET_DOW_CELL = "text-center";

export const CAL_WIDGET_GRID = "grid grid-cols-7 gap-2 cursor-pointer px-2";

export const CAL_WIDGET_DAY_CELL = [
  "rounded-xl",
  "px-2 py-1.5",
  "select-none",
  "min-h-[64px]",
  "border", // width only; color via style
  "transition-[background,border-color,box-shadow] duration-150",
  "touch-manipulation",
].join(" ");

export const CAL_WIDGET_TODAY_RING = ""; // ring is applied via inline style (boxShadow)

export const CAL_WIDGET_DAY_NUM =
  "text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5";

export const CAL_WIDGET_ITEMS_WRAP =
  "mt-1.5 px-0.5 flex flex-wrap gap-1 items-center";

export const CAL_WIDGET_DOT = "inline-block w-1.5 h-1.5 rounded-full";
export const CAL_WIDGET_PLAN_DOT =
  "inline-block w-1.5 h-1.5 rounded-full border";
export const CAL_WIDGET_MARK =
  "inline-flex items-center justify-center w-3 h-3 text-[9px] leading-none";
export const CAL_WIDGET_MORE = "text-[10px] opacity-70";

/* (optional) ak chceš mať aj widget cell style export z jedného miesta */
export const CAL_WIDGET_DAY_CELL_STYLE: React.CSSProperties = {
  background: appColors.inputBg ?? appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};
