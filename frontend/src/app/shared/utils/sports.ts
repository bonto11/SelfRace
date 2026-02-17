export function detectSport(it: any): "run" | "ride" | "strength" | "other" {
  const raw = String(it?.activity ?? it?.title ?? "").toLowerCase();
  if (raw.includes("run")) return "run";
  if (raw.includes("ride") || raw.includes("bike") || raw.includes("cycle")) return "ride";
  if (raw.includes("strength") || raw.includes("gym")) return "strength";
  return "other";
}