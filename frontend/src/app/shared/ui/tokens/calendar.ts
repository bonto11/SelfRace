// src/app/shared/ui/tokens/calendar.ts
import { SURFACE_CARD } from "./core";

/* ===== PAGE CALENDAR ================================================== */
export const CALENDAR_DAY_CELL = [
  "rounded-xl",
  "px-2 py-1.5",
  "text-left w-full",
  "min-h-[56px]",
  "transition-[background,border-color,box-shadow] duration-150",
  "select-none",
  "touch-manipulation",
  "focus:outline-none",
  "focus-visible:outline-none",
].join(" ");

export const CALENDAR_HEADER_BAR = SURFACE_CARD + " p-3";
export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";

/* ... ostatné nechaj ako máš ... */

/* ===== CALENDAR WIDGET (weekly mini) ================================== */
export const CAL_WIDGET_DOW_ROW =
  "grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2 px-2";

export const CAL_WIDGET_DOW_CELL = "text-center";
export const CAL_WIDGET_GRID = "grid grid-cols-7 gap-2 cursor-pointer px-2";

export const CAL_WIDGET_DAY_CELL = [
  "rounded-xl",
  "px-2 py-1.5 select-none min-h-[64px]",
  "transition-[background,border-color,box-shadow] duration-150",
  "border",
].join(" ");

export const CAL_WIDGET_DAY_NUM =
  "text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5";

export const CAL_WIDGET_ITEMS_WRAP =
  "mt-1.5 px-0.5 flex flex-wrap gap-1 items-center";

export const CAL_WIDGET_DOT = "inline-block w-1.5 h-1.5 rounded-full";
export const CAL_WIDGET_PLAN_DOT = "inline-block w-1.5 h-1.5 rounded-full border";
export const CAL_WIDGET_MARK =
  "inline-flex items-center justify-center w-3 h-3 text-[9px] leading-none";
export const CAL_WIDGET_MORE = "text-[10px] opacity-70";