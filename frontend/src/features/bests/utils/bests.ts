import { Sport, UserBest } from "@/features/bests/types/bests";

// jeden typ pre položku
export type DistanceOption = { m: number; label: string };

// objekt typovaný podľa Sport
export const DISTANCE_OPTIONS_BY_SPORT: Record<Sport, readonly DistanceOption[]> = {
  run: [
    { m: 400, label: "400 m" },
    { m: 1000, label: "1 km" },
    { m: 5000, label: "5 km" },
    { m: 10000, label: "10 km" },
    { m: 20000, label: "20 km" },
    { m: 21097, label: "Half marathon" },
    { m: 30000, label: "30 km" },
    { m: 42195, label: "Marathon" },
    { m: 50000, label: "50 km" },
  ],
  ride: [] as readonly DistanceOption[],
  strength: [] as readonly DistanceOption[],
  skate: [] as readonly DistanceOption[],
  swim: [] as readonly DistanceOption[], // MUSÍ tu byť, keďže Sport obsahuje "swim"
} as const;

export const CANONICAL_DISTANCES = [400, 1000, 5000, 21097, 42195] as const;

export const RUN_DISTANCE_OPTIONS = DISTANCE_OPTIONS_BY_SPORT.run;
export const RUN_DISTANCES_M = RUN_DISTANCE_OPTIONS.map((d) => d.m) as readonly number[];

// vždy vráti pole DistanceOption, žiadne any, žiadne undefined
export function distanceOptions(sport: Sport = "run"): readonly DistanceOption[] {
  return DISTANCE_OPTIONS_BY_SPORT[sport];
}

export function distancesFor(sport: Sport = "run"): number[] {
  return distanceOptions(sport).map((o) => o.m);
}

export function isAllowedDistance(m: number, sport: Sport = "run"): boolean {
  return distanceOptions(sport).some((o) => o.m === m);
}

export function distanceLabel(m: number, sport: Sport = "run"): string {
  const f = distanceOptions(sport).find((x) => x.m === m);
  if (f) return f.label;
  const km = m / 1000;
  return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
}

export function normalizeRow(r: any): UserBest {
  return {
    sport: (r?.sport as Sport) ?? "run",
    distance_m: Number(r?.distance_m) || 0,
    best_time_s: r?.best_time_s ?? null,
    time_str: r?.time_str ?? null,
    activity_id: r?.activity_id ?? null,
    activity_name: r?.activity_name ?? null,
    achieved_at: r?.achieved_at ?? null,
  };
}

export function sortBySportOrder(sport: Sport) {
  const opts = distanceOptions(sport);
  const order = new Map<number, number>(opts.map((o, i) => [o.m, i]));

  return (a: UserBest, b: UserBest) =>
    (order.get(a.distance_m) ?? Number.POSITIVE_INFINITY) -
    (order.get(b.distance_m) ?? Number.POSITIVE_INFINITY);
}