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
export const CALENDAR_CONTAINER  = SURFACE_CARD + " p-3";

/* ===== DETAIL – FLUSH VARIANTY ======================================== */
/** Detail v ActivityTable/PlanCards – zarovnanie na hrany rodičovskej karty */
export const FLUSH_DETAIL =
  "mt-2 -mx-5 px-5 pb-4 pt-2 border-t border-white/10 md:-mx-5"; // páruje sa s px-5 rodiča

/* ====== GLOBAL SAFETY (limit horizontálneho tečenia) ====== */
export const NO_X_OVERFLOW = "max-w-full overflow-x-hidden";
export const FLEX_SHRINK_FIX = "min-w-0"; // použi na flex-containery s textom

/* ===== FLUSH detail – PB (bez negatívnych marginov) ===== */
export const FLUSH_DETAIL_PB =
  [
    // vizuálne „zarovno s hranou“ bez -mx: spraví to vnútorný box s vlastným pozadím
    "mt-2",
    "overflow-hidden rounded-xl border border-white/10",
    "bg-white/5 dark:bg-black/20",
    "px-3 md:px-4 pb-3",
  ].join(" ");

export const NO_X = "max-w-full overflow-x-hidden";

/* ===== FORM ELEMENTS (nové) =========================================== */
/** Základný select/input vzhľad – konzistentný s povrchmi */
export const FIELD_BASE =
  "w-full rounded-md border border-white/10 bg-white/90 dark:bg-gray-900/70 " +
  "px-2.5 py-2 text-sm outline-none " +
  "focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 " +
  "transition-colors";

/** Disabled modifier */
export const FIELD_DISABLED = "opacity-60 cursor-not-allowed";

/** Pomocný text pod poľom */
export const FIELD_HELP = "text-[11px] opacity-70 mt-1";

/** Tichý text / caption */
export const MUTED_TEXT = "text-xs opacity-70";