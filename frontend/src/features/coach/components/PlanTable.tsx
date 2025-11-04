// src/features/coach/components/PlanTable.tsx
"use client";

import { useState, useMemo } from "react";
import { CARD } from "@/shared/ui/classes";
import { DailyPlan, getItemLabel, detectSport, dateFromWeekStart } from "@/features/coach/utils/plan";
import PlanTableDetail from "@/features/coach/components/PlanCardDetail";

function SportBadge({ kind }: { kind: string }) {
  const label =
    kind === "run" ? "Run" :
    kind === "ride" ? "Ride" :
    kind === "strength" ? "Strength" : "Mixed";
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-gray-700">
      {label}
    </span>
  );
}

type Row = {
  id: string;                // unique
  day: string;               // Mon ...
  dateStr: string | null;    // 21. 09. 2025
  sport: "run"|"ride"|"strength"|"other";
  title: string;
  dur: string;
  intensity: string;
  target: string;
  notes: string;
  structure: any;
};

export default function PlanTable({ daily, weekStart }: { daily: DailyPlan[]; weekStart?: string }) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    daily.forEach(({ day, items }) => {
      if (!items?.length) {
        out.push({
          id: `${day}-empty`,
          day,
          dateStr: dateFromWeekStart(weekStart, day),
          sport: "other",
          title: "—",
          dur: "",
          intensity: "",
          target: "",
          notes: "",
          structure: null,
        });
        return;
      }
      items.forEach((it, idx) => {
        const { title, dur, intensity, target, notes } = getItemLabel(it);
        out.push({
          id: `${day}-${idx}`,
          day,
          dateStr: dateFromWeekStart(weekStart, day),
          sport: detectSport(it),
          title,
          dur: dur != null ? `${dur} min` : "",
          intensity: intensity ?? "",
          target: target ?? "",
          notes: notes ?? "",
          structure: it.structure ?? null,
        });
      });
    });
    return out;
  }, [daily, weekStart]);

  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className={`${CARD}`}>
        <h3 className="text-lg font-bold">Next week</h3>
      </div>

      {rows.map((r) => {
        const opened = openId === r.id;
        return (
          <div key={r.id} className={`${CARD} p-3`}>
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {r.dateStr ? `${r.day} · ${r.dateStr}` : r.day}
              </div>
              <SportBadge kind={r.sport} />
            </div>

            {/* Title */}
            <div className="mt-0.5 text-base">{r.title}</div>

            {/* Meta line */}
            <div className="text-xs mt-1 opacity-80">
              {r.dur && <span>{r.dur}</span>}
              {r.intensity && <span>{r.dur ? " · " : ""}{r.intensity}</span>}
              {r.target && <span>{(r.dur || r.intensity) ? " · " : ""}{r.target}</span>}
            </div>

            {/* Notes */}
            {r.notes && <div className="text-xs mt-1 opacity-70">{r.notes}</div>}

            {/* Toggle detail */}
            {r.structure && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setOpenId(opened ? null : r.id)}
                  className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-700"
                >
                  {opened ? "Hide detail" : "Detail"}
                </button>
              </div>
            )}

            {/* Detail */}
            {opened && r.structure && (
              <div className="mt-2">
                <PlanTableDetail s={r.structure} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}