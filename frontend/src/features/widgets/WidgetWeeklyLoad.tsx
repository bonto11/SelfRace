// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import OpenerWidget from "@/features/widgets/OpenerWidget";

function minToHM(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return { h, m };
}

export default function WeeklyLoadWidget({
  title = "Týždenná záťaž (čas)",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { weeks, loading } = useActivityData();

  const last = weeks.at(-1);
  const prev = weeks.at(-2);

  const totalLast = useMemo(() => {
    if (!last) return 0;
    return (
      (last.time_run_min ?? 0) +
      (last.time_ride_min ?? 0) +
      (last.time_strength_min ?? 0) +
      (last.time_mixed_min ?? 0) +
      (last.time_skate_min ?? 0) +
      (last.time_other_min ?? 0)
    );
  }, [last]);

  const totalPrev = useMemo(() => {
    if (!prev) return 0;
    return (
      (prev.time_run_min ?? 0) +
      (prev.time_ride_min ?? 0) +
      (prev.time_strength_min ?? 0) +
      (prev.time_mixed_min ?? 0) +
      (prev.time_skate_min ?? 0) +
      (prev.time_other_min ?? 0)
    );
  }, [prev]);

  const { h, m } = minToHM(totalLast);
  const diffPct = totalPrev ? ((totalLast - totalPrev) / totalPrev) * 100 : 0;

  // slovné hodnotenie + farba lišty (jemné prahy)
  let note = "—";
  let accent = "bg-slate-700";
  if (!loading && last) {
    if (diffPct > 20)       { note = "↑ výrazne viac než minulý týždeň"; accent = "bg-amber-500"; }
    else if (diffPct < -20) { note = "↓ výrazne menej než minulý týždeň";  accent = "bg-blue-700"; }
    else                    { note = "≈ podobne ako minulý týždeň";        accent = "bg-emerald-600"; }
    if (!prev) note = last.label || last.week || note;
  }

  return (
    <OpenerWidget title={title} accent={accent} onOpenDetail={onOpenDetail}>
      {loading || !last ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <>
          {/* veľká hodnota – zarovnanie baseline konzistentné */}
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-extrabold leading-none tabular-nums">{h}</span>
            <span className="text-xl opacity-80">h</span>
            <span className="text-5xl font-extrabold leading-none tabular-nums">
              {m.toString().padStart(2, "0")}
            </span>
            <span className="text-xl opacity-80">m</span>
          </div>

          {/* radšej menší popis na ďalšom riadku, aby sa nezrážal s nadpisom */}
          <div className="opacity-80 text-sm mt-1">
            {note} • {last.label || last.week}
          </div>
        </>
      )}
    </OpenerWidget>
  );
}