// src/app/shared/ui/tokens/panels.ts
/* ============================================================================
   PANELS (layout only)
============================================================================ */

export const PANEL = [
  "rounded-xl",
  "border",
  "px-4",
  "py-4",
].join(" ");

export const PANEL_STACK = "space-y-4";

export const PANEL_HEADER = "flex items-start justify-between gap-3";
export const PANEL_TITLE = "text-lg font-semibold";
export const PANEL_SUBTITLE = "mt-1 text-xs";

export const PANEL_STATUS_COL = "flex flex-col items-end gap-1";
export const PANEL_STATUS_PILL = [
  "rounded-full",
  "border",
  "px-2",
  "py-0.5",
  "text-[10px]",
  "uppercase",
  "tracking-wide",
].join(" ");
export const PANEL_BRAND_TINY = "text-[10px] font-semibold uppercase tracking-wide";

export const PANEL_SECTION = "space-y-1";
export const PANEL_SECTION_DIVIDER = "border-t pt-2";
export const PANEL_SECTION_LABEL = "text-xs font-semibold";
export const PANEL_SECTION_TEXT = "text-xs";

export const PANEL_ACTION_ROW = "flex flex-col sm:flex-row gap-2";
export const PANEL_ACTIONS_INLINE = "flex flex-wrap items-center gap-2";

export const PANEL_SECTION_HEAD = "flex items-center justify-between gap-2";
export const PANEL_SECTION_TITLE = "text-sm font-medium";
export const PANEL_SECTION_SUBTITLE = "text-xs";

export const PANEL_PREVIEW = "px-3 py-2 text-xs select-none";

export const PANEL_CARD_HEAD = "flex items-center justify-between gap-2";
export const PANEL_CARD_TITLE = "text-base font-semibold";
export const PANEL_CARD_SUBTITLE = "text-xs";

export const PANEL_KV_STACK = "space-y-1 text-sm";

export const PANEL_GRID_3 = "grid gap-3 md:grid-cols-3";

export const PANEL_BADGE = "text-[10px] rounded-full border px-2 py-0.5 uppercase tracking-wide";

export const PANEL_LIST = "space-y-2";
export const PANEL_LIST_ITEM = "flex items-center justify-between gap-3 rounded-md border px-3 py-2";

export const PANEL_BAR_CARD = "rounded-lg border p-3 text-xs";
export const PANEL_BAR_HEAD = "flex items-center justify-between gap-2";
export const PANEL_BAR_TRACK = "h-2 w-full overflow-hidden rounded-full";
export const PANEL_BAR_FILL = "h-2 rounded-full transition-all duration-300";
export const PANEL_BAR_FOOT = "flex items-center justify-between gap-2 text-[11px]";