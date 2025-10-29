"use client";

import OpenerWidget from "@/features/widgets/OpenerWidget";
import { useCoachData } from "@/features/coach/data/CoachDataProvider";
import type { Best } from "@/features/coach/types/coach";

function mToKm(m: number) {
  return Math.round((m / 1000) * 10) / 10;
}

function rowFromBest(b: Best) {
  return {
    distanceKm: mToKm(b.distance_m),
    best: b.time_str ?? "—",
    date: b.date ?? null,
    event: b.event_name ?? null,
  };
}

export default function WidgetPBRun({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { pbRun } = useCoachData();
  const top: Best[] = pbRun.slice(0, 4);

  return (
    <OpenerWidget title="PB — Running" accent="bg-indigo-600" onOpenDetail={onOpenDetail}>
      <div className="space-y-1 text-sm">
        {top.length === 0 && <div className="opacity-70">No personal bests yet.</div>}
        {top.map((b, i) => {
          const r = rowFromBest(b);
          return (
            <div key={i} className="flex items-center justify-between border-b border-gray-700/50 py-1 last:border-b-0">
              <div className="opacity-80">{r.distanceKm} km</div>
              <div className="font-semibold tabular-nums">{r.best}</div>
            </div>
          );
        })}
      </div>
    </OpenerWidget>
  );
}