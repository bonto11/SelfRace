// src/app/shared/ui/tokens/sessionCard.ts
import type { CSSProperties } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  SURFACE_CARD,
  SURFACE_SUBCARD,
  SURFACE_INLINE,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  CARD_INSET_X,
  FLUSH_DETAIL,
  FLUSH_DETAIL_STYLE,
  FLEX_SHRINK_FIX,
  SURFACE_INLINE_STYLE
} from "./core";

type VarStyle = CSSProperties & Record<`--${string}`, string>;

/* ============================================================================
   SESSION CARD (single source of truth)
   - all paddings / colors / borders must come from tokens
   - colors via style (appColors) + optional CSS vars for fine-grained states
============================================================================ */

/* ===== Surface ========================================================= */

export const SESSION_CARD = [
  SURFACE_CARD,
  "overflow-hidden",
  "w-full",
  "min-w-0",
].join(" ");


export const SESSION_CARD_STYLE: CSSProperties = {
  background: appColors.surfaceCard,
  borderColor: appColors.surfaceCardBorder,
  // shadow is already in SURFACE_CARD (shadow-lg), but you can also centralize later
};

export const SESSION_CARD_HOVER = "hover:brightness-[1.02] transition";

/* Optional: if you want hover bg via style (instead of brightness) */
export const SESSION_CARD_HOVER_STYLE: CSSProperties = {
  // background: appColors.surfaceCardHover,
};

export const SESSION_SUBCARD = [SURFACE_SUBCARD, "overflow-hidden"].join(" ");
export const SESSION_SUBCARD_STYLE: CSSProperties = {
  background: appColors.surfaceSolid,
  borderColor: appColors.surfaceCardBorder,
};

export const SESSION_INLINE = SURFACE_INLINE;
export const SESSION_INLINE_STYLE: CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

/* ===== Layout (insets) ================================================= */

export const SESSION_HEAD = [CARD_HEAD_INSET, "min-w-0"].join(" ");
export const SESSION_BODY = [CARD_BODY_INSET, "min-w-0"].join(" ");

/** When you need header/body with identical X inset but custom Y */
export const SESSION_INSET_X = CARD_INSET_X;
export const SESSION_PAD_Y_SM = "py-2";
export const SESSION_PAD_Y_MD = "py-3";

/* ===== Header anatomy ================================================== */

export const SESSION_HEAD_ROW = [
  "flex items-start justify-between gap-3",
  "min-w-0",
].join(" ");

export const SESSION_HEAD_LEFT = ["flex items-start gap-2", "min-w-0"].join(" ");
export const SESSION_HEAD_RIGHT = [
  "flex items-center gap-2",
  "shrink-0",
].join(" ");

export const SESSION_TITLE = [
  "text-base font-semibold",
  FLEX_SHRINK_FIX, // min-w-0
  "leading-snug",
].join(" ");

export const SESSION_SUBTITLE = [
  "mt-0.5 text-xs",
  "opacity-70",
  FLEX_SHRINK_FIX,
].join(" ");

export const SESSION_META_ROW = [
  "mt-2 flex flex-wrap items-center gap-2",
  "text-xs",
  "opacity-80",
].join(" ");

/* ===== Badges / pills ================================================== */

export const SESSION_PILL = [
  "inline-flex items-center gap-1.5",
  "rounded-full border",
  "px-2 py-0.5",
  "text-[10px] uppercase tracking-wide",
  "select-none",
  "border-[var(--pill-border)]",
  "bg-[var(--pill-bg)]",
  "text-[var(--pill-text)]",
].join(" ");

export const SESSION_PILL_STYLE: VarStyle = {
  "--pill-bg": appColors.pillBg,
  "--pill-border": appColors.pillBorder,
  "--pill-text": appColors.pillText,
};

export const SESSION_PILL_ACTIVE_STYLE: VarStyle = {
  "--pill-bg": appColors.pillActiveBg,
  "--pill-border": appColors.pillActiveBorder,
  "--pill-text": appColors.pillActiveText,
};

export const SESSION_BADGE = [
  "inline-flex items-center",
  "rounded-full border",
  "px-2 py-0.5",
  "text-[10px] font-semibold uppercase tracking-wide",
  "select-none",
].join(" ");

/* ===== Body typography ================================================= */

export const SESSION_TEXT = "text-sm leading-snug";
export const SESSION_MUTED = "opacity-70";
export const SESSION_KV = "space-y-1 text-sm";

export const SESSION_SECTION = "space-y-2";
export const SESSION_SECTION_HEAD = "flex items-center justify-between gap-2";
export const SESSION_SECTION_TITLE = "text-sm font-medium";
export const SESSION_SECTION_SUBTITLE = "text-xs opacity-70";

