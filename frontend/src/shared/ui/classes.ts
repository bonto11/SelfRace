/* ===== SURFACES (globálne konzistentné) =============================== */
/** Hlavný panel/karta – najvýraznejší povrch (použi pre hlavné widgety) */
export const SURFACE_CARD =
  "rounded-2xl shadow-lg border border-white/10 bg-white/90 dark:bg-gray-900/70 backdrop-blur text-left";

/** Sekundárny panel vnútri karty (napr. detaily) */
export const SURFACE_SUBCARD =
  "rounded-2xl border border-white/10 bg-white/80 dark:bg-gray-900/60 backdrop-blur text-left";

/** Tretí stupeň (jemnejší blok – drobné vnorené oblasti) */
export const SURFACE_INSET =
  "rounded-2xl border border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur text-left";

/** Štvrtý stupeň (najjemnejší podklad, napr. inline boxy) */
export const SURFACE_INLINE =
  "rounded-2xl border border-white/10 bg-white/60 dark:bg-gray-700/50 backdrop-blur text-left";

/* ===== KOMPAT ALIASY =================================================== */
export const CARD = SURFACE_CARD;
export const SUBCARD = SURFACE_SUBCARD;
export const PANEL = SURFACE_INSET;

/* ===== KALENDÁR ŠPECIFICKÉ ============================================ */
export const CALENDAR_DAY_CELL =
  "rounded-xl border border-white/10 bg-white/5 dark:bg-black/20";
export const CALENDAR_HEADER_BAR = SURFACE_CARD + " p-3";
export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";

/* ===== DETAIL – FLUSH VARIANTY ======================================== */
/** Detail v ActivityTable/PlanCards – zarovnanie na hrany rodičovskej karty */
export const FLUSH_DETAIL =
  "mt-2 -mx-5 px-5 pb-4 pt-2 border-t border-white/10 md:-mx-5"; // páruje sa s px-5 rodiča

/* ====== GLOBAL SAFETY (limit horizontálneho tečenia) =================== */
export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
/** Kompat alias (nech nie je dvojaká definícia) */
export const NO_X = NO_X_OVERFLOW;
export const FLEX_SHRINK_FIX = "min-w-0"; // použi na flex-containery s textom

/* ===== FLUSH detail – PB (bez negatívnych marginov) ==================== */
export const FLUSH_DETAIL_PB = [
  "mt-2",
  "overflow-hidden rounded-xl border border-white/10",
  "bg-white/5 dark:bg-black/20",
  "px-3 md:px-4 pb-3",
].join(" ");

/* ===== FORM ELEMENTS =================================================== */
export const FIELD_BASE =
  "w-full rounded-md border border-white/10 bg-white/90 dark:bg-gray-900/70 " +
  "px-2.5 py-2 text-sm outline-none " +
  "focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 " +
  "transition-colors";
export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";
export const FIELD_HELP = "text-[11px] opacity-70 mt-1";
export const MUTED_TEXT = "text-xs opacity-70";

/* ===== LAYOUT / SHELL ================================================== */
/** Globálne pozadie a farba textu appky */
export const SHELL_BG = "min-h-dvh bg-neutral-950 text-neutral-100";

/** Horný panel na mobile (sticky, s blur + bordrom) */
export const TOPBAR_MOBILE =
  "lg:hidden sticky top-0 z-40 flex items-center gap-3 " +
  "bg-neutral-950/90 backdrop-blur px-3 py-2 border-b border-neutral-800";

/** Horný panel na desktope (plochý, konzistentný border) */
export const TOPBAR_DESKTOP =
  "hidden lg:flex h-14 items-center justify-between px-4 " +
  "border-b border-neutral-800 bg-neutral-950";

/** Ikonové tlačidlo (napr. hamburger) */
export const ICON_BUTTON =
  "rounded-lg p-2 border border-neutral-700 hover:bg-neutral-800";

/** Desktop sidebar (sticky full-height s pravým borderom) */
export const SIDEBAR_DESKTOP =
  "hidden lg:block border-r border-neutral-800 sticky top-0 h-dvh";

