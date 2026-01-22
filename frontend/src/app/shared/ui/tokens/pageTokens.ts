/* ============================================================================
   PAGE LAYOUT TOKENS
   - single source of truth for max width + horizontal padding + page spacing
============================================================================ */

export const PAGE_MAX_W = "max-w-screen-lg";

// štandardný page kontajner pre všetky stránky
export const PAGE_CONTAINER = [
  PAGE_MAX_W,
  "mx-auto",
  "px-3",
  "w-full",
].join(" ");

// full-bleed wrapper (keď chceš header/sekciu roztiahnuť cez okraj page paddingu)
export const PAGE_FULL_BLEED = ["-mx-3", "px-3"].join(" ");

// zvislé odsadenie pre bežnú stránku
export const PAGE_STACK = "space-y-3";

// grid pre widgety (ako Activities)
export const PAGE_WIDGET_GRID = "grid grid-cols-1 lg:grid-cols-2 gap-4";

// ak chceš “sekcie” bez mt-*, použiješ len stack
export const PAGE_SECTION_STACK = "space-y-4";

export const PAGE_GRID_3 =
  "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";

/* ✅ intro text (jednotný štýl pre popisy pod headerom) */
export const PAGE_INTRO = "text-sm opacity-70";

export const PAGE_INTRO_TITLE = "text-base font-semibold";
export const PAGE_INTRO_TEXT = "text-sm opacity-70 leading-snug";