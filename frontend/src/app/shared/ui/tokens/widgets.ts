// src/app/shared/ui/tokens/widgets.ts
/*
 * Tokeny widgetov. Nové widgety skladaj z `shared/ui/widget/WidgetParts`
 * (Hero, Pill, Caption…) – tie berú veľkosti písma z WK nižšie, takže
 * jedna zmena tu sa prejaví vo všetkých widgetoch naraz.
 * WIDGET_* pod tým sú pre staršie widgety (recovery, performance), kým sa
 * neprerobia na WidgetParts.
 */
import type * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SURFACE_CARD, SURFACE_CARD_STYLE, PAD } from "./core";

/* ===== Widget kit (WidgetParts) ======================================== */

export const WK = {
  /** zvislé poradie častí widgetu */
  stack: "flex flex-col gap-3 text-left",
  heroValue: "text-3xl font-bold tabular-nums leading-none tracking-tight",
  heroValueMd: "text-lg font-bold leading-tight tracking-tight truncate",
  heroUnit: "text-sm",
  heroSub: "text-[11px] mt-1 truncate",
  caption: "text-[11px] truncate",
  label: "text-[10px] uppercase tracking-wide truncate",
  body: "text-xs leading-snug",
  headline: "text-sm font-medium leading-snug line-clamp-2",
  pill: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums",
} as const;

/* ===== WidgetCard ====================================================== */

export const WIDGET_CARD = SURFACE_CARD + " " + PAD.card + " text-left";
export const WIDGET_CARD_STYLE: React.CSSProperties = { ...SURFACE_CARD_STYLE };
export const WIDGET_CARD_INTERACTIVE = "transition-colors cursor-pointer focus:outline-none";
export const WIDGET_INNER = "flex flex-col text-left";
export const WIDGET_TITLE = "text-sm md:text-base font-semibold tracking-tight";
export const WIDGET_FOOTER = "mt-3";

export const WIDGET_NOTE = "opacity-80 text-sm mt-2";
export const WIDGET_NOTE_STYLE: React.CSSProperties = {
  color: appColors.textSecondary,
};

/* ===== staršie widgety ================================================= */

export const WIDGET_LOADING_CENTER = "grid place-items-center py-6";
export const WIDGET_LOADING_WRAP = WIDGET_LOADING_CENTER;

export const WIDGET_META_LABEL = "text-[11px] uppercase tracking-wide opacity-70";
export const WIDGET_VALUE_ROW = "mt-1 flex items-end gap-2";
export const WIDGET_VALUE_MAIN = "text-4xl font-extrabold tabular-nums";
export const WIDGET_VALUE_PRIMARY = "text-5xl font-extrabold leading-none";
export const WIDGET_VALUE_UNIT = "text-xl opacity-80";
export const WIDGET_METRIC_VALUE = "text-5xl font-extrabold leading-none tabular-nums";
export const WIDGET_ROW_BETWEEN = "flex items-start justify-between";
export const WIDGET_PLACEHOLDER = "text-xs opacity-60";
export const WIDGET_FOOTNOTE = "mt-3 text-xs opacity-85";

export const WIDGET_EMPTY = "opacity-75 text-sm py-6";
export const WIDGET_EMPTY_TEXT = "text-sm opacity-80";
export const WIDGET_INFO_TEXT = "text-sm opacity-80";
export const WIDGET_ERROR_TEXT = "text-sm";
export const WIDGET_ERROR_SUB = "mt-1 text-xs opacity-80";
