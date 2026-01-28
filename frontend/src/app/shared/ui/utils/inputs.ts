// src/app/shared/ui/utils/inputs.ts
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost"
  | "back"
  | "prefs"
  | "editable"
  | "active"
  | "connectStrava"
  | "disconnectStrava"
  | "viewOnStrava";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

// DEPRECATED: nechaj len sizing/layout ak niekde ešte používaš priamo className
export function buttonClass(
  _variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  { circle = false }: { circle?: boolean; active?: boolean } = {}
) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium select-none " +
    "transition-colors duration-200 focus:outline-none rounded-full";

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
          : circle
            ? "h-9 w-9 text-sm"
            : "px-4 py-2.5 text-sm";

  return cx(base, sz);
}