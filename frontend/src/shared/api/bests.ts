// src/shared/api/bests.ts
// API + typy pre Personal Bests (spoločné pre FE časti)

import { API_URL } from "@/shared/config";

// poradie a labely, ktoré ukazujeme v UI
export const BEST_DISTANCE_OPTIONS = [
  { m: 400,   label: "400 m" },
  { m: 1000,  label: "1 km" },
  { m: 5000,  label: "5 km" },
  { m: 10000, label: "10 km" },
  { m: 20000, label: "20 km" },
  { m: 21097, label: "Half marathon" },
  { m: 30000, label: "30 km" },
  { m: 42195, label: "Marathon" },
  { m: 50000, label: "50 km" },
] as const;

export const BEST_DISTANCES_M = BEST_DISTANCE_OPTIONS.map(d => d.m) as readonly number[];
export type BestDistanceM = (typeof BEST_DISTANCES_M)[number];

export type UserBest = {
  distance_m: number;
  best_time_s?: number | null;
  time_str?: string | null;
  activity_id?: number | null;
  achieved_at?: string | null; // YYYY-MM-DD
};

export function distanceLabel(m: number): string {
  const f = BEST_DISTANCE_OPTIONS.find(x => x.m === m);
  return f ? f.label : `${(m / 1000).toFixed(3)} km`;
}

function normalizeRow(r: any): UserBest {
  return {
    distance_m:
      typeof r?.distance_m === "number"
        ? r.distance_m
        : typeof r?.distance_km === "number"
        ? Math.round(r.distance_km * 1000)
        : 0,
    best_time_s: r?.best_time_s ?? r?.time_sec ?? null,
    time_str: r?.time_str ?? null, // BE ti z fetchu posiela už aj time_str (ak ho generuješ)
    activity_id: r?.activity_id ?? null,
    achieved_at: r?.achieved_at ?? r?.date ?? null,
  };
}

export async function getBests(userId: number): Promise<UserBest[]> {
  const r = await fetch(`${API_URL}/users/${userId}/bests`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `bests load failed: ${r.status}`);

  const order = new Map<number, number>(BEST_DISTANCES_M.map((d, i) => [d, i]));
  return (j?.bests ?? [])
    .map(normalizeRow)
    .sort((a: UserBest, b: UserBest) => (order.get(a.distance_m) ?? 999) - (order.get(b.distance_m) ?? 999));
}

export async function saveBest(
  userId: number,
  best: { distance_m: number; time_sec?: number; time_str?: string; activity_id?: number; achieved_at?: string }
): Promise<void> {
  // odfiltruj `undefined` a hlavne žiadne NaN do JSON (JSON.stringify z NaN spraví null → BE si myslí, že to posielaš zámerne)
  const payload: Record<string, any> = {};
  payload.distance_m = best.distance_m;

  if (typeof best.time_sec === "number" && Number.isFinite(best.time_sec) && best.time_sec > 0) {
    payload.time_sec = Math.floor(best.time_sec);
  } else if (typeof best.time_str === "string" && best.time_str.trim()) {
    payload.time_str = best.time_str.trim();
  }

  if (typeof best.activity_id === "number" && Number.isFinite(best.activity_id)) {
    payload.activity_id = best.activity_id;
  }
  if (typeof best.achieved_at === "string" && best.achieved_at.trim()) {
    payload.achieved_at = best.achieved_at.trim();
  }

  const r = await fetch(`${API_URL}/users/${userId}/bests`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `save best failed: ${r.status}`);
}