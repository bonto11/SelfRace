// src/features/coach/components/PlanCards.tsx
"use client";

import { useMemo, useState } from "react";
import {
  DAY_ORDER,
  type DailyPlan,
  detectSport,
  dateFromWeekStart,
  getItemLabel,
} from "@/features/coach/utils/plan";
import PlanCardDetail from "@/features/coach/components/PlanCardDetail";

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
  id: string;
  day: typeof DAY_ORDER[number];
  dateStr: string | null;
  sport: "run" | "ride" | "strength" | "other";
  title: string;
  focus?: string; // placeholder – zatiaľ prázdne
  dur: string;
  intensity: string;
  target: string;
  notes: string;
  structure: any;
};

export default function PlanCards({
  daily,
  weekStart,
}: {
  daily: DailyPlan[];
  weekStart?: string;
}) {
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
          focus: "",
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
          focus: it.focus ?? "", // neskôr doplní AI
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
      {rows.map((r) => {
        const opened = r.structure && openId === r.id;
        return (
          <section
            key={r.id}
            className={[
              "rounded-2xl shadow-lg border border-white/10",
              "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
              "px-4 py-3",
            ].join(" ")}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {r.dateStr ? `${r.day} · ${r.dateStr}` : r.day}
              </div>
              <SportBadge kind={r.sport} />
            </div>

            {/* Title */}
            <div className="mt-0.5 text-base font-semibold tracking-tight">
              {r.title}
            </div>

            {/* Focus/účel tréningu – zatiaľ prázdny placeholder */}
            {r.focus ? (
              <div className="text-xs opacity-80">{r.focus}</div>
            ) : (
              <div className="text-xs opacity-40">—</div>
            )}

            {/* Meta riadok */}
            <div className="text-xs mt-1 opacity-80">
              {r.dur && <span>{r.dur}</span>}
              {r.intensity && <span>{r.dur ? " · " : ""}{r.intensity}</span>}
              {r.target && <span>{(r.dur || r.intensity) ? " · " : ""}{r.target}</span>}
            </div>

            {/* Notes */}
            {r.notes && <div className="text-xs mt-1 opacity-75">{r.notes}</div>}

            {/* Toggle detail */}
            {r.structure && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setOpenId(opened ? null : r.id)}
                  className="text-xs px-2 py-1 rounded-full border border-white/10 hover:bg-gray-700/40"
                >
                  {opened ? "Skryť detail" : "Detail"}
                </button>
              </div>
            )}

            {/* Detail */}
            {opened && <PlanCardDetail s={r.structure} />}
          </section>
        );
      })}
    </div>
  );
}