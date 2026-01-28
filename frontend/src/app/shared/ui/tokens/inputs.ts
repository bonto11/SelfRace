// src/app/shared/ui/tokens/inputs.ts
import type { CSSProperties } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SURFACE_INSET, SURFACE_INSET_STYLE } from "./core";
import type { ButtonSize, ButtonVariant } from "@/app/shared/ui/utils/inputs";
/* =========================================================================
   FORM TOKENS (single source of truth)
   - Tailwind CANNOT compile runtime strings like bg-[${...}]
   - So we use CSS variables + static Tailwind classes that reference var(...)
   - Two variants: editable (default) + readonly
   ========================================================================= */

type VarStyle = CSSProperties & Record<`--${string}`, string>;

/* =========================================================================
   Labels / hint / error text
   ========================================================================= */
export const FIELD_LABEL = [
  "text-xs font-medium tracking-wide select-none",
  "text-[var(--field-label)]",
].join(" ");

export const FIELD_HINT = ["text-[11px]", "text-[var(--field-hint)]"].join(" ");

export const FIELD_ERROR_TEXT = [
  "text-xs",
  "text-[var(--field-err-text)]",
].join(" ");

/* These are used via style on wrappers/containers */
export const FORM_TEXT_VARS: VarStyle = {
  "--field-label": appColors.textMuted,
  "--field-hint": appColors.textMuted,
  "--field-err-text": appColors.statusError,
};

/* =========================================================================
   Field base anatomy (shared)
   ========================================================================= */
const FIELD_ANATOMY = [
  "w-full",
  "h-10",
  "px-3",
  "rounded-xl",
  "border",
  "outline-none",
  "ring-0",
  "placeholder:opacity-70",
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
  "focus:ring-2",
  "focus:ring-offset-0",

  // COLORS via CSS vars (static Tailwind)
  "border-[var(--field-border)]",
  "bg-[var(--field-bg)]",
  "text-[var(--field-text)]",
  "placeholder:text-[var(--field-ph)]",
  "hover:bg-[var(--field-bg-hover)]",
  "focus:border-[var(--field-border-focus)]",
  "focus:ring-[var(--field-ring)]",
].join(" ");

/* =========================================================================
   READONLY vs EDITABLE (vars)
   ========================================================================= */
export const FIELD_READONLY_STYLE: VarStyle = {
  "--field-border": appColors.inputBorder,
  "--field-bg": appColors.inputBg,
  "--field-bg-hover": appColors.inputBgHover,
  "--field-text": appColors.inputText,
  "--field-ph": appColors.inputPlaceholder,
  "--field-border-focus": appColors.inputBorderFocus,
  "--field-ring": appColors.focusRing,
};

export const FIELD_EDITABLE_STYLE: VarStyle = {
  "--field-border": appColors.editableBorder,
  "--field-bg": appColors.editableBg,
  "--field-bg-hover": appColors.editableBgHover,
  "--field-text": appColors.editableText,
  "--field-ph": appColors.editablePlaceholder,
  "--field-border-focus": appColors.editableBorderFocus,
  "--field-ring": appColors.editableRing,
};

/* ===== Readonly input (glass) ========================================= */
export const FIELD_READONLY_BASE = [
  FIELD_ANATOMY,
  // keep native controls matching darker UI
  "[color-scheme:dark]",
].join(" ");

/* ===== Editable input (light green) =================================== */
export const FIELD_EDITABLE_BASE = [
  FIELD_ANATOMY,
  // important for date/time inputs to not go "white/black" weird
  "[color-scheme:light]",
].join(" ");

/* ===== Error overlay (works on both) ================================== */
export const FIELD_ERROR = [
  "border-[var(--field-err-border)]",
  "focus:border-[var(--field-err-border-focus)]",
  "focus:ring-[var(--field-err-ring)]",
].join(" ");

export const FIELD_ERROR_STYLE: VarStyle = {
  "--field-err-border": appColors.statusError,
  "--field-err-border-focus": appColors.statusError,
  "--field-err-ring": appColors.statusError,
};

/* =========================================================================
   Inline wrappers (select/time) — same 2 variants
   ========================================================================= */