/* ===== Dividers / flush detail ======================================== */

export const SESSION_DIVIDER = "border-t";
export const SESSION_DIVIDER_STYLE: CSSProperties = { borderColor: appColors.divider };

export const SESSION_FLUSH_DETAIL = FLUSH_DETAIL;
export const SESSION_FLUSH_DETAIL_STYLE = FLUSH_DETAIL_STYLE;

/* ===== Rows / actions ================================================== */

export const SESSION_ROW = [
  "flex items-center justify-between gap-3",
  "min-w-0",
].join(" ");

export const SESSION_ROW_LEFT = ["flex items-center gap-2", "min-w-0"].join(" ");
export const SESSION_ROW_RIGHT = ["flex items-center gap-2", "shrink-0"].join(
  " ",
);

export const SESSION_ACTIONS = "flex flex-wrap items-center gap-2";
export const SESSION_ACTIONS_STACK = "flex flex-col sm:flex-row gap-2";

/* ===== Icon sizing helpers ============================================ */

export const SESSION_ICON_SM = "h-3.5 w-3.5 shrink-0 opacity-70";
export const SESSION_ICON_MD = "h-4 w-4 shrink-0 opacity-70";

/* ===== Safety ========================================================== */

export const SESSION_MIN_W_0 = FLEX_SHRINK_FIX;

export const SESSION_PILL_DANGER_STYLE: VarStyle = {
  ...SESSION_PILL_STYLE,
  "--pill-bg": "rgba(0,0,0,0)",
  "--pill-border": appColors.statusError,
  "--pill-text": appColors.statusError,
};

/* ===== Shared tiles (used in session detail grids) ===================== */

export const SESSION_TILE = [SURFACE_INLINE, "px-3 py-2"].join(" ");
export const SESSION_TILE_STYLE: CSSProperties = SURFACE_INLINE_STYLE;

export const SESSION_TILE_LABEL = "text-[10px] opacity-70";
export const SESSION_TILE_VALUE = "text-xl font-semibold tabular-nums truncate";

/* ===== Mini grid (ExternalSessionDetail / KPIs) ======================== */

export const SESSION_MINIGRID_BASE = "mt-3 grid gap-2";

export const SESSION_MINIGRID_2COL = "grid-cols-2 sm:grid-cols-4";
export const SESSION_MINIGRID_3COL = "grid-cols-3 sm:grid-cols-6";

export const SESSION_MINITILE = "rounded-lg border px-2.5 py-1.5";
export const SESSION_MINITILE_STYLE: CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

export const SESSION_MINITILE_LABEL = "text-[10px] opacity-70 leading-tight";
export const SESSION_MINITILE_VALUE =
  "text-sm font-semibold tabular-nums leading-tight";

/* ===== MetricGrid (generic) ============================================ */

export const SESSION_METRICGRID = "mt-1 grid grid-cols-1 gap-3";

export const SESSION_METRICGRID_COLS_2 = "sm:grid-cols-2";
export const SESSION_METRICGRID_COLS_3 = "sm:grid-cols-3";
export const SESSION_METRICGRID_COLS_4 = "sm:grid-cols-4";

export const SESSION_METRICTILE = SESSION_TILE;
export const SESSION_METRICTILE_STYLE = SESSION_TILE_STYLE;
export const SESSION_METRICTILE_LABEL = SESSION_TILE_LABEL;
export const SESSION_METRICTILE_VALUE = SESSION_TILE_VALUE;

/* ===== Splits section (table + bars) =================================== */

export const SESSION_SPLITS_WRAP = "text-[11px] sm:text-xs";
export const SESSION_SPLITS_TOTAL = "mb-3 text-[11px] opacity-70";
export const SESSION_SPLITS_BARS_STACK = "space-y-4";

export const SESSION_SPLITS_TABLE_WRAP = "overflow-x-auto";
export const SESSION_SPLITS_TABLE = "min-w-full border-collapse";

export const SESSION_SPLITS_THEAD = "border-b";
export const SESSION_SPLITS_THEAD_STYLE: CSSProperties = {
  borderColor: appColors.divider,
};
export const SESSION_SPLITS_THEAD_ROW = "opacity-70";

export const SESSION_SPLITS_TH =
  "py-1 px-1 text-center align-bottom text-[10px]";

export const SESSION_SPLITS_TR = "border-b last:border-b-0";
export const SESSION_SPLITS_TR_STYLE: CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
};

export const SESSION_SPLITS_TD = "py-1 px-1 text-center tabular-nums whitespace-nowrap";
export const SESSION_SPLITS_TD_RIGHT =
  "py-1 pl-1 pr-0.5 text-right tabular-nums whitespace-nowrap";

