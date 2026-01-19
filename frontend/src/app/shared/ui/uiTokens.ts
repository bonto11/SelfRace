// src/shared/ui/uiTokens.ts
/* Central UI tokens (classes + presets) that are app-wide consistent.
   IMPORTANT: No raw hex/rgba in here. Use CSS vars (set from appColors).
*/

export const v = {
  bgMain: "var(--app-bg-main)",
  bgAlt: "var(--app-bg-alt)",

  surfaceCard: "var(--app-surface-card)",
  surfaceCardHover: "var(--app-surface-card-hover)",
  surfaceCardBorder: "var(--app-surface-card-border)",
  surfaceSolid: "var(--app-surface-solid)",
  surfaceSolidHover: "var(--app-surface-solid-hover)",

  divider: "var(--app-divider)",

  textPrimary: "var(--app-text-primary)",
  textSecondary: "var(--app-text-secondary)",
  textMuted: "var(--app-text-muted)",
  textInverse: "var(--app-text-inverse)",

  brandPrimary: "var(--app-brand-primary)",
  brandSecondary: "var(--app-brand-secondary)",

  focusRing: "var(--app-focus-ring)",

  success: "var(--app-success)",
  warning: "var(--app-warning)",
  error: "var(--app-error)",
  info: "var(--app-info)",

  btnPrimaryBg: "var(--app-btn-primary-bg)",
  btnPrimaryHover: "var(--app-btn-primary-hover)",
  btnPrimaryText: "var(--app-btn-primary-text)",

  btnSecondaryBg: "var(--app-btn-secondary-bg)",
  btnSecondaryHover: "var(--app-btn-secondary-hover)",
  btnSecondaryBorder: "var(--app-btn-secondary-border)",
  btnSecondaryText: "var(--app-btn-secondary-text)",

  btnGhostBg: "var(--app-btn-ghost-bg)",
  btnGhostHover: "var(--app-btn-ghost-hover)",
  btnGhostText: "var(--app-btn-ghost-text)",

  btnDangerBg: "var(--app-btn-danger-bg)",
  btnDangerHover: "var(--app-btn-danger-hover)",
  btnDangerText: "var(--app-btn-danger-text)",

  pillBg: "var(--app-pill-bg)",
  pillHover: "var(--app-pill-hover)",
  pillBorder: "var(--app-pill-border)",
  pillText: "var(--app-pill-text)",
  pillActiveBg: "var(--app-pill-active-bg)",
  pillActiveBorder: "var(--app-pill-active-border)",
  pillActiveText: "var(--app-pill-active-text)",

  inputBg: "var(--app-input-bg)",
  inputHover: "var(--app-input-hover)",
  inputBorder: "var(--app-input-border)",
  inputBorderFocus: "var(--app-input-border-focus)",
  inputText: "var(--app-input-text)",
  inputPlaceholder: "var(--app-input-placeholder)",

  panelBg: "var(--app-panel-bg)",
  panelBorder: "var(--app-panel-border)",
  panelText: "var(--app-panel-text)",
} as const;

/* ===== SURFACES ======================================================= */
export const SURFACE_CARD = [
  "rounded-2xl shadow-lg backdrop-blur text-left",
  `bg-[${v.surfaceCard}] border border-[${v.surfaceCardBorder}]`,
].join(" ");

export const SURFACE_SUBCARD = [
  "rounded-2xl backdrop-blur text-left",
  `bg-[${v.surfaceCard}] border border-[${v.surfaceCardBorder}]`,
].join(" ");

export const SURFACE_INSET = [
  "rounded-2xl backdrop-blur text-left",
  `bg-[${v.surfaceSolid}] border border-[${v.surfaceCardBorder}]`,
].join(" ");

export const SURFACE_INLINE = [
  "rounded-2xl backdrop-blur text-left",
  `bg-[${v.surfaceCard}] border border-[${v.surfaceCardBorder}]`,
].join(" ");