const FIELD_INLINE_ANATOMY = [
  "w-full",
  "px-3",
  "py-2",
  "rounded-xl",
  "border",
  "outline-none",
  "focus-within:ring-2",
  "focus-within:ring-offset-0",
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",

  // COLORS via vars
  "border-[var(--fieldi-border)]",
  "bg-[var(--fieldi-bg)]",
  "text-[var(--fieldi-text)]",
  "focus-within:border-[var(--fieldi-border-focus)]",
  "focus-within:ring-[var(--fieldi-ring)]",
].join(" ");

export const FIELD_INLINE_READONLY = [
  FIELD_INLINE_ANATOMY,
  "[color-scheme:dark]",
].join(" ");

export const FIELD_INLINE_EDITABLE = [
  FIELD_INLINE_ANATOMY,
  "[color-scheme:light]",
].join(" ");

export const FIELD_INLINE_READONLY_STYLE: VarStyle = {
  "--fieldi-border": appColors.readonlyBorder,
  "--fieldi-bg": appColors.readonlyBg,
  "--fieldi-text": appColors.readonlyText,
  "--fieldi-border-focus": appColors.readonlyBorderFocus,
  "--fieldi-ring": appColors.readonlyRing,
};

export const FIELD_INLINE_EDITABLE_STYLE: VarStyle = {
  "--fieldi-border": appColors.editableBorder,
  "--fieldi-bg": appColors.editableBg,
  "--fieldi-text": appColors.editableText,
  "--fieldi-border-focus": appColors.editableBorderFocus,
  "--fieldi-ring": appColors.editableRing,
};

export const FIELD_SELECT = [
  "bg-transparent",
  "text-sm",
  "outline-none",
  "border-none",
  "focus:outline-none",
].join(" ");

/* option background (browsers love white) */
export const FIELD_OPTION = "bg-[var(--opt-bg)] text-[var(--opt-text)]";

export const FIELD_OPTION_READONLY_STYLE: VarStyle = {
  "--opt-bg": appColors.readonlyBg,
  "--opt-text": appColors.readonlyText,
};

export const FIELD_OPTION_EDITABLE_STYLE: VarStyle = {
  "--opt-bg": appColors.editableBg,
  "--opt-text": appColors.editableText,
};

/* =========================================================================
   Textarea (2 variants)
   ========================================================================= */
const TEXTAREA_ANATOMY = [
  "w-full",
  "min-h-[96px]",
  "rounded-xl",
  "border",
  "px-3",
  "py-2",
  "text-sm",
  "resize-y",
  "outline-none",
  "placeholder:opacity-70",
  "focus:ring-2",
  "focus:ring-offset-0",
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",

  // COLORS via vars
  "border-[var(--ta-border)]",
  "bg-[var(--ta-bg)]",
  "text-[var(--ta-text)]",
  "placeholder:text-[var(--ta-ph)]",
  "focus:border-[var(--ta-border-focus)]",
  "focus:ring-[var(--ta-ring)]",
].join(" ");

export const TEXTAREA_READONLY_BASE = [
  TEXTAREA_ANATOMY,
  "[color-scheme:dark]",
].join(" ");

export const TEXTAREA_EDITABLE_BASE = [
  TEXTAREA_ANATOMY,
  "[color-scheme:light]",
].join(" ");

export const TEXTAREA_READONLY_STYLE: VarStyle = {
  "--ta-border": appColors.readonlyBorder,
  "--ta-bg": appColors.readonlyBg,
  "--ta-text": appColors.readonlyText,
  "--ta-ph": appColors.readonlyPlaceholder,
  "--ta-border-focus": appColors.readonlyBorderFocus,
  "--ta-ring": appColors.readonlyRing,
};

export const TEXTAREA_EDITABLE_STYLE: VarStyle = {
  "--ta-border": appColors.editableBorder,
  "--ta-bg": appColors.editableBg,
  "--ta-text": appColors.editableText,
  "--ta-ph": appColors.editablePlaceholder,
  "--ta-border-focus": appColors.editableBorderFocus,
  "--ta-ring": appColors.editableRing,
};

/* =========================================================================
   Layout / grids
   ========================================================================= */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const SECTION_STYLE = SURFACE_INSET_STYLE;

export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";
export const FORM_GRID_THREE = "grid gap-3 sm:grid-cols-3 items-start";

/* =========================================================================
   Select menu (portal) — variant-specific
   ========================================================================= */
export const SELECT_MENU_WRAP = "relative";