export const SESSION_SPLITS_EMPTY = "text-sm opacity-80";

/* ===== Metric bars row ================================================== */

export const SESSION_METRIC_ROW = "pt-1";

export const SESSION_METRIC_LABEL = "mb-1 text-center";
export const SESSION_METRIC_LABEL_TEXT = "text-[11px] opacity-80";

export const SESSION_METRIC_AXIS =
  "flex flex-col justify-between items-start text-[9px] opacity-80 leading-tight mr-2";

export const SESSION_METRIC_BARS = "flex-1 flex items-end gap-[6px] h-24";

export const SESSION_METRIC_BAR = "flex-1 basis-0 rounded-sm";

export const SESSION_METRIC_BAR_STYLE: Record<
  "hr" | "pace" | "elev" | "time",
  CSSProperties
> = {
  hr: { background: appColors.chartLine1 },
  pace: { background: appColors.chartLine2 },
  elev: { background: appColors.chartLine3 },
  time: { background: appColors.chartLine4 },
};

/* ============================================================================
   SESSION CARD — VARIANT PADDING (remove px-5 py-4 from components)
============================================================================ */

export const SESSION_VARIANT_PAD: Record<
  "activity" | "calendar" | "pb" | "plan",
  string
> = {
  activity: "py-0",
  calendar: "py-0",
  pb: "py-0",
  plan: "py-0",
};

/* ============================================================================
   SESSION HEADER ATOMS (remove mt/text sizes from components)
============================================================================ */

export const SESSION_DATE = "text-sm font-medium truncate";

export const SESSION_FAVORITE_STAR = "text-[12px] leading-none opacity-90";

export const SESSION_TOGGLE_BTN = [
  "h-8 w-8",
  "grid place-items-center",
  "rounded-full",
  "border",
  "transition",
  "select-none",
].join(" ");

export const SESSION_TOGGLE_BTN_STYLE: CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  borderColor: appColors.surfaceCardBorder,
};

export const SESSION_TOGGLE_BTN_HOVER = "hover:bg-white/15";

export const SESSION_TOGGLE_ICON = [
  "text-base leading-none",
  "select-none transition-transform",
].join(" ");

/* ============================================================================
   PLAN STATUS (so SessionCard has 0 status classes)
============================================================================ */

export const SESSION_PLAN_STATUS_STYLE: Record<
  "planned" | "done" | "missed" | "postponed",
  VarStyle
> = {
  planned: {
    ...SESSION_PILL_STYLE,
  },
  done: {
    ...SESSION_PILL_STYLE,
    "--pill-bg": "rgba(16,185,129,0.10)",
    "--pill-border": appColors.statusSuccess,
    "--pill-text": appColors.statusSuccess,
  },
  missed: {
    ...SESSION_PILL_STYLE,
    "--pill-bg": "rgba(245,158,11,0.10)",
    "--pill-border": appColors.statusWarning,
    "--pill-text": appColors.statusWarning,
  },
  postponed: {
    ...SESSION_PILL_STYLE,
    "--pill-bg": "rgba(156, 163, 175, 0.10)", 
    "--pill-border": "rgba(156, 163, 175, 0.4)",
    "--pill-text": "rgba(156, 163, 175, 0.9)",
  },
};

/* ============================================================================
   PLAN DETAIL (remove mt/text/border tokens from PlanSessionDetail)
============================================================================ */

export const PLAN_STRUCT_STACK = "space-y-3";

export const PLAN_BLOCK = "px-1";
export const PLAN_BLOCK_LABEL = "text-[11px] font-semibold opacity-80";
export const PLAN_BLOCK_TEXT = "mt-0.5 text-sm";

export const PLAN_MAIN_STACK = "mt-0.5 space-y-1 text-sm";
export const PLAN_MAIN_ITEM = "border-t pt-1 first:border-t-0 first:pt-0";
export const PLAN_MAIN_ITEM_STYLE: CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
};

export const PLAN_MAIN_TGT = "opacity-90";
export const PLAN_MAIN_NOTE = "opacity-90";

export const PLAN_EX_LIST = "space-y-1.5";

export const PLAN_EX_ITEM = "rounded-md border px-3 py-2";
export const PLAN_EX_ITEM_STYLE: CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
};

export const PLAN_EX_NAME = "text-sm font-medium";
export const PLAN_EX_LINE = "mt-0.5 text-xs opacity-85";
export const PLAN_EX_NOTE = "mt-0.5 text-xs opacity-85";

export const PLAN_NOTES = "mt-3 text-sm opacity-90";

export const PLAN_DEBUG_PRE =
  "text-[11px] whitespace-pre-wrap break-words opacity-85";