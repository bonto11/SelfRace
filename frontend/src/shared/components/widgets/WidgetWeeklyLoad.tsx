// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { THEME } from "@/shared/theme/tokens";
import { minToHM, fmtRange } from "@/shared/utils/time";

export default function WeeklyLoadWidget({
  title = "Záťaž – posledných 7 dní",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();

  // môže byť undefined, tak ošetri:
  const r7 = rolling7?.("time"); // čas v minútach
  const totalLast = Number(r7?.last?.sum ?? 0);
  const totalPrev = Number(r7?.prev?.sum ?? 0);

  const { h, m } = useMemo(() => minToHM(totalLast), [totalLast]);

  // ak nie je predchádzajúce okno, diffPct = null
  const diffPct: number | null = useMemo(() => {
    if (!totalPrev) return null;
    return ((totalLast - totalPrev) / totalPrev) * 100;
  }, [totalLast, totalPrev]);

  // text + accent (THEME fallbacky)
  const colNeutral = THEME?.chart?.neutral ?? "#64748B";
  const colUp      = THEME?.chart?.positive ?? "#10B981";
  const colWarn    = THEME?.chart?.warning  ?? "#F59E0B";
  const colDown    = THEME?.chart?.cool     ?? "#3B82F6";

  let note = "—";
  let accent: string | undefined = colNeutral;

  if (!loading) {
    if (diffPct == null) {
      note = "—";
      accent = colNeutral;
    } else if (diffPct > 20) {
      note = "↑ oproti predošlým 7 dňom výrazne viac";
      accent = colWarn; // jantár
    } else if (diffPct < -20) {
      note = "↓ výrazne menej než predchádzajúcich 7 dní";
      accent = colDown; // modrá
    } else {
      note = "≈ podobne ako predchádzajúcich 7 dní";
      accent = colUp; // zelená
    }
  }

  const rangeTxt =
    r7?.last?.range?.start && r7?.last?.range?.end
      ? fmtRange(r7.last.range.start, r7.last.range.end)
      : "—";

  return (
    <WidgetCard
      title={title}
      accent={accent}                 // ← prijíma hex aj Tailwind class
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className="w-full flex items-center justify-center py-4" aria-live="polite">
          <LoadingSpinner size="widget" />
        </div>
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
            {note} {rangeTxt && rangeTxt !== "—" ? ` • ${rangeTxt}` : ""}
          </div>
        </>
      )}
    </WidgetCard>
  );
}