/** Mobilný off-canvas wrapper sidebaru */
export const SIDEBAR_MOBILE_PANEL =
  "lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] " +
  "bg-neutral-900 border-r border-neutral-800 shadow-xl " +
  "transition-transform duration-200";

/** Tmavý overlay za off-canvas sidebarom (iba mobile) */
export const SIDEBAR_OVERLAY = "lg:hidden fixed inset-0 z-40 bg-black/50";

/** Grid rozloženie shellu (sidebar + content) */
export const SHELL_GRID = "grid lg:grid-cols-[280px_1fr]";

/** Vnútorný kontajner obsahu so štandardnými paddingami */
export const CONTENT_CONTAINER = "container mx-auto px-3 sm:px-4 lg:px-6 py-4";

/** Typografia značky v topbare */
export const BRAND_TEXT = "font-semibold";

export const AVATAR_BUTTON =
  "w-9 h-9 rounded-full bg-emerald-600 text-white font-semibold grid place-items-center";

export const DROPDOWN_PANEL = SURFACE_INSET + " absolute right-0 mt-2 w-56 p-2 z-30";
export const DROPDOWN_DIVIDER = "my-1 border-t border-white/10";
export const DROPDOWN_ITEM = "w-full text-left px-2 py-1 rounded hover:bg-white/10";
export const DROPDOWN_ITEM_DANGER = DROPDOWN_ITEM + " text-rose-300 hover:bg-rose-500/10";

/* ===== WidgetCard – konzistentné povrchy a typografia ================== */
export const WIDGET_CARD = SURFACE_CARD + " p-4 text-left";
export const WIDGET_CARD_INTERACTIVE =
  "transition-colors hover:bg-white dark:hover:bg-gray-900/80 cursor-pointer focus:outline-none";
export const WIDGET_INNER = "flex flex-col text-left";
export const WIDGET_TITLE = "text-sm md:text-base font-semibold tracking-tight";
export const WIDGET_HINT = "text-xs opacity-75 whitespace-nowrap";
export const WIDGET_NOTE = "opacity-80 text-sm mt-2";
export const WIDGET_FOOTER = "mt-3";
export const WIDGET_ACCENT_BAR = "h-1.5 rounded-b-xl mt-3";

/* ===== WIDGET HEADER aliasy (centrálne) =================================*/
export const WIDGET_HEADER_ROW = "flex items-center";
export const WIDGET_HEADER_SIDE = "flex-1";
export const WIDGET_HEADER_CENTER = "inline-flex items-center justify-center gap-3 select-none";
export const WIDGET_HEADER_BELOW = "mb-3"; // margin pod headerom, ak treba

/* ===== Sekcie a form gridy ============================================ */
export const SECTION = SURFACE_INSET + " p-3";
export const SECTION_WIDE = SURFACE_INSET + " p-3 md:p-4";
export const FORM_GRID_TWO = "grid grid-cols-1 md:grid-cols-2 gap-3";
export const FORM_GRID_SPLIT = "grid grid-cols-1 sm:grid-cols-2 gap-2";

/* ===== Mikro komponenty (pill/textarea) =============================== */
export const PILL_BUTTON =
  "shrink-0 px-4 py-2 rounded-xl border border-white/15 " +
  "bg-white/5 dark:bg-gray-900/40 hover:bg-white/10 transition-colors " +
  "text-sm font-medium";

export const TEXTAREA_BASE =
  "w-full rounded-md bg-white/70 dark:bg-gray-800/60 border border-white/10 " +
  "px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 " +
  "resize-y";

/* ===== TOAST (globálne toast notifikácie) =============================== */
export const TOAST_LAYER =
  "pointer-events-none fixed inset-0 z-[60] flex justify-center pt-[12vh]";
export const TOAST_STACK = "w-full flex flex-col items-center gap-2";
export const TOAST_PILL_BASE =
  [
    "pointer-events-auto select-none",
    "w-[calc(100vw-24px)] sm:w-[520px]",
    "rounded-[22px] px-4 py-3",
    "backdrop-blur-md shadow-lg border",
    "text-[15px] leading-snug font-medium",
  ].join(" ");
