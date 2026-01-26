// src/app/shared/ui/tokens/inputs.ts
import { appColors } from "@/app/shared/theme/app_colors";
import { SURFACE_INSET, SURFACE_INSET_STYLE } from "./core";

/* =========================================================================
   FORM TOKENS (single source of truth)
   - All colors MUST come from appColors (palettes)
   - Two variants: editable (default) + readonly
   ========================================================================= */

/* ===== Label / hint / error =========================================== */
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
  `text-[${(appColors as any).errorText ?? appColors.textPrimary}]`,
].join(" ");

/* ===== Field base (shared anatomy) ==================================== */
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
].join(" ");

/* =========================================================================
   READONLY vs EDITABLE
   - readonly: your "dark glass" (safe for dashboards/widgets)
   - editable: your "light green" (inputs that user edits)
   - appColors.* keys are assumed to exist (we'll add them in palette)
   ========================================================================= */

/* ===== Readonly input (glass) ========================================= */
export const FIELD_READONLY_BASE = [
  FIELD_ANATOMY,
  `border-[${(appColors as any).readonlyBorder ?? appColors.inputBorder}]`,
  `bg-[${(appColors as any).readonlyBg ?? appColors.inputBg}]`,
  `text-[${(appColors as any).readonlyText ?? appColors.inputText}]`,
  `placeholder:text-[${(appColors as any).readonlyPlaceholder ?? appColors.inputPlaceholder}]`,
  `focus:border-[${(appColors as any).readonlyBorderFocus ?? appColors.inputBorderFocus}]`,
  `hover:bg-[${(appColors as any).readonlyBgHover ?? appColors.inputBgHover}]`,
  `focus:ring-[${(appColors as any).readonlyRing ?? appColors.focusRing}]`,
  // keep native controls matching darker UI
  "[color-scheme:dark]",
].join(" ");

/* ===== Editable input (light green) =================================== */
export const FIELD_EDITABLE_BASE = [
  FIELD_ANATOMY,
  `border-[${(appColors as any).editableBorder}]`,
  `bg-[${(appColors as any).editableBg}]`,
  `text-[${(appColors as any).editableText}]`,
  `placeholder:text-[${(appColors as any).editablePlaceholder}]`,
  `focus:border-[${(appColors as any).editableBorderFocus}]`,
  `hover:bg-[${(appColors as any).editableBgHover}]`,
  `focus:ring-[${(appColors as any).editableRing ?? appColors.focusRing}]`,
  // important for date/time inputs to not go "white/black" weird
  "[color-scheme:light]",
].join(" ");

/* ===== Error overlay (works on both) ================================== */
export const FIELD_ERROR = [
  `border-[${(appColors as any).errorBorder ?? appColors.inputBorderFocus}]`,
  `focus:border-[${(appColors as any).errorBorderFocus ?? appColors.inputBorderFocus}]`,
  `focus:ring-[${(appColors as any).errorRing ?? appColors.focusRing}]`,
].join(" ");

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
].join(" ");

export const FIELD_INLINE_READONLY = [
  FIELD_INLINE_ANATOMY,
  `border-[${(appColors as any).readonlyBorder ?? appColors.inputBorder}]`,
  `bg-[${(appColors as any).readonlyBg ?? appColors.inputBg}]`,
  `text-[${(appColors as any).readonlyText ?? appColors.inputText}]`,
  `focus-within:border-[${(appColors as any).readonlyBorderFocus ?? appColors.inputBorderFocus}]`,
  `focus-within:ring-[${(appColors as any).readonlyRing ?? appColors.focusRing}]`,
  "[color-scheme:dark]",
].join(" ");

export const FIELD_INLINE_EDITABLE = [
  FIELD_INLINE_ANATOMY,
  `border-[${(appColors as any).editableBorder}]`,
  `bg-[${(appColors as any).editableBg}]`,
  `text-[${(appColors as any).editableText}]`,
  `focus-within:border-[${(appColors as any).editableBorderFocus}]`,
  `focus-within:ring-[${(appColors as any).editableRing ?? appColors.focusRing}]`,
  "[color-scheme:light]",
].join(" ");

