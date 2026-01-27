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
  | "prefs"
  | "connectStrava"
  | "disconnectStrava"
  | "viewOnStrava"; // ✅ NEW

/** Veľkosti */
export type ButtonSize = "xs" | "sm" | "md" | "lg";

/** iOS-like kapsuly */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  {
    circle = false,
    active = false,
  }: { circle?: boolean; active?: boolean } = {}
) {
  const base =
    "inline-flex items-center justify-center gap-2 " +
    "font-medium select-none " +
    "transition-colors duration-200 " +
    "focus:outline-none focus-visible:ring-2 ring-offset-0 ring-primary/70 " +
    (circle ? "rounded-full aspect-square " : "rounded-full ");

  // NOTE: connectStrava ignoruje size (výšku rieši SVG 48px),
  // ale wrapper nech sa nesnaží pridávať padding.
  const sz =
    variant === "connectStrava"
      ? "p-0"
      : size === "xs"
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
            : circle
              ? "h-9 w-9 text-sm"
              : "px-4 py-2.5 text-sm";

  const v =
    variant === "connectStrava"
      ? "bg-transparent hover:bg-transparent border-0 ring-0 focus-visible:ring-0"
      : variant === "disconnectStrava"
        ? "bg-transparent text-white/90 border border-white/15 hover:bg-white/8 ring-0 focus-visible:ring-0"
        : variant === "viewOnStrava"
          ? [
              "text-white",
              "font-semibold",
              "border border-white/15",
              "hover:brightness-110",
              "active:brightness-95",
              "ring-0 focus-visible:ring-0",
            ].join(" ")
          : variant === "primary"
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
                      ? active
                        ? "bg-emerald-600 text-white border-0 ring-0 focus-visible:ring-0"
                        : "bg-white/10 text-white hover:bg-white/16 border-0 ring-0 focus-visible:ring-0"
                      : "bg-transparent text-white/90 hover:bg-white/8 border border-white/10";

  return cx(base, sz, v);
}

/* Text inputs */
export const inputClass =
  "w-full rounded-lg border border-border bg-surface text-text placeholder:text-muted px-3 py-2 " +
  "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/60";

export const labelClass = "text-sm text-text/90";
export const hintClass = "text-xs text-muted";

// ✅ postupne: tokens cez barrel (nezabiješ importy v appke)
export * from "@/app/shared/ui/tokens/pageTokens";
export * from "@/app/shared/ui/tokens/header";