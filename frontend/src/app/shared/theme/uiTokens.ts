// src/app/shared/ui/uiTokens.ts
import { appColors } from "@/app/shared/theme/app_colors";

/* ===== SURFACES (globálne konzistentné) =============================== */
export const SURFACE_CARD = [
  "rounded-2xl",
  "shadow-lg",
  `border border-[${appColors.widgetBorder}]`,      // <- z surfaceCardBorder na widgetBorder
  `bg-[${appColors.surfaceCard}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_SUBCARD = [
  "rounded-2xl",
  `border border-[${appColors.widgetBorder}]`,
  `bg-[${appColors.surfaceSolid}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_INSET = [
  "rounded-2xl",
  `border border-[${appColors.widgetBorder}]`,
  `bg-[${appColors.surfaceSolid}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const SURFACE_INLINE = [
  "rounded-2xl",
  `border border-[${appColors.widgetBorder}]`,
  `bg-[${appColors.backgroundAlt}]`,
  "backdrop-blur",
  "text-left",
].join(" ");

export const PAD = {
  card: "p-3",
  head: "px-3 pb-3 pb-1.5",
  foot: "px-3 pb-3 pt-1.5",
  note: "mt-1.5",
};

/* ===== KOMPAT ALIASY =================================================== */
export const CARD = SURFACE_CARD;
export const SUBCARD = SURFACE_SUBCARD;
export const PANEL = SURFACE_INSET;

/* ===== KALENDÁR ŠPECIFICKÉ ============================================ */
export const CALENDAR_DAY_CELL = [
  "rounded-xl",
  `border border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.backgroundAlt}]`,
].join(" ");

export const CALENDAR_HEADER_BAR = SURFACE_CARD + " p-3";
export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";

/* ===== DETAIL – FLUSH VARIANTY ======================================== */
export const FLUSH_DETAIL =
  `mt-2 -mx-5 px-5 pb-4 pt-2 border-t border-[${appColors.divider}] md:-mx-5`;

/* ====== GLOBAL SAFETY (limit horizontálneho tečenia) =================== */
export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
export const NO_X = NO_X_OVERFLOW;
export const FLEX_SHRINK_FIX = "min-w-0";

/* ===== FLUSH detail – PB ============================================== */
export const FLUSH_DETAIL_PB = [
  "mt-2",
  "overflow-hidden rounded-xl",
  `border border-[${appColors.surfaceCardBorder}]`,
  `bg-[${appColors.backgroundAlt}]`,
  "px-3 md:px-4 pb-3",
].join(" ");

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

/* ===== LAYOUT / SHELL ================================================== */
export const SHELL_BG = `min-h-dvh bg-[${appColors.backgroundMain}] text-[${appColors.textPrimary}]`;

export const TOPBAR_MOBILE = [
  "lg:hidden sticky top-0 z-40 flex items-center gap-3",
  `bg-[${appColors.backgroundMain}]`,
  "backdrop-blur px-3 py-2",
  `border-b border-[${appColors.divider}]`,
].join(" ");

export const TOPBAR_DESKTOP = [
  "hidden lg:flex h-14 items-center justify-between px-4",
  `border-b border-[${appColors.divider}]`,
  `bg-[${appColors.backgroundMain}]`,
].join(" ");

export const ICON_BUTTON = [
  "rounded-lg p-2",
  `border border-[${appColors.surfaceCardBorder}]`,
  `hover:bg-[${appColors.surfaceCardHover}]`,
].join(" ");

export const SIDEBAR_DESKTOP =
  `hidden lg:block border-r border-[${appColors.divider}] sticky top-0 h-dvh`;

export const SIDEBAR_MOBILE_PANEL = [
  "lg:hidden fixed inset-y-0 left-0 z-50 w-[280px]",
  `bg-[${appColors.backgroundAlt}]`,
  `border-r border-[${appColors.divider}]`,
  "shadow-xl transition-transform duration-200",
].join(" ");

export const SIDEBAR_OVERLAY =
  `lg:hidden fixed inset-0 z-40 bg-[${appColors.overlay}]`;

export const SHELL_GRID = "grid lg:grid-cols-[280px_1fr]";
export const CONTENT_CONTAINER = "container mx-auto px-3 sm:px-4 lg:px-6 py-4";
export const BRAND_TEXT = "font-semibold";

export const AVATAR_BUTTON = [
  "w-9 h-9 rounded-full font-semibold grid place-items-center",
  `bg-[${appColors.brandPrimary}]`,
  `text-[${appColors.textInverse}]`,
].join(" ");

export const DROPDOWN_PANEL = SURFACE_INSET + " absolute right-0 mt-2 w-56 p-2 z-30";
export const DROPDOWN_DIVIDER = `my-1 border-t border-[${appColors.divider}]`;

export const DROPDOWN_ITEM =
  `w-full text-left px-2 py-1 rounded hover:bg-[${appColors.surfaceCardHover}]`;

export const DROPDOWN_ITEM_DANGER =
  `w-full text-left px-2 py-1 rounded text-[${appColors.statusError}] hover:bg-[${appColors.buttonGhostBgHover}]`;

/* ===== WidgetCard ====================================================== */
export const WIDGET_CARD = SURFACE_CARD + " " + PAD.card + " text-left";
export const WIDGET_CARD_INTERACTIVE =
  `transition-colors hover:bg-[${appColors.surfaceCardHover}] cursor-pointer focus:outline-none`;

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

/* ===== Sekcie a form gridy ============================================ */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";

/* ===== Mikro komponenty =============================================== */
export const PILL_BUTTON = [
  "shrink-0 px-4 py-2 rounded-xl border transition-colors text-sm font-medium",
  `border-[${appColors.pillBorder}]`,
  `bg-[${appColors.pillBg}]`,
  `hover:bg-[${appColors.pillBgHover}]`,
  `text-[${appColors.pillText}]`,
].join(" ");

export const TEXTAREA_BASE = [
  "w-full rounded-md border px-3 py-2 resize-y",
  `bg-[${appColors.inputBg}]`,
  `border-[${appColors.inputBorder}]`,
  `text-[${appColors.inputText}]`,
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-[${appColors.focusRing}]`,
].join(" ");