export const FIELD_SELECT = [
  "bg-transparent",
  "text-sm",
  "outline-none",
  "border-none",
  "focus:outline-none",
].join(" ");

/* option background (browsers love white) */
export const FIELD_OPTION_READONLY = [
  `bg-[${(appColors as any).readonlyBg ?? appColors.inputBg}]`,
  `text-[${(appColors as any).readonlyText ?? appColors.inputText}]`,
].join(" ");

export const FIELD_OPTION_EDITABLE = [
  `bg-[${(appColors as any).editableBg}]`,
  `text-[${(appColors as any).editableText}]`,
].join(" ");

/* ===== Textarea (2 variants) ========================================== */
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
].join(" ");

export const TEXTAREA_READONLY_BASE = [
  TEXTAREA_ANATOMY,
  `border-[${(appColors as any).readonlyBorder ?? appColors.inputBorder}]`,
  `bg-[${(appColors as any).readonlyBg ?? appColors.inputBg}]`,
  `text-[${(appColors as any).readonlyText ?? appColors.inputText}]`,
  `placeholder:text-[${(appColors as any).readonlyPlaceholder ?? appColors.inputPlaceholder}]`,
  `focus:border-[${(appColors as any).readonlyBorderFocus ?? appColors.inputBorderFocus}]`,
  `focus:ring-[${(appColors as any).readonlyRing ?? appColors.focusRing}]`,
  "[color-scheme:dark]",
].join(" ");

export const TEXTAREA_EDITABLE_BASE = [
  TEXTAREA_ANATOMY,
  `border-[${(appColors as any).editableBorder}]`,
  `bg-[${(appColors as any).editableBg}]`,
  `text-[${(appColors as any).editableText}]`,
  `placeholder:text-[${(appColors as any).editablePlaceholder}]`,
  `focus:border-[${(appColors as any).editableBorderFocus}]`,
  `focus:ring-[${(appColors as any).editableRing ?? appColors.focusRing}]`,
  "[color-scheme:light]",
].join(" ");

/* =========================================================================
   Layout / grids
   ========================================================================= */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const SECTION_STYLE = SURFACE_INSET_STYLE;

export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";
export const FORM_GRID_THREE = "grid gap-3 sm:grid-cols-3 items-start";


/* NOTE: menu background/border are variant-specific; handled in component via inline style or extra class if chceš */
export const SELECT_MENU_READONLY = [
  `bg-[${(appColors as any).readonlyBg ?? appColors.surfaceSolid}]`,
  `border-[${(appColors as any).readonlyBorder ?? appColors.inputBorder}]`,
  `text-[${(appColors as any).readonlyText ?? appColors.textPrimary}]`,
].join(" ");

export const SELECT_MENU_EDITABLE = [
  `bg-[${(appColors as any).editableBg}]`,
  `border-[${(appColors as any).editableBorder}]`,
  `text-[${(appColors as any).editableText}]`,
].join(" ");

