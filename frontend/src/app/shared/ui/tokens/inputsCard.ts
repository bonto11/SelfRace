// src/app/shared/ui/tokens/inputsCard.ts

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
  "absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur p-1 shadow-lg";

export const SELECT_OPT =
  "w-full px-3 py-2 rounded-lg text-sm hover:bg-white/8 active:bg-white/10";

export const SELECT_OPT_ACTIVE = "bg-white/10";

export const SELECT_OPT_EMPTY = "text-white/60";