/* ===== TOAST =========================================================== */
export const TOAST_LAYER =
  "pointer-events-none fixed inset-0 z-[60] flex justify-center pt-[12vh]";
export const TOAST_STACK = "w-full flex flex-col items-center gap-2";

export const TOAST_PILL_BASE = [
  "pointer-events-auto select-none",
  "w-[calc(100vw-24px)] sm:w-[520px]",
  "rounded-[22px] px-4 py-3",
  "backdrop-blur-md shadow-lg border",
  "text-[15px] leading-snug font-medium",
].join(" ");

export const TOAST_SUCCESS =
  `bg-[${appColors.statusSuccess}] text-[${appColors.textInverse}] border-[${appColors.statusSuccess}]`;
export const TOAST_ERROR =
  `bg-[${appColors.statusError}] text-[${appColors.textInverse}] border-[${appColors.statusError}]`;
export const TOAST_INFO =
  `bg-[${appColors.panelBg}] text-[${appColors.panelText}] border-[${appColors.panelBorder}]`;

/* ===== SPINNER ========================================================= */
export type SpinnerPreset = {
  px: number;
  accent: string;
  track: string;
  dot?: string;
};

export const SPINNER_CFG: Record<"widget" | "trend" | "screen", SpinnerPreset> = {
  widget: {
    px: 18,
    accent: appColors.chartLine1,
    track: appColors.sliderTrack,
    dot: appColors.chartLine2,
  },
  trend: {
    px: 32,
    accent: appColors.brandPrimary,
    track: appColors.sliderTrack,
    dot: appColors.brandMuted,
  },
  screen: {
    px: 56,
    accent: appColors.accentTeal,
    track: appColors.sliderTrack,
    dot: appColors.accentLime,
  },
};

