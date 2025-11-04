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

/* ===== KOMPAT ALIASY (aby si nemusel prepisovať inde hneď) ============ */
export const CARD   = SURFACE_CARD;
export const SUBCARD = SURFACE_SUBCARD;
export const PANEL = SURFACE_INSET;

/* ===== KALENDÁR ŠPECIFICKÉ ============================================ */
/** Jedna bunka dňa v kalendári – len decentný podklad a rámik */
export const CALENDAR_DAY_CELL =
  "rounded-xl border border-white/10 bg-white/5 dark:bg-black/20";

/** Header kalendára (riadok s názvom mesiaca a šípkami) */
export const CALENDAR_HEADER_BAR = SURFACE_CARD + " p-3";

/** Kontajner kalendára – presne to isté čo ActivityTable (jedna vrstva) */
export const CALENDAR_CONTAINER = SURFACE_CARD + " p-3";