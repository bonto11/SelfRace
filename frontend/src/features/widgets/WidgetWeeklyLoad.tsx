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
function fmtRange(s: string, e: string) {
  const sd = new Date(s), ed = new Date(e);
  const sdD = sd.getDate(), sdM = sd.getMonth()+1;
  const edD = ed.getDate(), edM = ed.getMonth()+1;
  return sdM === edM ? `${sdD}–${edD}.${edM}.` : `${sdD}.${sdM}.–${edD}.${edM}.`;
}

export default function WeeklyLoadWidget({
  title = "Záťaž – posledných 7 dní",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();

  // rolling 7 dní (čas v minútach)
  const r7 = rolling7("time");
  const totalLast = r7.last.sum;
  const totalPrev = r7.prev.sum;

  const { h, m } = useMemo(() => minToHM(totalLast), [totalLast]);
  const diffPct = useMemo(
    () => (totalPrev ? ((totalLast - totalPrev) / totalPrev) * 100 : 0),
    [totalLast, totalPrev]
  );

  let note = "—";
  let accent = "bg-slate-700";
  if (!loading) {
    if (diffPct > 20)       { note = "↑ oproti predošlým 7 dňom výrazne viac"; accent = "bg-amber-500"; }
    else if (diffPct < -20) { note = "↓ výrazne menej než predchádzajúcich 7 dní"; accent = "bg-blue-700"; }
    else                    { note = "≈ podobne ako predchádzajúcich 7 dní"; accent = "bg-emerald-600"; }
  }

  return (
    <OpenerWidget title={title} accent={accent} onOpenDetail={onOpenDetail}>
      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-extrabold leading-none tabular-nums">{h}</span>
            <span className="text-xl opacity-80">h</span>
            <span className="text-5xl font-extrabold leading-none tabular-nums">
              {m.toString().padStart(2, "0")}
            </span>
            <span className="text-xl opacity-80">m</span>
          </div>

          <div className="opacity-80 text-sm mt-1">
            {note} • {fmtRange(r7.last.range.start, r7.last.range.end)}
          </div>
        </>
      )}
    </OpenerWidget>
  );
}