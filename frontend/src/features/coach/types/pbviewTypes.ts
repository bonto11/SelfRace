// src/features/coach/types/pbView.ts
// Typ a mapovania pre zobrazenie PB v tabuľke / UI.

import type { typePB } from "@/features/coach/types/coachTypes";

export type PBRow = {
  distanceKm: number;
  best: string;
  activityId?: number | null;
  date?: string | null;
};

/** DB/BE typPB → PBRow pre UI. */
export const bestToPBRow = (b: typePB): PBRow => ({
  distanceKm: Math.round((b.distance_m / 1000) * 10) / 10,
  best:
    b.time_str ??
    (typeof b.best_time_s === "number" ? secondsToHMS(b.best_time_s) : "—"),
  activityId: undefined,
  date: b.date ?? null,
});

/** PBRow z UI späť na typPB (napr. pri save). */
export const pbRowToBest = (row: PBRow): typePB => ({
  distance_m: Math.round(row.distanceKm * 1000),
  best_time_s: hmsToSeconds(row.best) ?? undefined,
  time_str: row.best,
  date: row.date ?? null,
  event_name: null,
});

const secondsToHMS = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

const hmsToSeconds = (hms: string): number | null => {
  const p = hms.split(":").map(Number);
  if (p.some(Number.isNaN)) return null;

  let [h, m, s] = p.length === 2 ? [0, p[0], p[1]] : p;
  return h * 3600 + m * 60 + s;
};
