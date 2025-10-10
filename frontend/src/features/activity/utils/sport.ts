// FE fallback – zjednotenie športu do našich košov + UI labely

export function toEffSport(row: {
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
}): string {
  const s = (
    row.sport_type_ovrd ?? row.sport_type_fe ?? row.sport_type ?? ""
  )
    .toString()
    .toLowerCase();

  if (!s) return "other";
  if (s.includes("run")) return "run";
  if (s.includes("ride") || s.includes("bike") || s.includes("cycle")) return "bike";
  if (s.includes("strength") || s.includes("weight") || s.includes("gym")) return "strength";
  if (s.includes("skate")) return "skate";
  if (s.includes("mix")) return "mixed";
  if (s.includes("walk")) return "walk";
  if (s.includes("hike")) return "hike";
  if (s.includes("swim")) return "swim";
  return s;
}

const LABELS: Record<string, string> = {
  run: "Run",
  bike: "Bike",
  strength: "Strength",
  mixed: "Mixed",
  skate: "Skate",
  walk: "Walk",
  hike: "Hike",
  swim: "Swim",
  other: "Other",
};

export function sportUiLabel(s: string): string {
  return LABELS[s] || s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
