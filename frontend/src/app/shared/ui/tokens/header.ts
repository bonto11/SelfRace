// src/app/shared/ui/tokens/header.ts

/* ============================================================================
   HEADER / APPBAR TOKENS
   - layout only (colors via inline style from appColors in component)
============================================================================ */

export const APPBAR_WRAP = [
  "sticky",
  "z-30",
  "top-[max(env(safe-area-inset-top),0px)]",
].join(" ");

export const APPBAR_INNER = [
  "py-2",
].join(" ");

// “pill” cez celú šírku kontajnera
export const APPBAR_PILL = [
  "w-full",
  "rounded-2xl",
  "border",
  "backdrop-blur",
  "p-3",
].join(" ");

// grid aby bol Back vždy fixne vpravo a title neplával
export const APPBAR_ROW = [
  "grid",
  "grid-cols-[1fr_auto]",
  "items-center",
  "gap-3",
].join(" ");

export const APPBAR_TITLE = "text-lg font-semibold truncate";
export const APPBAR_RIGHT = "justify-self-end";

// ===== Title stack + Strava sub-brand =====

export const APPBAR_TITLE_STACK = "flex flex-col gap-1 min-w-0";

export const APPBAR_BRAND_IMG = "h-4 w-auto opacity-80 select-none";