// src/app/shared/ui/tokens/shell.ts
import type * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SURFACE_INSET, SURFACE_INSET_STYLE } from "./core";

/* ===== SHELL ROOT ====================================================== */

export const SHELL_BG = "min-h-dvh";
export const SHELL_BG_STYLE: React.CSSProperties = {
  background: appColors.backgroundMain,
  color: appColors.textPrimary,
};

/* ===== TOPBARS ========================================================= */

export const TOPBAR_MOBILE = [
  "lg:hidden sticky top-0 z-40 flex items-center gap-3",
  "backdrop-blur px-3 py-2 border-b",
].join(" ");

export const TOPBAR_MOBILE_STYLE: React.CSSProperties = {
  background: appColors.backgroundMain,
  borderColor: appColors.divider,
};

export const TOPBAR_DESKTOP = [
  "hidden lg:flex h-14 items-center justify-between px-4 border-b",
].join(" ");

export const TOPBAR_DESKTOP_STYLE: React.CSSProperties = {
  background: appColors.backgroundMain,
  borderColor: appColors.divider,
};

/* ===== ICON BUTTON ===================================================== */

export const ICON_BUTTON = ["rounded-lg p-2", "border"].join(" ");

export const ICON_BUTTON_STYLE: React.CSSProperties = {
  borderColor: appColors.surfaceCardBorder,
};

export const ICON_BUTTON_HOVER_STYLE: React.CSSProperties = {
  background: appColors.surfaceCardHover,
};

/* ===== SIDEBAR ========================================================= */

export const SIDEBAR_DESKTOP = "hidden lg:block border-r sticky top-0 h-dvh";

export const SIDEBAR_DESKTOP_STYLE: React.CSSProperties = {
  borderColor: appColors.divider,
};

export const SIDEBAR_MOBILE_PANEL = [
  "lg:hidden fixed inset-y-0 left-0 z-50 w-[280px]",
  "border-r shadow-xl transition-transform duration-200",
].join(" ");

export const SIDEBAR_MOBILE_PANEL_STYLE: React.CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.divider,
};

export const SIDEBAR_OVERLAY = "lg:hidden fixed inset-0 z-40";
export const SIDEBAR_OVERLAY_STYLE: React.CSSProperties = {
  background: appColors.overlay,
};

/* ===== GRID / CONTENT ================================================== */

export const SHELL_GRID = "grid lg:grid-cols-[280px_1fr]";
export const CONTENT_CONTAINER = "container mx-auto px-3 sm:px-4 lg:px-6 py-4";
export const BRAND_TEXT = "font-semibold";

/* ===== AVATAR ========================================================== */

export const AVATAR_BUTTON =
  "w-9 h-9 rounded-full font-semibold grid place-items-center";

export const AVATAR_BUTTON_STYLE: React.CSSProperties = {
  background: appColors.brandPrimary,
  color: appColors.textInverse,
};

/* ===== DROPDOWN ======================================================== */

export const DROPDOWN_PANEL =
  SURFACE_INSET + " absolute right-0 mt-2 w-56 p-2 z-30";
export const DROPDOWN_PANEL_STYLE: React.CSSProperties = {
  ...SURFACE_INSET_STYLE,
};

export const DROPDOWN_DIVIDER = "my-1 border-t";
export const DROPDOWN_DIVIDER_STYLE: React.CSSProperties = {
  borderColor: appColors.divider,
};

export const DROPDOWN_ITEM = "w-full text-left px-2 py-1 rounded";
export const DROPDOWN_ITEM_HOVER_STYLE: React.CSSProperties = {
  background: appColors.surfaceCardHover,
};

export const DROPDOWN_ITEM_DANGER = "w-full text-left px-2 py-1 rounded";
export const DROPDOWN_ITEM_DANGER_STYLE: React.CSSProperties = {
  color: appColors.statusError,
};
export const DROPDOWN_ITEM_DANGER_HOVER_STYLE: React.CSSProperties = {
  background: appColors.buttonGhostBgHover,
};

/* ===== NAV ============================================================= */

export const NAV_ITEM = "block px-3 py-2 rounded-lg";
export const NAV_ITEM_HOVER_STYLE: React.CSSProperties = {
  background: appColors.buttonGhostBgHover,
};

export const NAV_ITEM_ACTIVE = "rounded-lg";
export const NAV_ITEM_ACTIVE_STYLE: React.CSSProperties = {
  background: appColors.buttonGhostBgHover,
  color: appColors.textPrimary,
};

export const HAMBURGER_BTN = "w-10 h-10 -ml-2";
