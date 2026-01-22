// src/shared/ui.ts
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Varianty tlačidiel */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost"
  | "back"
  | "prefs"; // ⬅️ PRIDANÉ

/** Veľkosti */
export type ButtonSize = "xs" | "sm" | "md" | "lg";

/** iOS-like kapsuly (plné zaoblenie) + varianty */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  // ⬇️ rozšírené o active (bezpečné – existujúce volania ostávajú platné)
  { circle = false, active = false }: { circle?: boolean; active?: boolean } = {}
) {
  const base =
    "inline-flex items-center justify-center gap-2 " +
    "font-medium select-none " +
    "transition-colors duration-200 " +
    "focus:outline-none focus-visible:ring-2 ring-offset-0 ring-primary/70 " +
    (circle ? "rounded-full aspect-square " : "rounded-full ");

  const sz =
    size === "xs"
      ? circle
        ? "h-7 w-7 text-xs"
        : "px-3 py-1.5 text-xs"
      : size === "sm"
      ? circle
        ? "h-8 w-8 text-sm"
        : "px-3.5 py-2 text-sm"
      : size === "lg"
      ? circle
        ? "h-11 w-11 text-base"
        : "px-5 py-3 text-base"
      : // md
        circle
        ? "h-9 w-9 text-sm"
        : "px-4 py-2.5 text-sm";

  const v =
    variant === "primary"
      ? "bg-primary text-[color:var(--on-primary)] hover:brightness-110"
      : variant === "secondary"
      ? "bg-white/10 text-white hover:bg-white/16 border border-white/15"
      : variant === "success"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500"
      : variant === "back"
      ? "bg-white/8 text-white hover:bg-white/14 border border-white/10"
      : variant === "prefs"
      ? // ⚠️ „Prefs“: čisté plátno bez borderu/ringu; farbu určuje active flag
        (active
          ? "bg-emerald-600 text-white border-0 ring-0 focus-visible:ring-0"
          : "bg-white/10 text-white hover:bg-white/16 border-0 ring-0 focus-visible:ring-0")
      : // ghost
        "bg-transparent text-white/90 hover:bg-white/8 border border-white/10";

  return cx(base, sz, v);
}

/* Text inputs */
export const inputClass =
  "w-full rounded-lg border border-border bg-surface text-text placeholder:text-muted px-3 py-2 " +
  "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/60";

export const labelClass = "text-sm text-text/90";
export const hintClass = "text-xs text-muted";