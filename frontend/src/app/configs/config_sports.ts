// FE "jedno miesto pravdy" pre športy v 80/20 (zarovnané s BE)

export const SPORT_ALIAS: Record<string, string> = {
  all: "all",
  run: "run",

  // bike / ride aliasy
  bike: "ride",
  riding: "ride",
  ride: "ride",
  cycling: "ride",

  mixed: "mixed",
  skate: "skate",

  // veci mimo defaultu 80/20 (ale FE ich môžeme ponúknuť)
  strength: "strength",
  swim: "swim",
  walk: "walk",
  hike: "hike",
  soccer: "soccer",
  other: "other",
};

export const PARETO_DEFAULT_SET = new Set<string>(["run", "ride", "mixed", "skate"]);

// čo ukazujeme v UI (poradie + labely)
export const SPORT_OPTIONS: { value: string; label: string }[] = [
  { value: "run", label: "Run" },
  { value: "ride", label: "Ride" },
  { value: "mixed", label: "Mixed" },
  { value: "skate", label: "Skate" },
  // voliteľné (mimo defaultu):
  { value: "strength", label: "Strength" },
  { value: "swim", label: "Swim" },
  { value: "walk", label: "Walk" },
  { value: "hike", label: "Hike" },
  { value: "soccer", label: "Soccer" },
  { value: "other", label: "Other" },
];

export function normalizeSport(s: string | null | undefined): string | null {
  if (!s) return null;
  const k = String(s).trim().toLowerCase();
  return SPORT_ALIAS[k] ?? k;
}

export function normalizeSportList(list: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of list) {
    const n = normalizeSport(x);
    if (!n || n === "all") continue;
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** 
 * CSV string pre be. 
 * - ak empty -> "all" (backend použije default whitelist)
 * - inak CSV z normalizovaných hodnôt
 */
export function sportsToCSV(list: (string | null | undefined)[]): string {
  const norm = normalizeSportList(list);
  return norm.length ? norm.join(",") : "all";
}

/** Pomôcka pre UI: je šport v default whiteliste? */
export function isInParetoDefault(s: string) {
  return PARETO_DEFAULT_SET.has(normalizeSport(s) ?? "");
}