export const SELECT_MENU = [
  "rounded-xl",
  "border",
  "backdrop-blur",
  "p-1",
  "shadow-lg",

  // COLORS via vars
  "bg-[var(--menu-bg)]",
  "border-[var(--menu-border)]",
  "text-[var(--menu-text)]",
].join(" ");

export const SELECT_MENU_READONLY = "[color-scheme:dark]";
export const SELECT_MENU_EDITABLE = "[color-scheme:light]";

export const SELECT_MENU_READONLY_STYLE: VarStyle = {
  "--menu-bg": appColors.readonlyBg,
  "--menu-border": appColors.readonlyBorder,
  "--menu-text": appColors.readonlyText,
};

export const SELECT_MENU_EDITABLE_STYLE: VarStyle = {
  "--menu-bg": appColors.editableBg,
  "--menu-border": appColors.editableBorder,
  "--menu-text": appColors.editableText,
};

export const SELECT_BTN =
  "w-full flex items-center justify-between gap-2 text-left";
export const SELECT_ICON = "shrink-0 h-3.5 w-3.5 opacity-60";

export const SELECT_OPT = [
  "w-full px-3 py-2 rounded-lg text-sm",
  "hover:bg-[var(--opt-hover)]",
  "active:bg-[var(--opt-active)]",
].join(" ");

export const SELECT_OPT_ACTIVE = "bg-[var(--opt-active)]";
export const SELECT_OPT_EMPTY = "opacity-70";

export const SELECT_OPT_READONLY_STYLE: VarStyle = {
  "--opt-hover": "rgba(255,255,255,0.06)",
  "--opt-active": "rgba(255,255,255,0.10)",
};

export const SELECT_OPT_EDITABLE_STYLE: VarStyle = {
  "--opt-hover": "rgba(0,0,0,0.06)",
  "--opt-active": "rgba(0,0,0,0.10)",
};

/* =========================================================================
   Checkbox (2 variants)
   ========================================================================= */
export const CHECKBOX_ROW = "flex items-start gap-2 select-none";

const CHECKBOX_ANATOMY = [
  "relative mt-0.5 h-5 w-5 shrink-0",
  "appearance-none rounded-md border outline-none",
  "focus:ring-2 focus:ring-offset-0",
  "disabled:opacity-60 disabled:cursor-not-allowed",

  // check mark
  "checked:after:content-[''] checked:after:absolute checked:after:left-1.5 checked:after:top-[5px]",
  "checked:after:h-[8px] checked:after:w-[5px] checked:after:rotate-45",
  "checked:after:border-r-2 checked:after:border-b-2",

  // COLORS via vars
  "border-[var(--cb-border)]",
  "bg-[var(--cb-bg)]",
  "focus:ring-[var(--cb-ring)]",
  "enabled:hover:bg-[var(--cb-bg-hover)]",
  "checked:border-[var(--cb-border-focus)]",
  "checked:after:border-[var(--cb-check)]",
].join(" ");

export const CHECKBOX_BOX_READONLY = [
  CHECKBOX_ANATOMY,
  "[color-scheme:dark]",
].join(" ");
export const CHECKBOX_BOX_EDITABLE = [
  CHECKBOX_ANATOMY,
  "[color-scheme:light]",
].join(" ");

export const CHECKBOX_BOX_READONLY_STYLE: VarStyle = {
  "--cb-border": appColors.readonlyBorder,
  "--cb-bg": appColors.readonlyBg,
  "--cb-bg-hover": appColors.readonlyBgHover,
  "--cb-ring": appColors.readonlyRing,
  "--cb-border-focus": appColors.readonlyBorderFocus,
  "--cb-check": appColors.readonlyText,
};

export const CHECKBOX_BOX_EDITABLE_STYLE: VarStyle = {
  "--cb-border": appColors.editableBorder,
  "--cb-bg": appColors.editableBg,
  "--cb-bg-hover": appColors.editableBgHover,
  "--cb-ring": appColors.editableRing,
  "--cb-border-focus": appColors.editableBorderFocus,
  "--cb-check": appColors.editableText,
};

export const CHECKBOX_LABEL = "min-w-0 text-sm";
export const CHECKBOX_HINT = [
  "block text-[11px] mt-0.5",
  "text-[var(--field-hint)]",
].join(" ");

