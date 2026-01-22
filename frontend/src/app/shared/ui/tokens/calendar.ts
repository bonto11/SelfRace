// src/app/shared/ui/tokens/calendar.ts
import { SURFACE_CARD } from "./core";

/* ===== KALENDÁR ŠPECIFICKÉ ============================================ */

// ✅ žiadne bg-[${...}] ani border-[${...}] – Tailwind to nevyrobí
export const CALENDAR_DAY_CELL = [
  "rounded-xl",
  "border",                 // border-width
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

/* zvyšok nechaj ako máš */
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