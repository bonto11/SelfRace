"use client";

import { useMemo } from "react";
import {
  DAY_ORDER,
  type DailyPlan,
  detectSport,
  dateFromWeekStart,
  getItemLabel,
} from "@/features/coach/utils/plan";
import PlanCardDetail from "@/features/coach/components/PlanCardDetail";
import CommonActivityCard from "@/shared/components/CommonActivityCard";

type Row = {
  id: string;
  day: (typeof DAY_ORDER)[number];
  dateStr: string | null;
  sport: "run" | "ride" | "strength" | "other";
  title: string;
  focus?: string;
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
          focus: (it as any).focus ?? "",
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

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const meta: string[] = [];
        if (r.dur) meta.push(r.dur);
        if (r.intensity) meta.push(r.intensity);
        if (r.target) meta.push(r.target);

        return (
          <CommonActivityCard
            key={r.id}
            id={`plan-${r.id}`}
            headerLeft={r.dateStr ? `${r.day} · ${r.dateStr}` : r.day}
            sportKind={r.sport}
            title={r.title}
            subtitle={r.focus || null}
            meta={meta}
            defaultOpen={false}
            disableToggleIfNoChildren={!r.structure}
          >
            {r.structure ? <PlanCardDetail s={r.structure} /> : null}
          </CommonActivityCard>
        );
      })}
    </div>
  );
}