export const PAD = {
  card: "p-3",
  head: "px-3 pb-1.5",
  foot: "px-3 pb-3 pt-1.5",
  note: "mt-1.5",
};

/* ===== KOMPAT ALIASY =================================================== */
export const CARD = SURFACE_CARD;
export const SUBCARD = SURFACE_SUBCARD;
export const PANEL = SURFACE_INSET;

/* ===== KALENDÁR ======================================================== */
export const CALENDAR_DAY_CELL = [
  "rounded-xl",
  `border border-[${v.surfaceCardBorder}] bg-[${v.surfaceCard}]`,
].join(" ");
export const CALENDAR_HEADER_BAR = SURFACE_CARD + " p-3";
export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";

/* ===== DETAIL ========================================================== */
export const FLUSH_DETAIL =
  `mt-2 -mx-5 px-5 pb-4 pt-2 border-t border-[${v.surfaceCardBorder}] md:-mx-5`;

export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
export const NO_X = NO_X_OVERFLOW;
export const FLEX_SHRINK_FIX = "min-w-0";

export const FLUSH_DETAIL_PB = [
  "mt-2 overflow-hidden rounded-xl",
  `border border-[${v.surfaceCardBorder}] bg-[${v.surfaceCard}]`,
  "px-3 md:px-4 pb-3",
].join(" ");

/* ===== FORM ELEMENTS =================================================== */
export const FIELD_BASE = [
  "w-full rounded-md px-2.5 py-2 text-sm outline-none transition-colors",
  `bg-[${v.inputBg}] border border-[${v.inputBorder}] text-[${v.inputText}]`,
  `placeholder:text-[${v.inputPlaceholder}]`,
  `focus:ring-2 focus:ring-[${v.focusRing}] focus:border-[${v.inputBorderFocus}]`,
].join(" ");

export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";
export const FIELD_HELP = "text-[11px] opacity-70 mt-1";
export const MUTED_TEXT = `text-xs text-[${v.textMuted}]`;

/* ===== LAYOUT / SHELL ================================================== */
export const SHELL_BG = `min-h-dvh bg-[${v.bgMain}] text-[${v.textPrimary}]`;

export const TOPBAR_MOBILE = [
  "lg:hidden sticky top-0 z-40 flex items-center gap-3",
  `bg-[${v.bgMain}] backdrop-blur px-3 py-2 border-b border-[${v.divider}]`,
].join(" ");

export const TOPBAR_DESKTOP = [
  "hidden lg:flex h-14 items-center justify-between px-4",
  `border-b border-[${v.divider}] bg-[${v.bgMain}]`,
].join(" ");

export const ICON_BUTTON = [
  "rounded-lg p-2 border transition-colors",
  `border-[${v.divider}] hover:bg-[${v.surfaceCardHover}]`,
].join(" ");

export const SIDEBAR_DESKTOP =
  `hidden lg:block border-r border-[${v.divider}] sticky top-0 h-dvh`;

export const SIDEBAR_MOBILE_PANEL = [
  "lg:hidden fixed inset-y-0 left-0 z-50 w-[280px]",
  `bg-[${v.bgAlt}] border-r border-[${v.divider}] shadow-xl`,
  "transition-transform duration-200",
].join(" ");

export const SIDEBAR_OVERLAY = "lg:hidden fixed inset-0 z-40 bg-black/50";
export const SHELL_GRID = "grid lg:grid-cols-[280px_1fr]";
export const CONTENT_CONTAINER = "container mx-auto px-3 sm:px-4 lg:px-6 py-4";
export const BRAND_TEXT = "font-semibold";

export const AVATAR_BUTTON = [
  "w-9 h-9 rounded-full font-semibold grid place-items-center",
  `bg-[${v.brandPrimary}] text-[${v.textInverse}]`,
].join(" ");

export const DROPDOWN_PANEL = SURFACE_INSET + " absolute right-0 mt-2 w-56 p-2 z-30";
export const DROPDOWN_DIVIDER = `my-1 border-t border-[${v.divider}]`;
export const DROPDOWN_ITEM =
  `w-full text-left px-2 py-1 rounded hover:bg-[${v.surfaceCardHover}]`;
