// src/app/features/bests/utils/bests.ts

import { Sport, UserBest } from "@/app/features/bests/types/bests";
import type { typePB, PBRow, DistanceOption } from "@/app/features/bests/types/bests";

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
  ride: [
    { m: 10000, label: "10 km" },
    { m: 20000, label: "20 km" },
    { m: 40000, label: "40 km" },
    { m: 50000, label: "50 km" },
    { m: 90000, label: "90 km" },
    { m: 100000, label: "100 km" },
    { m: 160934, label: "100 miles" },
    { m: 180000, label: "180 km (Ironman)" },
  ],
  swim: [
    { m: 100, label: "100 m" },
    { m: 400, label: "400 m" },
    { m: 750, label: "750 m (Sprint)" },
    { m: 1000, label: "1 km" },
    { m: 1500, label: "1500 m (Olympic)" },
    { m: 1900, label: "1900 m (Half IM)" },
    { m: 3800, label: "3800 m (Ironman)" },
    { m: 5000, label: "5 km" },
  ],
  triathlon: [
    { m: 25750, label: "Sprint (750m+20k+5k)" },
    { m: 51500, label: "Olympic (1.5k+40k+10k)" },
    { m: 113000, label: "Half Ironman (1.9k+90k+21k)" },
    { m: 226000, label: "Ironman (3.8k+180k+42k)" },
  ],
  strength: [
    { m: 1, label: "Bench Press (1RM)" },
    { m: 2, label: "Squat / Drep (1RM)" },
    { m: 3, label: "Deadlift / Mŕtvy ťah (1RM)" },
    { m: 4, label: "Overhead Press (1RM)" },
    { m: 5, label: "Pull-ups / Zhyby (Max Reps)" },
    { m: 6, label: "Clean & Jerk (1RM)" },
    { m: 7, label: "Snatch (1RM)" },
  ],
  ocr: [
    { m: 5000, label: "Spartan Sprint (5k)" },
    { m: 10000, label: "Spartan Super (10k)" },
    { m: 21000, label: "Spartan Beast (21k)" },
    { m: 50000, label: "Spartan Ultra (50k)" },
  ],
  hyrox: [
    { m: 1, label: "Hyrox Open" },
    { m: 2, label: "Hyrox Pro" },
    { m: 3, label: "Hyrox Doubles" },
    { m: 4, label: "Hyrox Relay" },
  ],
  skate: [] as readonly DistanceOption[],
} as const;

export const CANONICAL_DISTANCES = [400, 1000, 5000, 21097, 42195] as const;

export const RUN_DISTANCE_OPTIONS = DISTANCE_OPTIONS_BY_SPORT.run;
export const RUN_DISTANCES_M = RUN_DISTANCE_OPTIONS.map((d) => d.m) as readonly number[];

// Hranica "aktuálny" vs "potenciál/expired" pre PB.
// MUSÍ zodpovedať PB_VALID_DAYS v backend prompts.py / user_bests_service.py.
export const PB_VALID_DAYS = 180;

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

/**
 * Počet dní od zadaného dátumu po dnešok. null = neznámy/nevalidný dátum.
 */
export function daysAgoFromDate(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const iso = dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * true/false, či je PB už "starý" (nad PB_VALID_DAYS).
 * Ak backend už poslal is_expired, použije sa priamo (jeden zdroj pravdy).
 * Inak sa dopočíta z achieved_at — FAIL-SAFE: neznámy dátum = expired=true,
 * aby sa nikdy tichým pádom nepovažoval za "čerstvý".
 */
export function isBestExpired(b: {
  is_expired?: boolean | null;
  achieved_at?: string | null;
}): boolean {
  if (typeof b.is_expired === "boolean") return b.is_expired;
  const days = daysAgoFromDate(b.achieved_at);
  return days == null ? true : days > PB_VALID_DAYS;
}

/**
 * Krátky label veku PB pre badge, napr. "11 mes.", "1 r 2 mes.".
 */
export function formatAgeLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mes.`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years} r ${remMonths} mes.` : `${years} r`;
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
    total_distance_m: r?.total_distance_m ?? null,
    total_time_s: r?.total_time_s ?? null,
    days_ago: r?.days_ago ?? null,
    is_expired: typeof r?.is_expired === "boolean" ? r.is_expired : null,
  };
}

export function sortBySportOrder(sport: Sport) {
  const opts = distanceOptions(sport);
  const order = new Map<number, number>(opts.map((o, i) => [o.m, i]));

  return (a: UserBest, b: UserBest) =>
    (order.get(a.distance_m) ?? Number.POSITIVE_INFINITY) -
    (order.get(b.distance_m) ?? Number.POSITIVE_INFINITY);
}

export const bestToPBRow = (b: typePB): PBRow => ({
  distanceKm: Math.round((b.distance_m / 1000) * 10) / 10,
  best:
    b.time_str ??
    (typeof b.best_time_s === "number" ? secondsToHMS(b.best_time_s) : "—"),
  activityId: undefined,
  date: b.date ?? null,
});

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