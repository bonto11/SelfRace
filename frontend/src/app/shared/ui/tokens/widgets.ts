// src/app/shared/ui/tokens/widgets.ts
import { appColors } from "@/app/shared/theme/app_colors";
import { SURFACE_CARD, PAD } from "./core";

/* ===== WidgetCard ====================================================== */
export const WIDGET_CARD = SURFACE_CARD + " " + PAD.card + " text-left";
export const WIDGET_CARD_INTERACTIVE = `transition-colors hover:bg-[${appColors.surfaceCardHover}] cursor-pointer focus:outline-none`;

export const WIDGET_INNER = "flex flex-col text-left";
export const WIDGET_TITLE = "text-sm md:text-base font-semibold tracking-tight";
export const WIDGET_HINT = `text-xs whitespace-nowrap text-[${appColors.textMuted}]`;
export const WIDGET_NOTE = `opacity-80 text-sm mt-2 text-[${appColors.textSecondary}]`;
export const WIDGET_FOOTER = "mt-3";
export const WIDGET_ACCENT_BAR = `h-1.5 rounded-b-xl mt-3 bg-[${appColors.accentYellowDim}]`;

/* ===== WIDGET HEADER aliasy =========================================== */
export const WIDGET_HEADER_ROW = "flex items-center";
export const WIDGET_HEADER_SIDE = "flex-1";
export const WIDGET_HEADER_CENTER =
  "inline-flex items-center justify-center gap-3 select-none";
export const WIDGET_HEADER_BELOW = "mb-3";

/* ===== Widget helpers (existing names) ================================= */
export const WIDGET_LOADING_CENTER = "grid place-items-center py-6";
export const WIDGET_META_LABEL =
  "text-[11px] uppercase tracking-wide opacity-70";
export const WIDGET_VALUE_ROW = "mt-1 flex items-end gap-2";
export const WIDGET_VALUE_MAIN = "text-4xl font-extrabold tabular-nums";
export const WIDGET_PLACEHOLDER = "text-xs opacity-60";
export const WIDGET_ERROR_TEXT = "text-sm text-[${appColors.statusError}]";
export const WIDGET_INFO_TEXT = "text-sm opacity-80";
export const WIDGET_EMPTY_TEXT = "text-sm opacity-80";
export const WIDGET_KV_GRID = "grid grid-cols-2 gap-x-3 gap-y-1 text-sm";
export const WIDGET_KV_LABEL = "opacity-75";
export const WIDGET_KV_VALUE = "font-semibold";
export const WIDGET_SUMMARY_TEXT = "mt-3 text-xs opacity-80";
export const WIDGET_SUMMARY_WRAP = "mt-3 text-xs";
export const WIDGET_SUMMARY_HEAD = "opacity-80 mb-1";
export const WIDGET_LIST = "space-y-1";
export const WIDGET_LIST_ITEM = "flex items-center gap-2";
export const WIDGET_BULLET = "inline-block h-1.5 w-1.5 rounded-full";
export const WIDGET_MORE_HINT = "mt-1 text-[11px] opacity-70";
export const WIDGET_STATUS_ROW =
  "flex items-center justify-between gap-2 text-xs";
export const WIDGET_ACTIONS_WRAP = "mt-3 space-y-2 text-xs";
export const WIDGET_ACTION_ROW =
  "flex items-start justify-between gap-2 rounded-lg px-2 py-2";
export const WIDGET_ACTION_ROW_INNER = "flex-1 space-y-0.5";
export const WIDGET_ACTION_CHEVRON_BTN =
  "mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs transition-colors";

/* ===== “pridaj ak ešte nemáš” blok – stále tie isté názvy = OK ========= */
export const WIDGET_INFO_GRID = "grid grid-cols-2 gap-x-3 gap-y-2 text-sm";
export const WIDGET_LABEL_MUTED = "opacity-75";
export const WIDGET_VALUE_STRONG = "font-semibold truncate";
export const WIDGET_BADGES_WRAP = "flex flex-wrap gap-1.5";
export const WIDGET_CENTER_SPINNER = "grid place-items-center py-6";
export const WIDGET_ERROR_BLOCK = `text-sm text-[${appColors.statusError}]`;
export const WIDGET_ERROR_SUB = `mt-1 text-xs text-[${appColors.textMuted}]`;
export const WIDGET_HEADLINE = "text-sm font-medium mb-1";
export const WIDGET_BULLET_LIST = "text-xs space-y-1 mb-3";
export const WIDGET_BULLET_ROW = "flex gap-2";
export const WIDGET_BULLET_DOT = `mt-[6px] h-1.5 w-1.5 rounded-full bg-[${appColors.textMuted}]`;
export const WIDGET_INFO_GRID_XS =
  "mt-1 grid grid-cols-2 gap-x-3 gap-y-2 text-xs";
export const WIDGET_LABEL_MUTED_XS = "opacity-70";
export const WIDGET_VALUE_STRONG_XS = "font-semibold";
export const WIDGET_INFO_GRID_SM = "grid grid-cols-2 gap-x-3 gap-y-1 text-sm";
export const WIDGET_LABEL_MUTED_SM = "opacity-75";
export const WIDGET_VALUE_STRONG_SM = "font-semibold";
export const WIDGET_NOTE_P_SM = "mt-3 text-xs opacity-80";
export const WIDGET_ROW_TOP_XS =
  "flex items-center justify-between gap-2 text-xs";
export const WIDGET_META_TEXT = "text-[11px] opacity-80";
export const WIDGET_ERROR_LINE = "mt-1 text-[11px] text-red-300 line-clamp-2";
export const WIDGET_LOADING_LINE =
  "mt-3 text-[11px] opacity-80 inline-flex items-center gap-1";
export const WIDGET_EMPTY_HINT = "mt-3 text-[11px] opacity-70";
export const WIDGET_VALUE_PRIMARY = "text-5xl font-extrabold leading-none";
export const WIDGET_VALUE_UNIT = "text-xl opacity-80";
export const WIDGET_GRID_2 = "grid grid-cols-2 gap-6";
export const WIDGET_METRIC_LABEL = "text-xs opacity-80 mb-1";
export const WIDGET_METRIC_VALUE =
  "text-5xl font-extrabold leading-none tabular-nums";
export const WIDGET_METRIC_NOTE = "opacity-80 text-xs mt-1";
export const WIDGET_EMPTY = "opacity-75 text-sm py-6";
export const WIDGET_CENTER = "w-full flex items-center justify-center";
export const WIDGET_FOOTNOTE = "mt-3 text-xs opacity-85";
export const WIDGET_LOADING_WRAP = "grid place-items-center py-6";
export const WIDGET_ROW_BETWEEN = "flex items-start justify-between";
export const WIDGET_BLOCK = "min-w-0";
export const WIDGET_TRUNCATE = "truncate";
