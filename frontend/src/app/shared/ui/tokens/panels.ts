// src/app/shared/ui/tokens/panels.ts
/* ============================================================================
   PANELS (layout only)
============================================================================ */
import type { CSSProperties } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SURFACE_INSET } from "./core";

/* ===== Panel surface (semantic, greenish) ============================== */

export const PANEL_SURFACE = [SURFACE_INSET, "overflow-hidden"].join(" ");

export const PANEL_SURFACE_STYLE: CSSProperties = {
  background: appColors.panelBg,
  borderColor: appColors.panelBorder,
};
export const PANEL_STACK = "space-y-4";

export const PANEL_PAD = "p-3 md:p-4";          // univerzálny padding pre panel
export const PANEL_INNER_STACK = "space-y-3";   // vnútorné odsadenia v paneli

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

export const SWIPE_ROW = [
  "relative",
  "w-full",
  "overflow-hidden",
  "select-none",
].join(" ");

export const SWIPE_ACTIONS = [
  "absolute",
  "inset-y-0",
  "right-0",
  "z-0",
  "flex",
  "items-center",
  "gap-2",
  "px-3",
].join(" ");

export const SWIPE_CONTENT = [
  "relative",
  "z-10",
  "w-full",
  "box-border",
  "will-change-transform",
].join(" ");

export const ACCORDION_TOGGLE = "cursor-pointer select-none";

export const ACCORDION_BODY_NO_TOP = "pt-0";

export const ACCORDION_DISABLED = "opacity-70";

export const ACCORDION_FOOTER_BAR =
  "h-1.5 rounded-b-2xl bg-slate-700";

export const ACCORDION_FOOTER_BAR_MUTED =
  "h-1.5 rounded-b-2xl bg-slate-700/60";

export const POPOVER_BTN = [
  "px-2",
  "py-1",
  "rounded-lg",
  "border",
  "text-xs",
  "select-none",
].join(" ");

export const POPOVER_BODY = [
  "p-3",
  "text-xs",
  "leading-snug",
].join(" ");