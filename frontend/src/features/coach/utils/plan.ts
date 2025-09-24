// src/features/coach/utils/plan.ts
import { DAY_ORDER, DayKey, DailyItem, DailyPlan } from "@/features/coach/types/day";

export function extractDailyPlan(plan: any): DailyPlan[] | null {
  if (!plan || typeof plan !== "object") return null;

  const lower = Object.keys(plan).map(k => k.toLowerCase());
  const hasDaily = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
    .some(k => lower.includes(k));
  if (!hasDaily) return null;

  const get = (k: string) => plan[k] ?? plan[k.toLowerCase()];
  const map = [
    { label: "Mon", key: "monday" },
    { label: "Tue", key: "tuesday" },
    { label: "Wed", key: "wednesday" },
    { label: "Thu", key: "thursday" },
    { label: "Fri", key: "friday" },
    { label: "Sat", key: "saturday" },
    { label: "Sun", key: "sunday" },
  ] as {label: DayKey, key: string}[];

  return map.map(d => {
    const v = get(d.key);
    const items: DailyItem[] = Array.isArray(v) ? v : (v ? [v] : []);
    return { day: d.label, items };
  });
}

export function getItemLabel(it: DailyItem) {
  const title = it.title || it.activity || it.name || "Session";
  const dur = it.duration_min ?? it.duration;
  const intensity = it.intensity || it.zone;
  const notes = it.notes || it.comment;
  return { title, dur, intensity, notes };
}