/* =========================================================================
   Legacy aliases (keep old imports working)
   - FIELD_BASE stays = readonly to avoid breaking dashboards
   ========================================================================= */
export const FIELD_BASE = FIELD_READONLY_BASE;
export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";
export const inputClass = FIELD_BASE;
export const labelClass = FIELD_LABEL;
export const hintClass = FIELD_HINT;

/* =========================================================================
   Buttons / misc legacy tokens (unchanged)
   ========================================================================= */
export const BUTTON_BLOCK =
  "inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition select-none";

export const BUTTON_DISABLED =
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

export const DATE_FIELD_LABEL = "block text-xs font-medium opacity-80";
export const DATE_INPUT_INNER =
  "w-full rounded px-3 py-2 text-sm bg-transparent outline-none";

export const DISCLOSURE_ICON_BASE =
  "inline-flex items-center justify-center transition-transform";
export const DISCLOSURE_ICON_OPEN = "rotate-180";
export const DISCLOSURE_ICON_CLOSED = "rotate-0";

export const FIELD_HELP = "mt-1 text-xs opacity-70";

export const INPUTS_CARD_DATE_ROW = "mt-3";
export const INPUTS_CARD_DATE_INNER = "flex items-center justify-between gap-2";

export const INPUTS_CARD_DATE_PILL =
  "text-center px-3 py-2 !rounded-xl w-[min(220px,60vw)] [color-scheme:dark]";

export const INPUTS_CARD_BODY = "mt-4";

export const INPUTS_CARD_FOOTER = "mt-4 flex flex-col items-center gap-2";
export const INPUTS_CARD_SAVE_WRAP = "w-full";
export const INPUTS_CARD_SAVE_BTN = "w-full";

export const INPUTS_CARD_LABEL_SM_1 = "text-sm mb-1";
export const INPUTS_CARD_LABEL_SM_2 = "text-sm mb-2";

export const INPUTS_CARD_CHECK_ROW = "flex items-center gap-2 text-sm";
export const INPUTS_CARD_CHECK_ROW_MB = "flex items-center gap-2 mb-2 text-sm";

export const INPUTS_CARD_TOGGLE = "";

export const DATE_TEXT_INPUT = "";

export const DATEFIELD_DISPLAY = "h-full flex items-center";

/* =========================================================================
   Button tokens (single source of truth)
   - NO runtime Tailwind strings
   - Colors via CSS vars only
   ========================================================================= */

export const BUTTON_BASE = [
  "inline-flex items-center justify-center gap-2",
  "font-medium select-none",
  "transition-colors duration-200",
  "focus:outline-none focus-visible:ring-2 ring-offset-0",
  "rounded-full",
  // vars
  "bg-[var(--btn-bg)]",
  "text-[var(--btn-text)]",
  "border border-[var(--btn-border)]",
  "hover:bg-[var(--btn-bg-hover)]",
  "active:brightness-95",
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
  "focus-visible:ring-[var(--btn-ring)]",
].join(" ");

export function buttonSizeClass(size: ButtonSize, circle?: boolean) {
  if (size === "xs") return circle ? "h-7 w-7 text-xs" : "px-3 py-1.5 text-xs";
  if (size === "sm") return circle ? "h-8 w-8 text-sm" : "px-3.5 py-2 text-sm";
  if (size === "lg")
    return circle ? "h-11 w-11 text-base" : "px-5 py-3 text-base";
  return circle ? "h-9 w-9 text-sm" : "px-4 py-2.5 text-sm";
}

/* =========================================================================
   Variant styles
   ========================================================================= */

