// src/features/coach/components/PlanTable.tsx
"use client";

import { useMemo } from "react";
import { CARD } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";
import { DailyPlan, getItemLabel } from "@/features/coach/utils/plan";

function StructureMini({ s }: { s: any }) {
  if (!s || typeof s !== "object") return null;

  const blocks: string[] = [];
  if (Array.isArray(s.main) && s.main.length) {
    // napr. 1×(6×1’/1’) alebo 3×{reps×work/recover}
    const parts = s.main.map((b: any) => {
      const r = b.reps ? `${b.reps}×` : "";
      const rec = b.recover_min != null ? `/${b.recover_min}′` : "";
      return `${r}${b.work_min}′${rec}`;
    });
    blocks.push(parts.join(", "));
  }
  if (s.exercises?.length) {
    blocks.push(`${s.exercises.length} exercises`);
  }

  if (!blocks.length) return null;
  return <span className="opacity-70">{blocks.join(" | ")}</span>;
}

export default function PlanTable({ daily }: { daily: DailyPlan[] }) {
  const flat = useMemo(() => {
    const rows: {
      day: string;
      title: string;
      dur: string;
      intensity: string;
      target: string;
      structure: any;
      notes: string;
    }[] = [];

    daily.forEach(({ day, items }) => {
      if (!items?.length) {
        rows.push({
          day,
          title: "—",
          dur: "",
          intensity: "",
          target: "",
          structure: null,
          notes: "",
        });
        return;
      }
      items.forEach((it: any) => {
        const { title, dur, intensity, target, notes } = getItemLabel(it);
        rows.push({
          day,
          title,
          dur: dur != null ? `${dur} min` : "",
          intensity: intensity ?? "",
          target: target ?? "",
          structure: it.structure ?? null,
          notes: notes ?? "",
        });
      });
    });
    return rows;
  }, [daily]);

  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Next week (plan)</h3>
        <div className="text-xs opacity-60">{flat.length} položiek</div>
      </div>

      {/* MOBILE (karty) */}
      <div className="sm:hidden space-y-2">
        {flat.map((r, i) => (
          <div key={i} className="rounded border border-gray-700 p-3 bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="font-medium">{r.day}</div>
              <div className="text-xs opacity-80">{r.dur}</div>
            </div>
            <div className="mt-0.5">{r.title}</div>
            <div className="text-xs mt-1 opacity-80">
              {r.intensity && <span>{r.intensity}</span>}
              {r.target && <span>{r.intensity ? " · " : ""}{r.target}</span>}
              {r.structure && (
                <>
                  {(r.intensity || r.target) ? " · " : ""}
                  <StructureMini s={r.structure} />
                </>
              )}
            </div>
            {r.notes && <div className="text-xs mt-1 opacity-70">{r.notes}</div>}
          </div>
        ))}
      </div>

      {/* DESKTOP (tabuľka) */}
      <div className="hidden sm:block overflow-x-auto">
        <div style={{ minWidth: THEME.layout.tableMinWidth }}>
          <table className="w-full text-sm border-collapse text-center">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th className="w-[60px]">Day</th>
                <th>Session</th>
                <th className="w-[90px]">Duration</th>
                <th className="w-[110px]">Intensity</th>
                <th>Target</th>
                <th>Structure</th>
                <th className="w-[240px]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {flat.map((r, i) => (
                <tr
                  key={i}
                  className="border-t border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <td>{r.day}</td>
                  <td className="text-left px-2">{r.title}</td>
                  <td>{r.dur}</td>
                  <td>{r.intensity || "—"}</td>
                  <td className="text-left px-2">{r.target || "—"}</td>
                  <td className="text-left px-2"><StructureMini s={r.structure} />{!r.structure && "—"}</td>
                  <td className="text-left px-2">{r.notes || "—"}</td>
                </tr>
              ))}
              {!flat.length && (
                <tr>
                  <td colSpan={7} className="py-6 opacity-70">
                    Žiadne položky plánu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}