export const DROPDOWN_ITEM_DANGER =
  `w-full text-left px-2 py-1 rounded text-[${v.error}] hover:bg-[${v.surfaceCardHover}]`;

/* ===== WidgetCard ====================================================== */
export const WIDGET_CARD = SURFACE_CARD + " " + PAD.card + " text-left";
export const WIDGET_CARD_INTERACTIVE =
  `transition-colors hover:bg-[${v.surfaceCardHover}] cursor-pointer focus:outline-none`;
export const WIDGET_INNER = "flex flex-col text-left";
export const WIDGET_TITLE = "text-sm md:text-base font-semibold tracking-tight";
export const WIDGET_HINT = `text-xs text-[${v.textMuted}] whitespace-nowrap`;
export const WIDGET_NOTE = `text-sm mt-2 text-[${v.textSecondary}]`;
export const WIDGET_FOOTER = "mt-3";
export const WIDGET_ACCENT_BAR = "h-1.5 rounded-b-xl mt-3";

/* ===== Sekcie ========================================================== */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";

/* ===== Pills / textarea =============================================== */
export const PILL_BUTTON = [
  "shrink-0 px-4 py-2 rounded-xl border transition-colors text-sm font-medium",
  `border-[${v.pillBorder}] bg-[${v.pillBg}] hover:bg-[${v.pillHover}]`,
  `text-[${v.textPrimary}]`,
].join(" ");

export const TEXTAREA_BASE = [
  "w-full rounded-md border px-3 py-2 resize-y",
  `bg-[${v.inputBg}] border-[${v.inputBorder}] text-[${v.inputText}]`,
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-[${v.focusRing}]`,
].join(" ");

/* ===== TOAST =========================================================== */
export const TOAST_LAYER =
  "pointer-events-none fixed inset-0 z-[60] flex justify-center pt-[12vh]";
export const TOAST_STACK = "w-full flex flex-col items-center gap-2";
export const TOAST_PILL_BASE = [
  "pointer-events-auto select-none",
  "w-[calc(100vw-24px)] sm:w-[520px]",
  "rounded-[22px] px-4 py-3 backdrop-blur-md shadow-lg border",
  "text-[15px] leading-snug font-medium",
].join(" ");

export const TOAST_SUCCESS =
  `bg-[${v.success}] text-[${v.textInverse}] border-[${v.success}]`;
export const TOAST_ERROR =
  `bg-[${v.error}] text-[${v.textPrimary}] border-[${v.error}]`;
export const TOAST_INFO =
  `bg-[${v.panelBg}] text-[${v.panelText}] border-[${v.panelBorder}]`;

/* ===== SPINNER ========================================================= */
export type SpinnerPreset = {
  px: number;
  accent: string; // CSS var refs
  track: string;
  dot?: string;
};

export const SPINNER_CFG: Record<"widget" | "trend" | "screen", SpinnerPreset> = {
  widget: { px: 18, accent: "var(--app-chart-3)", track: "var(--app-chart-grid)", dot: "var(--app-chart-axis)" },
  trend: { px: 32, accent: "var(--app-brand-primary)", track: "var(--app-chart-grid)", dot: "var(--app-text-secondary)" },
  screen: { px: 56, accent: "var(--app-accent-teal)", track: "var(--app-chart-grid)", dot: "var(--app-text-secondary)" },
};

/* ===== BUTTONS ========================================================= */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE = [
  "inline-flex items-center justify-center gap-2 select-none",
  "rounded-full border transition-colors font-semibold",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-[${v.focusRing}]`,
].join(" ");

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: `bg-[${v.btnPrimaryBg}] hover:bg-[${v.btnPrimaryHover}] text-[${v.btnPrimaryText}] border-[${v.surfaceCardBorder}]`,
  secondary: `bg-[${v.btnSecondaryBg}] hover:bg-[${v.btnSecondaryHover}] text-[${v.btnSecondaryText}] border-[${v.btnSecondaryBorder}]`,
  ghost: `bg-[${v.btnGhostBg}] hover:bg-[${v.btnGhostHover}] text-[${v.btnGhostText}] border-[${v.surfaceCardBorder}]`,
  danger: `bg-[${v.btnDangerBg}] hover:bg-[${v.btnDangerHover}] text-[${v.btnDangerText}] border-[${v.surfaceCardBorder}]`,
  success: `bg-[${v.success}] hover:brightness-110 text-[${v.textInverse}] border-[${v.surfaceCardBorder}]`,
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
    const dims =
      size === "sm" ? "w-8 h-8" : size === "md" ? "w-9 h-9" : "w-10 h-10";
    base.push(dims, "p-0");
  }
  return base.join(" ");
}

