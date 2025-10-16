// src/shared/api/bests.ts
// FE API + pomocné utility pre osobné rekordy (PB).
// - Jediný zdroj pravdy pre povolené vzdialenosti a ich labely (per sport)
// - Fetch/save/delete volania na BE
// - Normalizácia a stabilné radenie podľa poradia z mapy

import { API_URL } from "@/shared/config";

export type Sport = "run" | "bike" | "strength" | "skate";

/** Vzdialenosti a labely podľa športu (zatiaľ je “run” kompletný). */
export const DISTANCE_OPTIONS_BY_SPORT = {
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
  // nechávam prázdne / TODO – doplníme, keď bude BE pripravený
  bike: [] as { m: number; label: string }[],
  strength: [] as { m: number; label: string }[],
  skate: [] as { m: number; label: string }[],
} as const;

/** Alias kvôli existujúcemu kódu pre RUN. */
export const RUN_DISTANCE_OPTIONS = DISTANCE_OPTIONS_BY_SPORT.run;
/** Čisto čísla v metroch (run). */
export const RUN_DISTANCES_M = RUN_DISTANCE_OPTIONS.map(d => d.m) as readonly number[];

/** Univerzálny prístup k možnostiam pre šport. */
export function distanceOptions(sport: Sport = "run") {
  return DISTANCE_OPTIONS_BY_SPORT[sport] ?? [];
}

/** Len čísla (metre) pre daný šport. */
export function distancesFor(sport: Sport = "run"): number[] {
  return distanceOptions(sport).map(o => o.m);
}

/** Overí, či daná vzdialenosť je povolená pre šport. */
export function isAllowedDistance(m: number, sport: Sport = "run"): boolean {
  return distanceOptions(sport).some(o => o.m === m);
}

/** Vráti ľudský label pre vzdialenosť v danom športe. */
export function distanceLabel(m: number, sport: Sport = "run"): string {
  const f = distanceOptions(sport).find(x => x.m === m);
  return f ? f.label : `${(m / 1000).toFixed(3)} km`;
}

export type UserBest = {
  sport?: Sport;               // default 'run'
  distance_m: number;
  best_time_s?: number | null;
  time_str?: string | null;
  activity_id?: number | null;
  achieved_at?: string | null; // YYYY-MM-DD alebo ISO
};

function normalizeRow(r: any): UserBest {
  return {
    sport: (r?.sport as Sport) ?? "run",
    distance_m: Number(r?.distance_m) || 0,
    best_time_s: r?.best_time_s ?? null,
    time_str: r?.time_str ?? null,
    activity_id: r?.activity_id ?? null,
    achieved_at: r?.achieved_at ?? null,
  };
}

/** Stabilné radenie podľa poradia v mape pre daný šport. */
function sortBySportOrder(sport: Sport) {
  const order = new Map<number, number>(distanceOptions(sport).map((o, i) => [o.m, i]));
  return (a: UserBest, b: UserBest) =>
    (order.get(a.distance_m) ?? 999) - (order.get(b.distance_m) ?? 999);
}

/** Načítanie PB (filtrované podľa športu). */
export async function getBests(userId: string, sport: Sport = "run"): Promise<UserBest[]> {
  const r = await fetch(`${API_URL}/users/${userId}/bests?sport=${sport}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `bests load failed: ${r.status}`);

  const arr = (j?.bests ?? []).map(normalizeRow);
  // zoradíme podľa našej mapy; keď mapa pre daný šport zatiaľ nie je, poradie necháme “as-is”
  return distanceOptions(sport).length ? arr.sort(sortBySportOrder(sport)) : arr;
}

/** Uloženie/UPSERT PB z riadku. */
export async function saveBest(userId: string, best: UserBest): Promise<void> {
  const sport = best.sport ?? "run";
  const payload = { ...best, sport };

  // Nezablokujeme FE, iba varovanie keď vzdialenosť nie je v zozname.
  if (!isAllowedDistance(payload.distance_m, sport)) {
    // eslint-disable-next-line no-console
    console.warn(`[bests.save] distance ${payload.distance_m} not in map for sport=${sport}`);
  }

  const r = await fetch(`${API_URL}/users/${userId}/bests`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `save best failed: ${r.status}`);
}

/** Vymazanie PB konkrétnej vzdialenosti v športe. */
export async function deleteBest(userId: string, distance_m: number, sport: Sport = "run"): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/bests/${sport}/${distance_m}`, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `delete failed: ${r.status}`);
}