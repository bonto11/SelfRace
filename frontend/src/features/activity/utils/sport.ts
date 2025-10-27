import { THEME } from "@/shared/theme/tokens";

export function toEffSport(row: {
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
}): string {
  const s = (row.sport_type_ovrd ?? row.sport_type_fe ?? row.sport_type ?? "")
    .toString()
    .toLowerCase();

  if (!s) return "other";
  if (s.includes("run")) return "run";
  if (s.includes("ride") || s.includes("bike") || s.includes("cycle")) return "ride";
  if (s.includes("strength") || s.includes("weight") || s.includes("gym")) return "strength";
  if (s.includes("skate")) return "skate";
  if (s.includes("mix")) return "mixed";
  if (s.includes("walk")) return "walk";
  if (s.includes("hike")) return "hike";
  if (s.includes("swim")) return "swim";
  return s;
}

export function sportUiLabel(s: string): string {
  const L = THEME.sportLabels;
  return L[s] || s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
