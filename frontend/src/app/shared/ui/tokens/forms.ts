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

// src/app/shared/ui/tokens/forms.ts  (alebo tam kde máš FORM_* tokeny)

export const FORM_GRID_THREE = "grid gap-3 sm:grid-cols-3 items-start";

export const SELECT_BASE = [
  "w-full",
  "h-10",
  "px-3",
  "rounded-xl",
  "border",
  "border-white/10",
  "bg-black/20",
  "text-slate-100",
  "appearance-none",
  "[color-scheme:dark]",
  "focus:outline-none",
  "focus:ring-2",
  "focus:ring-white/10",
].join(" ");

// --- form fields (green/yellow theme) ---
export const FIELD_LABEL = "text-xs font-medium text-amber-200/80";

export const FIELD_HINT = "text-[11px] text-amber-200/55";

export const FIELD_ERROR_TEXT = "text-xs text-rose-300";

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

// wrapper pre inline select (napr. TimeField24)
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

// select vnútri inline wrapperu
export const FIELD_SELECT = [
  "bg-transparent",
  "text-sm",
  "text-amber-100",
  "outline-none",
  "border-none",
  "focus:outline-none",
  "[color-scheme:dark]",
].join(" ");

// option background (inak iOS/desktop často dá bielu)
export const FIELD_OPTION = "bg-emerald-950 text-amber-100";

// --- disclosure / icons ---
export const DISCLOSURE_ICON_BASE = [
  "w-3.5",
  "h-3.5",
  "transition-transform",
  "duration-150",
  "text-amber-100/80",
].join(" ");

export const DISCLOSURE_ICON_OPEN = "rotate-180";
export const DISCLOSURE_ICON_CLOSED = "rotate-0";

// --- date field ---
export const DATE_FIELD_LABEL = "text-xs font-medium text-amber-200/80";

export const DATE_INPUT_INNER = [
  "w-full",
  "bg-transparent",
  "text-sm",
  "text-amber-100",
  "outline-none",
  "border-none",
  "focus:outline-none",
  "[color-scheme:dark]",
].join(" ");

// --- button misc (ponecháme buttonClass, ale “common” veci cez tokeny) ---
export const BUTTON_BLOCK = "w-full";
export const BUTTON_DISABLED = "opacity-40 cursor-not-allowed";

// --- spinner wrapper ---
export const SPINNER_WRAP = "relative inline-flex items-center justify-center align-middle";