export const BUTTON_STYLE: Record<ButtonVariant, VarStyle> = {
  primary: {
    "--btn-bg": appColors.buttonPrimaryBg,
    "--btn-bg-hover": appColors.buttonPrimaryBgHover,
    "--btn-text": appColors.buttonPrimaryText,
    "--btn-border": "transparent",
    "--btn-ring": appColors.focusRing,
    // old: "bg-primary text-[color:var(--on-primary)] hover:brightness-110"
  },

  secondary: {
    "--btn-bg": appColors.buttonSecondaryBg,
    "--btn-bg-hover": appColors.buttonSecondaryBgHover,
    "--btn-text": appColors.buttonSecondaryText,
    "--btn-border": appColors.buttonSecondaryBorder,
    "--btn-ring": appColors.focusRing,
    // old: "bg-white/10 text-white hover:bg-white/16 border border-white/15"
  },

  ghost: {
    "--btn-bg": appColors.buttonGhostBg,
    "--btn-bg-hover": appColors.buttonGhostBgHover,
    "--btn-text": appColors.buttonGhostText,
    "--btn-border": appColors.widgetBorder,
    "--btn-ring": appColors.focusRing,
    // old: "bg-transparent text-white/90 hover:bg-white/8 border border-white/10"
  },

  success: {
    "--btn-bg": appColors.statusSuccess,
    "--btn-bg-hover": appColors.statusSuccess, // ak máš hover token, daj sem
    "--btn-text": appColors.textInverse,
    "--btn-border": "transparent",
    "--btn-ring": appColors.focusRing,
    // old: "bg-emerald-600 text-white hover:bg-emerald-500"
  },

  danger: {
    "--btn-bg": appColors.buttonDangerBg,
    "--btn-bg-hover": appColors.buttonDangerBgHover,
    "--btn-text": appColors.buttonDangerText,
    "--btn-border": "transparent",
    "--btn-ring": appColors.focusRing,
    // old: "bg-red-600 text-white hover:bg-red-500"
  },

  back: {
    "--btn-bg": appColors.buttonGhostBg,
    "--btn-bg-hover": appColors.buttonGhostBgHover,
    "--btn-text": appColors.textPrimary,
    "--btn-border": appColors.widgetBorder,
    "--btn-ring": appColors.focusRing,
    // old: "bg-white/8 text-white hover:bg-white/14 border border-white/10"
  },

  prefs: {
    // default (inactive) — aktívny stav riešime v helperi nižšie
    "--btn-bg": appColors.buttonSecondaryBg,
    "--btn-bg-hover": appColors.buttonSecondaryBgHover,
    "--btn-text": appColors.buttonSecondaryText,
    "--btn-border": "transparent",
    "--btn-ring": "transparent",
    // old inactive: "bg-white/10 text-white hover:bg-white/16 border-0 ring-0"
  },

  editable: {
    "--btn-bg": appColors.editableBg,
    "--btn-bg-hover": appColors.editableBgHover,
    "--btn-text": appColors.editableText,
    "--btn-border": appColors.editableBorder,
    "--btn-ring": appColors.editableRing,
    // old-ish: secondary look, ale “zelené inputy”
  },

  active: {
    "--btn-bg": appColors.brandPrimary,
    "--btn-bg-hover": appColors.brandSecondary,
    "--btn-text": appColors.textInverse,
    "--btn-border": "transparent",
    "--btn-ring": appColors.focusRing,
    // old: "bg-emerald-600 text-white hover:bg-emerald-500"
  },

  connectStrava: {
    "--btn-bg": "transparent",
    "--btn-bg-hover": "transparent",
    "--btn-text": appColors.textPrimary,
    "--btn-border": "transparent",
    "--btn-ring": "transparent",
  },

  disconnectStrava: {
    "--btn-bg": "transparent",
    "--btn-bg-hover": appColors.overlay,
    "--btn-text": appColors.textPrimary,
    "--btn-border": appColors.widgetBorder,
    "--btn-ring": "transparent",
    // old: "bg-transparent text-white/90 border border-white/15 hover:bg-white/8 ring-0"
  },

  viewOnStrava: {
    "--btn-bg": appColors.backgroundStrava,
    "--btn-bg-hover": appColors.backgroundStrava,
    "--btn-text": appColors.textInverse,
    "--btn-border": appColors.widgetBorder,
    "--btn-ring": "transparent",
    // old: border white/15 + brightness
  },
};

/* prefs ACTIVE override (keď používaš active flag) */
export function buttonVariantStyle(
  variant: ButtonVariant,
  { active }: { active?: boolean } = {},
): VarStyle {
  if (variant === "prefs" && active) {
    return {
      "--btn-bg": appColors.brandPrimary,
      "--btn-bg-hover": appColors.brandSecondary,
      "--btn-text": appColors.textInverse,
      "--btn-border": "transparent",
      "--btn-ring": "transparent",
      // old active prefs: "bg-emerald-600 text-white border-0 ring-0"
    };
  }
  return BUTTON_STYLE[variant];
}