/* =========================================================================
   Checkbox (2 variants)
   - no padding, only the checkbox + label layout
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
].join(" ");

export const CHECKBOX_BOX_READONLY = [
  CHECKBOX_ANATOMY,
  `border-[${(appColors as any).readonlyBorder ?? appColors.inputBorder}]`,
  `bg-[${(appColors as any).readonlyBg ?? appColors.inputBg}]`,
  `focus:ring-[${(appColors as any).readonlyRing ?? appColors.focusRing}]`,
  `enabled:hover:bg-[${(appColors as any).readonlyBgHover ?? appColors.inputBgHover}]`,
  `checked:border-[${(appColors as any).readonlyBorderFocus ?? appColors.inputBorderFocus}]`,
  `checked:after:border-[${(appColors as any).readonlyText ?? appColors.inputText}]`,
  "[color-scheme:dark]",
].join(" ");

export const CHECKBOX_BOX_EDITABLE = [
  CHECKBOX_ANATOMY,
  `border-[${(appColors as any).editableBorder}]`,
  `bg-[${(appColors as any).editableBg}]`,
  `focus:ring-[${(appColors as any).editableRing ?? appColors.focusRing}]`,
  `enabled:hover:bg-[${(appColors as any).editableBgHover}]`,
  `checked:border-[${(appColors as any).editableBorderFocus}]`,
  `checked:after:border-[${(appColors as any).editableText}]`,
  "[color-scheme:light]",
].join(" ");

export const CHECKBOX_LABEL = "min-w-0 text-sm";
export const CHECKBOX_HINT = ["block text-[11px] mt-0.5", `text-[${appColors.textMuted}]`].join(" ");

/* =========================================================================
   Legacy aliases (keep old imports working)
   - FIELD_BASE stays = readonly to avoid breaking dashboards
   ========================================================================= */
export const FIELD_BASE = FIELD_READONLY_BASE;
export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";
export const inputClass = FIELD_BASE;
export const labelClass = FIELD_LABEL;
export const hintClass = FIELD_HINT;

export const BUTTON_BLOCK =
  "inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition select-none";

export const BUTTON_DISABLED =
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

export const DATE_FIELD_LABEL =
  "block text-xs font-medium opacity-80";

export const DATE_INPUT_INNER =
  "w-full rounded px-3 py-2 text-sm bg-transparent outline-none";

export const DISCLOSURE_ICON_BASE =
  "inline-flex items-center justify-center transition-transform";

export const DISCLOSURE_ICON_OPEN =
  "rotate-180";

export const DISCLOSURE_ICON_CLOSED =
  "rotate-0";

export const FIELD_HELP =
  "mt-1 text-xs opacity-70";

  export const INPUTS_CARD_DATE_ROW = "mt-3";
export const INPUTS_CARD_DATE_INNER = "flex items-center justify-between gap-2";

export const INPUTS_CARD_DATE_PILL =
  "text-center px-3 py-2 !rounded-xl w-[min(220px,60vw)] [color-scheme:dark]";

export const INPUTS_CARD_BODY = "mt-4";

export const INPUTS_CARD_FOOTER = "mt-4 flex flex-col items-center gap-2";
export const INPUTS_CARD_SAVE_WRAP = "w-full";
export const INPUTS_CARD_SAVE_BTN = "w-full";

// labels (opakované "text-sm mb-x")
export const INPUTS_CARD_LABEL_SM_1 = "text-sm mb-1";
export const INPUTS_CARD_LABEL_SM_2 = "text-sm mb-2";

// checkbox rows (opakované "flex items-center ...")
export const INPUTS_CARD_CHECK_ROW = "flex items-center gap-2 text-sm";
export const INPUTS_CARD_CHECK_ROW_MB = "flex items-center gap-2 mb-2 text-sm";

// DisclosureToggle je circle, takže sem nedávaj padding typu px-6
export const INPUTS_CARD_TOGGLE = "";

export const DATE_TEXT_INPUT = ""; 
// prázdne – spoliehame sa na FIELD_BASE z TextField (t.j. rovnaké farby/height)

export const SELECT_BTN =
  "w-full flex items-center justify-between gap-2 text-left";

export const SELECT_ICON = "shrink-0 h-3.5 w-3.5 opacity-60";

export const SELECT_MENU_WRAP = "relative";

export const SELECT_MENU =
  "rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur p-1 shadow-lg";

export const SELECT_OPT =
  "w-full px-3 py-2 rounded-lg text-sm hover:bg-white/8 active:bg-white/10";

export const SELECT_OPT_ACTIVE = "bg-white/10";

export const SELECT_OPT_EMPTY = "text-white/60";