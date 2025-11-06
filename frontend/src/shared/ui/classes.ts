/* ===== SURFACES (globálne konzistentné) =============================== */
/** Hlavný panel/karta – najvýraznejší povrch (použi pre hlavné widgety) */
export const SURFACE_CARD =
  "rounded-2xl shadow-lg border border-white/10 bg-white/90 dark:bg-gray-900/70 backdrop-blur";

/** Sekundárny panel vnútri karty (napr. detaily) */
export const SURFACE_SUBCARD =
  "rounded-2xl border border-white/10 bg-white/80 dark:bg-gray-900/60 backdrop-blur";

/** Tretí stupeň (jemnejší blok – drobné vnorené oblasti) */
export const SURFACE_INSET =
  "rounded-2xl border border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur";

/** Štvrtý stupeň (najjemnejší podklad, napr. inline boxy) */
export const SURFACE_INLINE =
  "rounded-2xl border border-white/10 bg-white/60 dark:bg-gray-700/50 backdrop-blur";

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
export const FLEX_SHRINK_FIX = "min-w-0"; // použi na flex-containery s textom

/* ===== FLUSH detail – PB (bez negatívnych marginov) ==================== */
export const FLUSH_DETAIL_PB = [
  "mt-2",
  "overflow-hidden rounded-xl border border-white/10",
  "bg-white/5 dark:bg-black/20",
  "px-3 md:px-4 pb-3",
].join(" ");

/** alias, ak by si ho už používal inde */
export const NO_X = "max-w-full overflow-x-hidden";

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

// WidgetCard – konzistentné povrchy a typografia
export const WIDGET_CARD = SURFACE_CARD + " p-4";
export const WIDGET_CARD_INTERACTIVE =
  "transition-colors hover:bg-white dark:hover:bg-gray-900/80 cursor-pointer focus:outline-none";
export const WIDGET_INNER = "flex flex-col";
export const WIDGET_TITLE = "text-sm md:text-base font-semibold tracking-tight";
export const WIDGET_HINT = "text-xs opacity-75 whitespace-nowrap";
export const WIDGET_NOTE = "opacity-80 text-sm mt-2";
export const WIDGET_FOOTER = "mt-3";
export const WIDGET_ACCENT_BAR = "h-1.5 rounded-b-xl mt-3";
