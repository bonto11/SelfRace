// src/app/shared/ui/tokens/shell.ts
import { appColors } from "@/app/shared/theme/app_colors";
import { SURFACE_INSET } from "./core";

/* ===== LAYOUT / SHELL ================================================== */
export const SHELL_BG = `min-h-dvh bg-[${appColors.backgroundMain}] text-[${appColors.textPrimary}]`;

export const TOPBAR_MOBILE = [
  "lg:hidden sticky top-0 z-40 flex items-center gap-3",
  `bg-[${appColors.backgroundMain}]`,
  "backdrop-blur px-3 py-2",
  `border-b border-[${appColors.divider}]`,
].join(" ");

export const TOPBAR_DESKTOP = [
  "hidden lg:flex h-14 items-center justify-between px-4",
  `border-b border-[${appColors.divider}]`,
  `bg-[${appColors.backgroundMain}]`,
].join(" ");

export const ICON_BUTTON = [
  "rounded-lg p-2",
  `border border-[${appColors.surfaceCardBorder}]`,
  `hover:bg-[${appColors.surfaceCardHover}]`,
].join(" ");

export const SIDEBAR_DESKTOP =
  `hidden lg:block border-r border-[${appColors.divider}] sticky top-0 h-dvh`;

export const SIDEBAR_MOBILE_PANEL = [
  "lg:hidden fixed inset-y-0 left-0 z-50 w-[280px]",
  `bg-[${appColors.backgroundAlt}]`,
  `border-r border-[${appColors.divider}]`,
  "shadow-xl transition-transform duration-200",
].join(" ");

export const SIDEBAR_OVERLAY =
  `lg:hidden fixed inset-0 z-40 bg-[${appColors.overlay}]`;

export const SHELL_GRID = "grid lg:grid-cols-[280px_1fr]";
export const CONTENT_CONTAINER = "container mx-auto px-3 sm:px-4 lg:px-6 py-4";
export const BRAND_TEXT = "font-semibold";

export const AVATAR_BUTTON = [
  "w-9 h-9 rounded-full font-semibold grid place-items-center",
  `bg-[${appColors.brandPrimary}]`,
  `text-[${appColors.textInverse}]`,
].join(" ");

export const DROPDOWN_PANEL =
  SURFACE_INSET + " absolute right-0 mt-2 w-56 p-2 z-30";
export const DROPDOWN_DIVIDER = `my-1 border-t border-[${appColors.divider}]`;

export const DROPDOWN_ITEM =
  `w-full text-left px-2 py-1 rounded hover:bg-[${appColors.surfaceCardHover}]`;

export const DROPDOWN_ITEM_DANGER =
  `w-full text-left px-2 py-1 rounded text-[${appColors.statusError}] hover:bg-[${appColors.buttonGhostBgHover}]`;

export const NAV_ITEM =
  `block px-3 py-2 rounded-lg hover:bg-[${appColors.buttonGhostBgHover}]`;
export const NAV_ITEM_ACTIVE =
  `bg-[${appColors.buttonGhostBgHover}] text-[${appColors.textPrimary}]`;

export const HAMBURGER_BTN = ICON_BUTTON + " w-10 h-10 -ml-2";