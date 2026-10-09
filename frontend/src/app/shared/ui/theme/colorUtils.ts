// src/app/shared/ui/theme/colorUtils.ts

/** "#RRGGBB" + priehľadnosť → "rgba(r, g, b, a)". Paleta drží len plné farby. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
