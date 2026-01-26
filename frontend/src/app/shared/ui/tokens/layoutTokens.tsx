// src/app/shared/ui/tokens/layout.ts

export const PAGE_MAX_W = "max-w-screen-lg";

export const PAGE_CONTAINER = [PAGE_MAX_W, "mx-auto", "px-3", "w-full"].join(" ");

export const PAGE_FULL_BLEED = ["-mx-3", "px-3"].join(" ");
export const PAGE_STACK = "space-y-3";
export const PAGE_WIDGET_GRID = "grid grid-cols-1 lg:grid-cols-2 gap-4";
export const PAGE_SECTION_STACK = "space-y-4";
export const PAGE_GRID_3 = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";

export const PAGE_INTRO = "text-sm opacity-70";
export const PAGE_INTRO_TITLE = "text-base font-semibold";
export const PAGE_INTRO_TEXT = "text-sm opacity-70 leading-snug";

/**
 * Next build validator expects default export for this module.
 * Keep named exports for existing imports.
 */
const layoutConfig = {
  PAGE_MAX_W,
  PAGE_CONTAINER,
  PAGE_FULL_BLEED,
  PAGE_STACK,
  PAGE_WIDGET_GRID,
  PAGE_SECTION_STACK,
  PAGE_GRID_3,
  PAGE_INTRO,
  PAGE_INTRO_TITLE,
  PAGE_INTRO_TEXT,
} as const;

export default layoutConfig;