/* ===== FORM INPUTS (legacy helpers) =================================== */
export const labelClass = "text-xs font-medium tracking-wide opacity-80 select-none";
export const hintClass = `text-xs text-[${v.textMuted}]`;

export const inputClass = [
  "w-full rounded-lg px-3 py-2 border",
  `bg-[${v.inputBg}] text-[${v.inputText}] border-[${v.inputBorder}]`,
  `placeholder:text-[${v.inputPlaceholder}]`,
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-[${v.focusRing}]`,
].join(" ");

/* ===== CHART TOKENS (keep as-is or refactor later) ===================== */
export const CHART_HR = {
  maxBpm: 207,
  zoneCuts: [154, 173, 183, 193] as [number, number, number, number],
  colors: {
    z1: "var(--app-chart-3)",
    z2: "var(--app-chart-1)",
    z3: "var(--app-warning)",
    z4: "var(--app-accent-lime)",
    z5: "var(--app-error)",
  },
  grid: "var(--app-chart-grid)",
  tickText: "var(--app-text-secondary)",
  axisText: "var(--app-text-muted)",
  bandOpacity: 0.08,
  lineWidth: { normal: 2, compact: 1.6 },
  emptyTextClass: "opacity-70 text-sm",
};

export const CHART_SPARK = {
  width: 300,
  lineWidth: 2,
  gradientTop: "var(--app-chart-1)",
  gradientBottom: "var(--app-error)",
  baseline: "var(--app-chart-grid)",
  infoTextClass: "text-xs opacity-75 whitespace-nowrap",
  emptyTextClass: "text-xs opacity-70",
};

export const CHART_TREND = {
  lineColor: "var(--app-accent-teal)",
  bandAlphaHex: "33",
  containerClass: "mt-4",
};

/* ===== Utils =========================================================== */
export const SCROLL_X = [
  "w-full max-w-full overflow-x-auto overflow-y-hidden min-w-0",
  "touch-pan-x",
  "[scrollbar-gutter:stable]",
].join(" ");

export const CHART_TIGHT = "rounded-md bg-transparent";

export const NAV_ITEM = `block px-3 py-2 rounded-lg hover:bg-[${v.surfaceCardHover}]`;
export const NAV_ITEM_ACTIVE = `bg-[${v.surfaceCardHover}] text-[${v.textPrimary}]`;
export const HAMBURGER_BTN = ICON_BUTTON + " w-10 h-10 -ml-2";

export const PREFS_PILL = [
  "rounded-full px-3 py-1.5 text-sm font-medium border transition-colors",
  `focus:outline-none focus:ring-2 focus:ring-[${v.focusRing}]`,
].join(" ");

export const COLOR_PREFS_ACTIVE =
  `bg-[${v.pillActiveBg}] text-[${v.pillActiveText}] border-[${v.pillActiveBorder}] hover:brightness-110`;

export const COLOR_PREFS_INACTIVE =
  `bg-[${v.pillBg}] text-[${v.textPrimary}] border-[${v.pillBorder}] hover:bg-[${v.pillHover}]`;