// src/shared/api/bests.ts
import { API_URL } from "@/shared/config";

export const BEST_DISTANCES_M = [400, 1000, 5000, 21097, 42195] as const;
export type BestDistanceM = (typeof BEST_DISTANCES_M)[number];

export type UserBest = {
  distance_m: number;
  best_time_s?: number | null;
  time_str?: string | null;
  event_name?: string | null;
  date?: string | null; // YYYY-MM-DD
};

function normalizeRow(r: any): UserBest {
  return {
    distance_m:
      typeof r?.distance_m === "number"
        ? r.distance_m
        : typeof r?.distance_km === "number"
        ? Math.round(r.distance_km * 1000)
        : 0,
    best_time_s: r?.best_time_s ?? r?.time_sec ?? null,
    time_str: r?.time_str ?? null,
    event_name: r?.event_name ?? null,
    date: r?.date ?? null,
  };
}

export async function getBests(userId: number): Promise<UserBest[]> {
  const r = await fetch(`${API_URL}/users/${userId}/bests`, { cache: "no-store" });
  if (!r.ok) throw new Error(`bests load failed: ${r.status}`);
  const j = await r.json().catch(() => ({}));
  const raw = (j?.bests ?? []) as any[];

  const order = new Map<number, number>(BEST_DISTANCES_M.map((d, i) => [d, i]));
  return raw.map(normalizeRow).sort((a, b) => (order.get(a.distance_m) ?? 999) - (order.get(b.distance_m) ?? 999));
}

export async function saveBest(userId: number, best: UserBest): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/bests`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(best),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.detail ?? `save best failed: ${r.status}`);
  }
}

export function distanceLabel(m: number): string {
  switch (m) {
    case 400: return "400 m";
    case 1000: return "1 km";
    case 5000: return "5 km";
    case 21097: return "21.097 km (polmaratón)";
    case 42195: return "42.195 km (maratón)";
    default:   return `${(m / 1000).toFixed(3)} km`;
  }
}