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
  "px-3",
  "py-2",
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