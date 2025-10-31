// src/shared/ui.ts
/** Jednoduchý merge util (vyhne sa duplicitám). */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Základné prvky */
export const inputClass =
  "w-full rounded-md border border-border bg-surface text-text placeholder:!text-muted px-3 py-2 " +
  "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/60";

export const labelClass = "text-sm text-text/90";
export const hintClass = "text-xs text-muted";

/** Button – generátor štýlov cez variant + size */
export type ButtonVariant =
  | "primary"   // hlavná akcia (zelená/primárna)
  | "secondary" // neutrálna
  | "danger"    // zmazanie
  | "warning"   // pozor
  | "ghost"     // bez pozadia
  | "outline"   // orámovaný
  | "back"      // štandard “Späť”
  | "clear"     // šedé "Clear"
  | "refresh"   // neutrálne "Refresh"
  | "sync";     // akcie typu Sync

export type ButtonSize = "xs" | "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center select-none whitespace-nowrap rounded-md " +
  "font-medium transition-colors focus:outline-none focus:ring-2 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const BTN_SIZES: Record<ButtonSize, string> = {
  xs: "text-xs px-2 py-1",
  sm: "text-sm px-2.5 py-1.5",
  md: "text-sm px-3 py-2",
  lg: "text-base px-4 py-2.5",
};

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-[color:var(--on-primary)] hover:brightness-110 focus:ring-primary",
  secondary:
    "bg-muted/20 text-text hover:bg-muted/30 border border-border focus:ring-border",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600",
  warning: "bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-600",
  ghost:
    "bg-transparent text-text hover:bg-white/5 focus:ring-border border border-transparent",
  outline:
    "bg-transparent text-text border border-border hover:bg-white/5 focus:ring-border",
  back:
    "bg-transparent text-text border border-border hover:bg-white/5 focus:ring-border",
  clear:
    "bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-600 border border-gray-700",
  refresh:
    "bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-600 border border-gray-700",
  sync:
    "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string
) {
  return cx(BTN_BASE, BTN_SIZES[size], BTN_VARIANTS[variant], extra);
}