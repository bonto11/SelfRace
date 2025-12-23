// src/features/coach/utils/plan.ts
// UI helpery na prácu s AI plánom (denný pohľad).

import {
  DAY_ORDER,
  type DayKey,
  type DailyItem,
  type DailyPlan,
} from "@/app/features/coach/types/planTypes";

/**
 * Z AI/JSON objektu, ktorý má kľúče monday..sunday, vyrobí
 * normalizované pole DailyPlan pre FE.
 */
export function extractDailyPlan(plan: any): DailyPlan[] | null {
  if (!plan || typeof plan !== "object") return null;

  const read = (k: string) => plan[k] ?? plan[k?.toLowerCase()];
  const hasAny =
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].some(
      (k) => k in plan || k.toUpperCase() in plan
    );

  if (!hasAny) return null;

  const map = [
    { label: "Mon", key: "monday" },
    { label: "Tue", key: "tuesday" },
    { label: "Wed", key: "wednesday" },
    { label: "Thu", key: "thursday" },
    { label: "Fri", key: "friday" },
    { label: "Sat", key: "saturday" },
    { label: "Sun", key: "sunday" },
  ] as const;

  return map.map((d) => {
    const v = read(d.key);
    const items: DailyItem[] = Array.isArray(v) ? v : v ? [v] : [];
    return { day: d.label as DayKey, items };
  });
}

/**
 * Z jedného AI itemu vyrobí "display" štruktúru pre UI (nadpis, trvanie, text cieľov).
 */
export function getItemLabel(it: any): {
  title: string;
  dur: number | null;
  intensity: string | null;
  target: string | null;
  notes: string | null;
} {
  if (!it || typeof it !== "object") {
    return {
      title: "Session",
      dur: null,
      intensity: null,
      target: null,
      notes: null,
    };
  }

  const title = it.title || it.activity || "Session";
  const dur = it.duration_min ?? it.duration ?? null;
  const intensity = it.intensity || it.zone || null;

  const parts: string[] = [];
  if (it.target_pace_min_per_km) {
    parts.push(`pace ${it.target_pace_min_per_km}/km`);
  }
  if (Array.isArray(it.target_hr_bpm_range) && it.target_hr_bpm_range.length === 2) {
    parts.push(`HR ${it.target_hr_bpm_range[0]}–${it.target_hr_bpm_range[1]} bpm`);
  }
  if (it.target_power_watts) {
    parts.push(`${it.target_power_watts} W`);
  }

  return {
    title,
    dur,
    intensity,
    target: parts.length ? parts.join(" · ") : null,
    notes: it.notes ?? null,
  };
}

/** Hrubá heuristika športu pre ikonku/farbu v UI. */
export function detectSport(it: any): "run" | "ride" | "strength" | "other" {
  const raw = String(it?.activity ?? it?.title ?? "").toLowerCase();
  if (raw.includes("run")) return "run";
  if (raw.includes("ride") || raw.includes("bike") || raw.includes("cycle")) return "ride";
  if (raw.includes("strength") || raw.includes("gym")) return "strength";
  return "other";
}

/**
 * Vráti **ISO dátum "YYYY-MM-DD"** pre daný deň týždňa,
 * ak dostaneš monday weekStart (t.j. Monday-based týždeň).
 */
export function dateFromWeekStart(
  weekStartISO: string | undefined,
  day: DayKey
): string | null {
  if (!weekStartISO) return null;
  try {
    const base = new Date(weekStartISO + "T00:00:00Z");
    const idx = DAY_ORDER.indexOf(day);
    const d = new Date(base.getTime() + idx * 86400000);
    return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  } catch {
    return null;
  }
}