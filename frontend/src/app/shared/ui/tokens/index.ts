// src/app/shared/ui/tokens/index.ts
export * from "./auth";
export * from "./calendar";
export * from "./charts";
export * from "./core";
export * from "./forms";
export * from "./header";
export * from "./inputsCard";
export * from "./misc";
export * from "./pageTokens";
export * from "./panels";
export * from "./shell";
export * from "./spinner";
export * from "./toast";
export * from "./userMenu";
export * from "./widgets";

// --- TEMP/LEGACY tokens to satisfy imports (build fix) ---
// If you later want, we can refactor components to use existing tokens instead.

export const BUTTON_BLOCK =
  "inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition select-none";

export const BUTTON_DISABLED =
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

export const DATE_FIELD_LABEL =
  "block text-xs font-medium opacity-80";

export const DATE_INPUT_INNER =
  "w-full rounded px-3 py-2 text-sm bg-transparent outline-none";

export const DISCLOSURE_ICON_BASE =
  "inline-flex items-center justify-center transition-transform";

export const DISCLOSURE_ICON_OPEN =
  "rotate-180";

export const DISCLOSURE_ICON_CLOSED =
  "rotate-0";

export const FIELD_HELP =
  "mt-1 text-xs opacity-70";
