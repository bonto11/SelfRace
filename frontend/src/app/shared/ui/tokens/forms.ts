// src/app/shared/ui/tokens/forms.ts
import { appColors } from "@/app/shared/theme/app_colors";
import { SURFACE_INSET, SURFACE_INSET_STYLE } from "./core";

/* ===== FORM ELEMENTS =================================================== */
export const FIELD_BASE = [
  "w-full rounded-md",
  `border border-[${appColors.inputBorder}]`,
  `bg-[${appColors.inputBg}]`,
  "px-2.5 py-2 text-sm outline-none transition-colors",
  `focus:ring-2 focus:ring-[${appColors.focusRing}]`,
  `focus:border-[${appColors.inputBorderFocus}]`,
].join(" ");

export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";
export const FIELD_HELP = `text-[11px] mt-1 text-[${appColors.textMuted}]`;
export const MUTED_TEXT = `text-xs text-[${appColors.textMuted}]`;

export const TEXTAREA_BASE = [
  "w-full rounded-md border px-3 py-2 resize-y",
  `bg-[${appColors.inputBg}]`,
  `border-[${appColors.inputBorder}]`,
  `text-[${appColors.inputText}]`,
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-[${appColors.focusRing}]`,
].join(" ");

export const labelClass =
  `text-xs font-medium tracking-wide select-none text-[${appColors.textMuted}]`;
export const hintClass = `text-xs text-[${appColors.textMuted}]`;

export const inputClass = [
  "w-full rounded-lg px-3 py-2",
  `bg-[${appColors.inputBg}]`,
  `text-[${appColors.inputText}]`,
  `border border-[${appColors.inputBorder}]`,
  "placeholder:opacity-60",
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-[${appColors.focusRing}]`,
].join(" ");

/* ===== Sekcie a form gridy ============================================ */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const SECTION_STYLE = SURFACE_INSET_STYLE;
export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";

/* ===== Prefs pills ===================================================== */
export const PREFS_PILL =
  `rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ` +
  `focus:outline-none focus:ring-2 focus:ring-[${appColors.focusRing}]`;

export const COLOR_PREFS_ACTIVE =
  `bg-[${appColors.pillActiveBg}] text-[${appColors.pillActiveText}] border-[${appColors.pillActiveBorder}] ` +
  `hover:brightness-110`;

export const COLOR_PREFS_INACTIVE =
  `bg-[${appColors.pillBg}] text-[${appColors.pillText}] border-[${appColors.pillBorder}] ` +
  `hover:bg-[${appColors.pillBgHover}]`;

/* ===== Mikro komponenty =============================================== */
export const PILL_BUTTON = [
  "shrink-0 px-4 py-2 rounded-xl border transition-colors text-sm font-medium",
  `border-[${appColors.pillBorder}]`,
  `bg-[${appColors.pillBg}]`,
  `hover:bg-[${appColors.pillBgHover}]`,
  `text-[${appColors.pillText}]`,
].join(" ");