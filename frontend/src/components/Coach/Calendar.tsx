"use client";

import DayItem from "./DayItem";

export const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as const;
type DayKey = typeof DAY_ORDER[number];

export function extractDailyPlan(plan: any): { day: DayKey; items: any[] }[] | null {
  if (!plan || typeof plan !== "object") return null;
  const get = (k: string) => plan[k] ?? plan[k?.toLowerCase()];
  const has = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].some(k => k in plan || k.toUpperCase() in plan);
  if (!has) return null;

  const map = [
    {label:"Mon", key:"monday"},
    {label:"Tue", key:"tuesday"},
    {label:"Wed", key:"wednesday"},
    {label:"Thu", key:"thursday"},
    {label:"Fri", key:"friday"},
    {label:"Sat", key:"saturday"},
    {label:"Sun", key:"sunday"},
  ] as const;

  return map.map(d => {
    const v = get(d.key);
    const items = Array.isArray(v) ? v : (v ? [v] : []);
    return { day: d.label as DayKey, items };
  });
}

export default function Calendar({ daily }: { daily: { day: DayKey; items: any[] }[] }) {
  return (
    <div>
      <h3 className="font-semibold">Next week (calendar)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {DAY_ORDER.map(label => {
          const day = daily.find(d => d.day === label);
          return (
            <div key={label} className="bg-gray-900/40 border border-gray-700 rounded p-3">
              <div className="font-semibold mb-1">{label}</div>
              {!day || day.items.length === 0 ? (
                <div className="text-sm opacity-70">—</div>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {day.items.map((it, i) => <DayItem key={i} it={it} />)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}