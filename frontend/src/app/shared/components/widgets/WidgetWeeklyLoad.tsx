// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/components/components/LoadingSpinner";
import WidgetCard from "@/app/shared/components/components/WidgetCard";
import { THEME } from "@/app/shared/theme/tokens";
import { minToHM, fmtRange } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

export default function WeeklyLoadWidget({
  title = "Záťaž – posledných 7 dní",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();

  const r7 = rolling7?.("time");
  const totalLast = Number(r7?.last?.sum ?? 0);
  const totalPrev = Number(r7?.prev?.sum ?? 0);

  const { h, m } = useMemo(() => minToHM(totalLast), [totalLast]);

  const diffPct: number | null = useMemo(() => {
    if (!totalPrev) return null;
    return ((totalLast - totalPrev) / totalPrev) * 100;
  }, [totalLast, totalPrev]);

  const CH = (THEME as any)?.chart ?? {};

  const colNeutral =
    CH.neutral ?? (THEME as any)?.accent?.neutral ?? appColors.textMuted;
  const colUp = CH.positive ?? CH.good ?? CH.fitness ?? colNeutral;
  const colWarn = CH.warning ?? CH.average ?? CH.hard20 ?? colNeutral;
  const colDown = CH.cool ?? CH.lineSecondary ?? colNeutral;

  let note = "—";
  let accent: string = colNeutral;

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

  const valueText = loading ? "—" : `${h}h ${String(m).padStart(2, "0")}m`;

  return (
    <WidgetCard
      title={title}
      accent={accent}
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
          <div className={WIDGET_VALUE_ROW}>
            <span className={WIDGET_VALUE_PRIMARY}>{h}</span>
            <span className={WIDGET_VALUE_UNIT}>h</span>
            <span className={WIDGET_VALUE_PRIMARY}>
              {String(m).padStart(2, "0")}
            </span>
            <span className={WIDGET_VALUE_UNIT}>m</span>
          </div>

          <p className={WIDGET_NOTE}>
            {note}
            {rangeTxt && rangeTxt !== "—" ? ` • ${rangeTxt}` : ""}
          </p>
        </>
      )}
    </WidgetCard>
  );
}
