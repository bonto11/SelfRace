// src/app/shared/ui/tokens/calendar.ts
import { SURFACE_CARD } from "./core";

/* ===== PAGE CALENDAR (OK nechaj) ===================================== */
export const CALENDAR_DAY_CELL = [
  "rounded-xl",
  "border",
  "px-2 py-1.5",
  "text-left w-full",
  "min-h-[56px]",
  "transition-colors",
  "focus:outline-none",
  "focus:ring-0",
  "focus-visible:outline-none",
  "focus-visible:ring-0",
  "select-none",
  "touch-manipulation",
].join(" ");

export const CALENDAR_HEADER_BAR = SURFACE_CARD + " p-3";
export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";

export const CALENDAR_PAGE_WRAP = "space-y-3";
export const CALENDAR_TITLE_ROW = "flex items-center justify-between";
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

/* ===== CALENDAR WIDGET (weekly mini) ================================== */
/** ✅ len layout triedy, farby sa dávajú cez inline style */
export const CAL_WIDGET_DOW_ROW =
  "grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2 px-2";
export const CAL_WIDGET_DOW_CELL = "text-center";

export const CAL_WIDGET_GRID = "grid grid-cols-7 gap-2 cursor-pointer px-2";

export const CAL_WIDGET_DAY_CELL = [
  "rounded-xl",
  "px-2 py-1.5 select-none min-h-[64px]",
  "transition-colors",
  "border", // border width, farba cez style
].join(" ");

export const CAL_WIDGET_TODAY_RING = "ring-2"; // farba cez style

export const CAL_WIDGET_DAY_NUM =
  "text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5";

export const CAL_WIDGET_ITEMS_WRAP =
  "mt-1.5 px-0.5 flex flex-wrap gap-1 items-center";

export const CAL_WIDGET_DOT = "inline-block w-1.5 h-1.5 rounded-full";
export const CAL_WIDGET_PLAN_DOT = "inline-block w-1.5 h-1.5 rounded-full border";

export const CAL_WIDGET_MARK =
  "inline-flex items-center justify-center w-3 h-3 text-[9px] leading-none";

export const CAL_WIDGET_MORE = "text-[10px] opacity-70";