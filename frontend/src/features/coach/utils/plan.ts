// src/features/coach/utils/plan.ts
export const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as const;
export type DayKey = (typeof DAY_ORDER)[number];

export type DailyItem = {
  title?: string;
  activity?: string;
  duration_min?: number | null;
  duration?: number | null;
  intensity?: string | null;
  zone?: string | null;
  notes?: string | null;
  target_pace_min_per_km?: string | null;
  target_hr_bpm_range?: [number, number] | null;
  target_power_watts?: number | null;
  structure?: any;
};

export type DailyPlan = { day: DayKey; items: DailyItem[] };

export function extractDailyPlan(plan: any): DailyPlan[] | null {
  if (!plan || typeof plan !== "object") return null;

  const read = (k: string) => plan[k] ?? plan[k?.toLowerCase()];
  const hasAny =
    ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
      .some(k => k in plan || k.toUpperCase() in plan);
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

  return map.map(d => {
    const v = read(d.key);
    const items = Array.isArray(v) ? v : v ? [v] : [];
    return { day: d.label as DayKey, items };
  });
}

export function getItemLabel(it: any): {
  title: string;
  dur: number | null;
  intensity: string | null;
  target: string | null;
  notes: string | null;
} {
  if (!it || typeof it !== "object") {
    return { title: "Session", dur: null, intensity: null, target: null, notes: null };
  }
  const title = it.title || it.activity || "Session";
  const dur = it.duration_min ?? it.duration ?? null;
  const intensity = it.intensity || it.zone || null;

  const parts: string[] = [];
  if (it.target_pace_min_per_km) parts.push(`pace ${it.target_pace_min_per_km}/km`);
  if (Array.isArray(it.target_hr_bpm_range) && it.target_hr_bpm_range.length === 2)
    parts.push(`HR ${it.target_hr_bpm_range[0]}–${it.target_hr_bpm_range[1]} bpm`);
  if (it.target_power_watts) parts.push(`${it.target_power_watts} W`);

  return {
    title,
    dur,
    intensity,
    target: parts.length ? parts.join(" · ") : null,
    notes: it.notes ?? null,
  };
}