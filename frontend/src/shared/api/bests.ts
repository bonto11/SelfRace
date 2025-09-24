// src/shared/api/bests.ts
import { API_URL } from "@/shared/config";

export type Sport = "run" | "bike" | "strength" | "skate";

export const RUN_DISTANCE_OPTIONS = [
  { m: 400, label: "400 m" },
  { m: 1000, label: "1 km" },
  { m: 5000, label: "5 km" },
  { m: 10000, label: "10 km" },
  { m: 20000, label: "20 km" },
  { m: 21097, label: "Half marathon" },
  { m: 30000, label: "30 km" },
  { m: 42195, label: "Marathon" },
  { m: 50000, label: "50 km" },
] as const;

export const RUN_DISTANCES_M = RUN_DISTANCE_OPTIONS.map(d => d.m) as unknown as readonly number[];

export type UserBest = {
  sport?: Sport;                 // default 'run'
  distance_m: number;
  best_time_s?: number | null;
  time_str?: string | null;
  activity_id?: number | null;
  achieved_at?: string | null;   // YYYY-MM-DD alebo ISO
};

export function distanceLabel(m: number): string {
  const f = RUN_DISTANCE_OPTIONS.find(x => x.m === m);
  return f ? f.label : `${(m / 1000).toFixed(3)} km`;
}

function normalizeRow(r: any): UserBest {
  return {
    sport: r?.sport ?? "run",
    distance_m: typeof r?.distance_m === "number" ? r.distance_m : 0,
    best_time_s: r?.best_time_s ?? r?.time_sec ?? null,
    time_str: r?.time_str ?? null,
    activity_id: r?.activity_id ?? null,
    achieved_at: r?.achieved_at ?? r?.date ?? null,
  };
}

export async function getBests(userId: number, sport: Sport = "run"): Promise<UserBest[]> {
  const r = await fetch(`${API_URL}/users/${userId}/bests?sport=${sport}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `bests load failed: ${r.status}`);
  const order = new Map<number, number>(RUN_DISTANCES_M.map((d, i) => [d, i]));
  return (j?.bests ?? []).map(normalizeRow).sort(
    (a: UserBest, b: UserBest) => (order.get(a.distance_m) ?? 999) - (order.get(b.distance_m) ?? 999)
  );
}

export async function saveBest(
  userId: number,
  payload: { sport?: Sport; distance_m: number; time_sec?: number; time_str?: string; activity_id?: number; achieved_at?: string }
): Promise<void> {
  const body = JSON.stringify({ sport: payload.sport ?? "run", ...payload });
  const r = await fetch(`${API_URL}/users/${userId}/bests`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `save best failed: ${r.status}`);
}

export async function deleteBest(userId: number, distance_m: number, sport: Sport = "run"): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/bests/${distance_m}?sport=${sport}`, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `delete best failed: ${r.status}`);
}