export const TOAST_SUCCESS = "bg-emerald-600/95 text-white border-emerald-500/50";
export const TOAST_ERROR   = "bg-red-600/95 text-white border-red-500/50";
export const TOAST_INFO    = "bg-neutral-800/95 text-white border-neutral-700/60";

/* Pozn.: animácie ostávajú cez CSS triedy .toast-enter / .toast-hold / .toast-exit */

/* ===== SPINNER (centrálne farby/veľkosti) =============================== */
export type SpinnerPreset = { px: number; accent: string; track: string; dot?: string };
export const SPINNER_CFG: Record<"widget" | "trend" | "screen", SpinnerPreset> = {
  widget: { px: 18, accent: "#3B82F6", track: "#3B82F633", dot: "#93C5FD" }, // modrá
  trend:  { px: 32, accent: "#10B981", track: "#10B98133", dot: "#A7F3D0" }, // zelená
  screen: { px: 56, accent: "#8B5CF6", track: "#8B5CF633", dot: "#DDD6FE" }, // fialová
};

/* ===== BUTTONS (centrálny systém) ======================================= */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  [
    "inline-flex items-center justify-center gap-2 select-none",
    "rounded-full border transition-colors",
    "font-semibold",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
  ].join(" ");

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:  "bg-blue-600 hover:bg-blue-500 text-white border-white/10",
  secondary:"bg-neutral-800 hover:bg-neutral-700 text-white border-white/10",
  ghost:    "bg-transparent hover:bg-white/10 text-white border-white/10",
  danger:   "bg-rose-600 hover:bg-rose-500 text-white border-white/10",
  success:  "bg-emerald-600 hover:bg-emerald-500 text-white border-white/10",
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
      size === "sm" ? "w-8 h-8" :
      size === "md" ? "w-9 h-9" :
      /* lg */        "w-10 h-10";
    base.push(dims, "p-0");
  }
  return base.join(" ");
}

/* ===== FORM INPUTS (pre TextField a ko.) ================================ */
export const labelClass =
  "text-xs font-medium tracking-wide opacity-80 select-none";

export const hintClass =
  "text-xs opacity-70";

export const inputClass =
  [
    "w-full rounded-lg",
    "bg-neutral-900 text-white",
    "border border-neutral-700",
    "px-3 py-2",
    "placeholder:opacity-60",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
  ].join(" ");

/* ===== CHART TOKENS ===================================================== */
export const CHART_HR = {
  maxBpm: 207,
  zoneCuts: [154, 173, 183, 193] as [number, number, number, number],
  colors: {
    z1: "#60A5FA",
    z2: "#34D399",
    z3: "#FBBF24",
    z4: "#F97316",
    z5: "#EF4444",
  },
  grid: "rgba(255,255,255,.18)",
  tickText: "#cbd5e1",
  axisText: "#94a3b8",
  bandOpacity: 0.08,
  lineWidth: { normal: 2, compact: 1.6 },
  emptyTextClass: "opacity-70 text-sm",
};

/* ===== CHART – MINI SPARK (HR) ========================================= */
export const CHART_SPARK = {
  width: 300,
  lineWidth: 2,
  gradientTop: "#22C55E",
  gradientBottom: "#EF4444",
  baseline: "rgba(255,255,255,0.10)",
  infoTextClass: "text-xs opacity-75 whitespace-nowrap",
  emptyTextClass: "text-xs opacity-70",
};

/* ===== CHART – TREND S PÁSMAMI (Chart.js) ============================== */
export const CHART_TREND = {
  lineColor: "cyan",
  bandAlphaHex: "33",
  containerClass: "mt-4",
};

// src/shared/ui/classes.ts  (doplnky na koniec súboru)

export const SCROLL_X = [
  "overflow-x-auto",           // povolí horizontálny scroll
  "-mx-4 px-4",                // „nasaje“ sa pod vlastný padding karty
  "[scrollbar-gutter:stable]", // netancuje layout pri zobrazovaní scrollbaru
  "touch-pan-x",               // príjemnejší horizontálny pan na mobile
].join(" ");

export const CHART_TIGHT = [
  "rounded-md",                // jemné rohy kontajnera s grafom
  "bg-transparent",            // bez vlastného pozadia (graf je v hlavnej karte)
].join(" ");