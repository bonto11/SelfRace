// src/app/shared/ui/tokens/page.ts

/* ============================================================================
   PAGE LAYOUT TOKENS
   - single source of truth for max width + horizontal padding
============================================================================ */

export const PAGE_MAX_W = "max-w-screen-lg"; // tu si neskôr vieš dať aj xl/2xl

// štandardný page kontajner pre všetky stránky
export const PAGE_CONTAINER = [
  PAGE_MAX_W,
  "mx-auto",
  "px-3",        // matchuje tvoje existujúce layouty
  "w-full",
].join(" ");

// full-bleed wrapper (keď chceš header/sekciu roztiahnuť cez okraj page paddingu)
export const PAGE_FULL_BLEED = ["-mx-3", "px-3"].join(" ");

// zvislé odsadenie pre bežnú stránku (voliteľné)
export const PAGE_STACK = "space-y-3";