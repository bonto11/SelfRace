// src/app/shared/ui/tokens/userMenu.ts

/* ============================================================================
   USER MENU TOKENS (layout only)
   - colors via inline styles (appColors)
============================================================================ */

export const USER_MENU_WRAP = "relative";

export const USER_MENU_TRIGGER = [
  "inline-flex items-center gap-2",
  "px-2 py-1",
  "rounded-lg",
  "transition-colors",
].join(" ");

export const USER_MENU_LABEL_ROW = "flex items-center gap-1 max-w-[160px] min-w-0";
export const USER_MENU_LABEL = "text-sm max-w-[120px] truncate text-right";

export const USER_MENU_TIER_PILL =
  "inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold";

export const USER_MENU_AVATAR_IMG = "rounded-full";

export const USER_MENU_DROPDOWN_WRAP = "absolute right-0 mt-2 w-64 z-50";

export const USER_MENU_PANEL_HEAD = "px-3 py-2 text-sm";
export const USER_MENU_HEAD_ROW = "flex items-center justify-between gap-2";
export const USER_MENU_HEAD_LEFT = "min-w-0";
export const USER_MENU_HEAD_NAME = "font-medium truncate";
export const USER_MENU_HEAD_EMAIL = "truncate";

export const USER_MENU_NAV = "py-1 flex flex-col gap-1";
export const USER_MENU_SIGNOUT_DISABLED = "disabled:opacity-60";