// src/app/shared/ui/tokens/forms.ts
import { appColors } from "@/app/shared/theme/app_colors";
import { SURFACE_INSET, SURFACE_INSET_STYLE } from "./core";

/* =========================================================================
   FORM TOKENS (single source of truth)
   - All colors MUST come from appColors (palettes)
   - Legacy: inputClass/labelClass/hintClass aliases kept for compatibility
   ========================================================================= */

/* ===== Field label / hint / error ===================================== */
export const FIELD_LABEL = [
  "text-xs font-medium tracking-wide select-none",
  `text-[${appColors.textMuted}]`,
].join(" ");

export const FIELD_HINT = [
  "text-[11px]",
  `text-[${appColors.textMuted}]`,
].join(" ");

export const FIELD_ERROR_TEXT = [
  "text-xs",
  // ak nemáš error farbu v palete, dočasne používame textPrimary (viditeľné)
  // a neskôr si doplníš appColors.dangerText / errorText
  `text-[${(appColors as any).errorText ?? appColors.textPrimary}]`,
].join(" ");

/* ===== Base input ====================================================== */
export const FIELD_BASE = [
  "w-full",
  "h-10",
  "px-3",
  "rounded-xl",
  "border",
  `border-[${appColors.inputBorder}]`,
  `bg-[${appColors.inputBg}]`,
  `text-[${appColors.inputText}]`,
  "placeholder:opacity-60",
  "outline-none",
  "ring-0",
  `focus:border-[${appColors.inputBorderFocus}]`,
  "focus:ring-2",
  `focus:ring-[${appColors.focusRing}]`,
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
  "[color-scheme:dark]",
].join(" ");

export const FIELD_ERROR = [
  // ak nemáš error farby v palete, držíme sa focus ringu (aspoň kontrast)
  `border-[${(appColors as any).errorBorder ?? appColors.inputBorderFocus}]`,
  `focus:border-[${(appColors as any).errorBorderFocus ?? appColors.inputBorderFocus}]`,
  `focus:ring-[${(appColors as any).errorRing ?? appColors.focusRing}]`,
].join(" ");

export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";

/* ===== Inline wrapper (select/time inside) ============================= */
export const FIELD_INLINE = [
  "w-full",
  "px-3",
  "py-2",
  "rounded-xl",
  "border",
  `border-[${appColors.inputBorder}]`,
  `bg-[${appColors.inputBg}]`,
  `text-[${appColors.inputText}]`,
  "outline-none",
  `focus-within:border-[${appColors.inputBorderFocus}]`,
  "focus-within:ring-2",
  `focus-within:ring-[${appColors.focusRing}]`,
  "[color-scheme:dark]",
].join(" ");

export const FIELD_SELECT = [
  "bg-transparent",
  "text-sm",
  "outline-none",
  "border-none",
  "focus:outline-none",
  `[color:${appColors.inputText}]`,
  "[color-scheme:dark]",
].join(" ");

// option background (inak prehliadače často hodia bielu)
export const FIELD_OPTION = [
  `bg-[${appColors.inputBg}]`,
  `text-[${appColors.inputText}]`,
].join(" ");

/* ===== Textarea ======================================================== */
export const TEXTAREA_BASE = [
  "w-full",
  "min-h-[96px]",
  "rounded-xl",
  "border",
  `border-[${appColors.inputBorder}]`,
  `bg-[${appColors.inputBg}]`,
  `text-[${appColors.inputText}]`,
  "placeholder:opacity-60",
  "px-3",
  "py-2",
  "text-sm",
  "resize-y",
  "outline-none",
  `focus:border-[${appColors.inputBorderFocus}]`,
  "focus:ring-2",
  `focus:ring-[${appColors.focusRing}]`,
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
  "[color-scheme:dark]",
].join(" ");

/* ===== Layout / grids ================================================== */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const SECTION_STYLE = SURFACE_INSET_STYLE;

export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";
export const FORM_GRID_THREE = "grid gap-3 sm:grid-cols-3 items-start";

/* ===== Select base (standalone select) ================================= */
export const SELECT_BASE = [FIELD_BASE, "appearance-none"].join(" ");

/* ===== Prefs pills (palettes only) ===================================== */
export const PREFS_PILL =
  `rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ` +
  `focus:outline-none focus:ring-2 focus:ring-[${appColors.focusRing}]`;

export const COLOR_PREFS_ACTIVE =
  `bg-[${appColors.pillActiveBg}] text-[${appColors.pillActiveText}] border-[${appColors.pillActiveBorder}] ` +
  `hover:brightness-110`;

export const COLOR_PREFS_INACTIVE =
  `bg-[${appColors.pillBg}] text-[${appColors.pillText}] border-[${appColors.pillBorder}] ` +
  `hover:bg-[${appColors.pillBgHover}]`;

/* ===== Pill button (date +/- etc.) ===================================== */
export const PILL_BUTTON = [
  "shrink-0 px-4 py-2 rounded-xl border transition-colors text-sm font-medium",
  `border-[${appColors.pillBorder}]`,
  `bg-[${appColors.pillBg}]`,
  `hover:bg-[${appColors.pillBgHover}]`,
  `text-[${appColors.pillText}]`,
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
  "focus:outline-none",
  "focus:ring-2",
  `focus:ring-[${appColors.focusRing}]`,
  "[color-scheme:dark]",
].join(" ");

/* ===== Misc ============================================================ */
export const MUTED_TEXT = ["text-xs", `text-[${appColors.textMuted}]`].join(" ");

/* ===== Legacy aliases (keep old imports working) ======================= */
export const inputClass = FIELD_BASE;
export const labelClass = FIELD_LABEL;
export const hintClass = FIELD_HINT;