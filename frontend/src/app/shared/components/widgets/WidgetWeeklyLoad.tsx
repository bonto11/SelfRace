// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import { THEME } from "@/app/shared/theme/tokens";
import { minToHM, fmtRange } from "@/app/shared/utils/time";
import { WIDGET_LOADING_WRAP } from "@/app/shared/theme/uiTokens";
import { appColors } from "@/app/shared/theme/app_colors";

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

  // ✅ žiadne statické farby: len THEME/appColors fallback
  const colNeutral =
    THEME?.chart?.neutral ?? (THEME as any)?.accent?.neutral ?? appColors.textMuted;
  const colUp = THEME?.chart?.positive ?? THEME?.chart?.good ?? colNeutral;
  const colWarn = THEME?.chart?.warning ?? THEME?.chart?.hard20 ?? colNeutral;
  const colDown = THEME?.chart?.cool ?? THEME?.chart?.lineSecondary ?? colNeutral;

  let note = "—";
  let accent: string | undefined = colNeutral;

  if (!loading) {
    if (diffPct == null) {
      note = "—";
      accent = colNeutral;
    } else if (diffPct > 20) {
      note = "↑ oproti predošlým 7 dňom výrazne viac";
      accent = colWarn;
    } else if (diffPct < -20) {
      note = "↓ výrazne menej než predchádzajúcich 7 dní";
      accent = colDown;
    } else {
      note = "≈ podobne ako predchádzajúcich 7 dní";
      accent = colUp;
    }
  }

  const rangeTxt =
    r7?.last?.range?.start && r7?.last?.range?.end
      ? fmtRange(r7.last.range.start, r7.last.range.end)
      : "—";

  return (
    <WidgetCard
      title={title}
      accent={accent} // hex / css paint ok
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP} aria-live="polite">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-extrabold leading-none tabular-nums">
              {h}
            </span>
            <span className="text-xl opacity-80">h</span>
            <span className="text-5xl font-extrabold leading-none tabular-nums">
              {m.toString().padStart(2, "0")}
            </span>
            <span className="text-xl opacity-80">m</span>
          </div>

          <div className="opacity-80 text-sm mt-1">
            {note}
            {rangeTxt && rangeTxt !== "—" ? ` • ${rangeTxt}` : ""}
          </div>
        </>
      )}
    </WidgetCard>
  );
}