/* ===== BUTTONS ========================================================= */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE = [
  "inline-flex items-center justify-center gap-2 select-none",
  "rounded-full border transition-colors",
  "font-semibold",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-[${appColors.focusRing}]`,
].join(" ");

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: [
    `bg-[${appColors.buttonPrimaryBg}]`,
    `hover:bg-[${appColors.buttonPrimaryBgHover}]`,
    `text-[${appColors.buttonPrimaryText}]`,
    `border-[${appColors.surfaceCardBorder}]`,
  ].join(" "),
  secondary: [
    `bg-[${appColors.buttonSecondaryBg}]`,
    `hover:bg-[${appColors.buttonSecondaryBgHover}]`,
    `text-[${appColors.buttonSecondaryText}]`,
    `border-[${appColors.buttonSecondaryBorder}]`,
  ].join(" "),
  ghost: [
    `bg-[${appColors.buttonGhostBg}]`,
    `hover:bg-[${appColors.buttonGhostBgHover}]`,
    `text-[${appColors.buttonGhostText}]`,
    `border-[${appColors.surfaceCardBorder}]`,
  ].join(" "),
  danger: [
    `bg-[${appColors.buttonDangerBg}]`,
    `hover:bg-[${appColors.buttonDangerBgHover}]`,
    `text-[${appColors.buttonDangerText}]`,
    `border-[${appColors.surfaceCardBorder}]`,
  ].join(" "),
  success: [
    `bg-[${appColors.statusSuccess}]`,
    `hover:bg-[${appColors.brandSecondary}]`,
    `text-[${appColors.textInverse}]`,
    `border-[${appColors.surfaceCardBorder}]`,
  ].join(" "),
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-3.5 py-2",
  lg: "text-base px-4 py-2.5",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  opts?: { circle?: boolean }
) {
  const base = [BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size]];
  if (opts?.circle) {
    const dims = size === "sm" ? "w-8 h-8" : size === "md" ? "w-9 h-9" : "w-10 h-10";
    base.push(dims, "p-0");
  }
  return base.join(" ");
}

/* ===== FORM INPUTS ===================================================== */
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

/* ===== CHART TOKENS ==================================================== */
export const CHART_HR = {
  maxBpm: 207,
  zoneCuts: [154, 173, 183, 193] as [number, number, number, number],
  colors: {
    z1: appColors.chartLine1,
    z2: appColors.chartLine2,
    z3: appColors.chartLine3,
    z4: appColors.chartLine4,
    z5: appColors.statusError,
  },
  grid: appColors.chartGrid,
  tickText: appColors.textMuted,
  axisText: appColors.textSecondary,
  bandOpacity: 0.08,
  lineWidth: { normal: 2, compact: 1.6 },
  emptyTextClass: "opacity-70 text-sm",
};

export const CHART_SPARK = {
  width: 300,
  lineWidth: 2,
  gradientTop: appColors.chartLine2,
  gradientBottom: appColors.statusError,
  baseline: appColors.chartGrid,
  infoTextClass: "text-xs opacity-75 whitespace-nowrap",
  emptyTextClass: "text-xs opacity-70",
};

export const CHART_TREND = {
  lineColor: appColors.accentTeal,
  bandAlphaHex: "33",
  containerClass: "mt-4",
};

/* ===== MISC ============================================================ */
export const SCROLL_X = [
  "w-full",
  "max-w-full",
  "overflow-x-auto",
  "overflow-y-hidden",
  "min-w-0",
  "touch-pan-x",
  "[scrollbar-gutter:stable]",
].join(" ");

export const CHART_TIGHT = "rounded-md bg-transparent";

export const NAV_ITEM = `block px-3 py-2 rounded-lg hover:bg-[${appColors.buttonGhostBgHover}]`;
export const NAV_ITEM_ACTIVE = `bg-[${appColors.buttonGhostBgHover}] text-[${appColors.textPrimary}]`;

export const HAMBURGER_BTN = ICON_BUTTON + " w-10 h-10 -ml-2";

export const PREFS_PILL =
  `rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ` +
  `focus:outline-none focus:ring-2 focus:ring-[${appColors.focusRing}]`;

export const COLOR_PREFS_ACTIVE =
  `bg-[${appColors.pillActiveBg}] text-[${appColors.pillActiveText}] border-[${appColors.pillActiveBorder}] ` +
  `hover:brightness-110`;

export const COLOR_PREFS_INACTIVE =
  `bg-[${appColors.pillBg}] text-[${appColors.pillText}] border-[${appColors.pillBorder}] ` +
  `hover:bg-[${appColors.pillBgHover}]`;

export const WIDGET_LOADING_CENTER = "grid place-items-center py-6";

export const WIDGET_META_LABEL =
  "text-[11px] uppercase tracking-wide opacity-70";

export const WIDGET_VALUE_ROW = "mt-1 flex items-end gap-2";

export const WIDGET_VALUE_MAIN = "text-4xl font-extrabold tabular-nums";

export const WIDGET_VALUE_UNIT = "text-base align-top ml-1";

export const WIDGET_PLACEHOLDER = "text-xs opacity-60";

export const WIDGET_ERROR_TEXT = "text-sm text-[${appColors.statusError}]";
export const WIDGET_ERROR_SUB = "mt-1 text-xs opacity-70";

export const WIDGET_INFO_TEXT = "text-sm opacity-80";
export const WIDGET_EMPTY_TEXT = "text-sm opacity-80";

export const WIDGET_KV_GRID = "grid grid-cols-2 gap-x-3 gap-y-1 text-sm";
export const WIDGET_KV_LABEL = "opacity-75";
export const WIDGET_KV_VALUE = "font-semibold";

export const WIDGET_SUMMARY_TEXT = "mt-3 text-xs opacity-80";
