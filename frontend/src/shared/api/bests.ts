// src/shared/api/bests.ts
import { API_URL } from "@/shared/config";

export type Sport = "run" | "ride" | "strength" | "skate"; // zjednotené s BE (ride namiesto bike)

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
  ride: [] as { m: number; label: string }[],
  strength: [] as { m: number; label: string }[],
  skate: [] as { m: number; label: string }[],
} as const;

export const RUN_DISTANCE_OPTIONS = DISTANCE_OPTIONS_BY_SPORT.run;
export const RUN_DISTANCES_M = RUN_DISTANCE_OPTIONS.map(d => d.m) as readonly number[];

export function distanceOptions(sport: Sport = "run") {
  return DISTANCE_OPTIONS_BY_SPORT[sport] ?? [];
}
export function distancesFor(sport: Sport = "run"): number[] {
  return distanceOptions(sport).map(o => o.m);
}
export function isAllowedDistance(m: number, sport: Sport = "run"): boolean {
  return distanceOptions(sport).some(o => o.m === m);
}
export function distanceLabel(m: number, sport: Sport = "run"): string {
  const f = distanceOptions(sport).find(x => x.m === m);
  if (f) return f.label;
  const km = m / 1000;
  return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
}

export type UserBest = {
  sport?: Sport;               // default 'run'
  distance_m: number;
  best_time_s?: number | null; // prichádza z BE
  time_str?: string | null;    // alternatíva ak nie sú sekundy
  activity_id?: number | null;
  activity_name?: string | null; // ← DOPLNENÉ
  achieved_at?: string | null; // YYYY-MM-DD alebo ISO
};

function normalizeRow(r: any): UserBest {
  return {
    sport: (r?.sport as Sport) ?? "run",
    distance_m: Number(r?.distance_m) || 0,
    best_time_s: r?.best_time_s ?? null,
    time_str: r?.time_str ?? null,
    activity_id: r?.activity_id ?? null,
    activity_name: r?.activity_name ?? null, // ← DOPLNENÉ
    achieved_at: r?.achieved_at ?? null,
  };
}

function sortBySportOrder(sport: Sport) {
  const order = new Map<number, number>(distanceOptions(sport).map((o, i) => [o.m, i]));
  return (a: UserBest, b: UserBest) =>
    (order.get(a.distance_m) ?? 999) - (order.get(b.distance_m) ?? 999);
}

/** GET /user_bests/{userId}?sport=run */
export async function getBests(userId: number, sport: Sport = "run"): Promise<UserBest[]> {
  const r = await fetch(`${API_URL}/user_bests/${userId}?sport=${sport}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `bests load failed: ${r.status}`);
  const arr = (j?.data ?? []).map(normalizeRow);
  return distanceOptions(sport).length ? arr.sort(sortBySportOrder(sport)) : arr;
}

/** PUT→POST align: POST /user_bests/{userId} (upsert) */
export async function saveBest(userId: number, best: UserBest): Promise<void> {
  const sport = best.sport ?? "run";

  // preferuj time_sec, ak máš best_time_s
  const payload = {
    sport,
    distance_m: best.distance_m,
    time_sec: typeof best.best_time_s === "number" ? best.best_time_s : undefined,
    time_str: typeof best.best_time_s === "number" ? undefined : best.time_str ?? undefined,
    activity_id: best.activity_id ?? undefined,
    activity_name: best.activity_name ?? undefined,
    achieved_at: best.achieved_at ?? undefined, // očakávame "YYYY-MM-DD"
  };

  if (!isAllowedDistance(payload.distance_m, sport)) {
    console.warn(`[bests.save] distance ${payload.distance_m} not in map for sport=${sport}`);
  }

  const r = await fetch(`${API_URL}/user_bests/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `save best failed: ${r.status}`);
}

/** DELETE /user_bests/{userId}?sport=run&distance_m=5000 */
export async function deleteBest(userId: number, distance_m: number, sport: Sport = "run"): Promise<void> {
  const url = `${API_URL}/user_bests/${userId}?sport=${sport}&distance_m=${distance_m}`;
  const r = await fetch(url, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `delete failed: ${r.status}`);
}