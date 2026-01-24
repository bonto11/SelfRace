// src/app/shared/ui/tokens/forms.ts
import { appColors } from "@/app/shared/theme/app_colors";
import { SURFACE_INSET, SURFACE_INSET_STYLE } from "./core";

/* =========================================================================
   FORM TOKENS (single source of truth)
   - New: FIELD_* tokens (green / yellow theme)
   - Legacy: inputClass/labelClass/hintClass are aliases to FIELD_* to avoid breaking imports
   ========================================================================= */

/* ===== Field label / hint / error ===================================== */
export const FIELD_LABEL = "text-xs font-medium text-amber-200/80";
export const FIELD_HINT = "text-[11px] text-amber-200/55";
export const FIELD_ERROR_TEXT = "text-xs text-rose-300";

/* ===== Base input ======================================================= */
export const FIELD_BASE = [
  "w-full",
  "h-10",
  "px-3",
  "rounded-xl",
  "border",
  "border-emerald-200/15",
  "bg-emerald-950/28",
  "text-amber-100",
  "placeholder:text-amber-200/35",
  "outline-none",
  "ring-0",
  "focus:border-emerald-200/30",
  "focus:ring-2",
  "focus:ring-emerald-400/18",
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
  "[color-scheme:dark]",
].join(" ");

export const FIELD_ERROR = [
  "border-rose-400/50",
  "focus:border-rose-300/60",
  "focus:ring-rose-400/18",
].join(" ");

export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";

/* ===== Inline wrapper (select/time inside) ============================== */
export const FIELD_INLINE = [
  "w-full",
  "px-3",
  "py-2",
  "rounded-xl",
  "border",
  "border-emerald-200/15",
  "bg-emerald-950/28",
  "text-amber-100",
  "outline-none",
  "focus-within:border-emerald-200/30",
  "focus-within:ring-2",
  "focus-within:ring-emerald-400/18",
  "[color-scheme:dark]",
].join(" ");

export const FIELD_SELECT = [
  "bg-transparent",
  "text-sm",
  "text-amber-100",
  "outline-none",
  "border-none",
  "focus:outline-none",
  "[color-scheme:dark]",
].join(" ");

// option background (inak prehliadače často hodia bielu)
export const FIELD_OPTION = "bg-emerald-950 text-amber-100";

/* ===== Textarea ========================================================= */
export const TEXTAREA_BASE = [
  "w-full",
  "min-h-[96px]",
  "rounded-xl",
  "border",
  "border-emerald-200/15",
  "bg-emerald-950/28",
  "px-3",
  "py-2",
  "text-sm",
  "text-amber-100",
  "placeholder:text-amber-200/35",
  "resize-y",
  "outline-none",
  "focus:border-emerald-200/30",
  "focus:ring-2",
  "focus:ring-emerald-400/18",
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
  "[color-scheme:dark]",
].join(" ");

/* ===== Layout / grids =================================================== */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const SECTION_STYLE = SURFACE_INSET_STYLE;

export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";
export const FORM_GRID_THREE = "grid gap-3 sm:grid-cols-3 items-start";

/* ===== Select base (standalone select without wrapper) ================== */
export const SELECT_BASE = [
  FIELD_BASE,
  "appearance-none",
].join(" ");

/* ===== Prefs pills (leave appColors-based; this is “old system” and OK) == */
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
  "shrink-0",
  "px-4",
  "py-2",
  "rounded-xl",
  "border",
  "transition-colors",
  "text-sm",
  "font-medium",
  "border-emerald-200/15",
  "bg-emerald-950/28",
  "text-amber-100",
  "hover:border-emerald-200/25",
  "hover:bg-emerald-950/34",
  "focus:outline-none",
  "focus:ring-2",
  "focus:ring-emerald-400/18",
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
  "[color-scheme:dark]",
].join(" ");

/* ===== Misc small helpers ============================================== */
export const MUTED_TEXT = "text-xs text-amber-200/55";

/* ===== Legacy aliases (keep old imports working) ======================== */
// These are intentionally kept to avoid breaking imports across the app.
// Prefer FIELD_* in new code.
export const inputClass = FIELD_BASE;
export const labelClass = FIELD_LABEL;
export const hintClass = FIELD_HINT;