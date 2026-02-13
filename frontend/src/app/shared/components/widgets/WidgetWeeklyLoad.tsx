// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { minToHM, fmtRange } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function WeeklyLoadWidget({
  title,
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();
  const t = useT();

  const r7 = rolling7?.("time");
  const totalLast = Number(r7?.last?.sum ?? 0);
  const totalPrev = Number(r7?.prev?.sum ?? 0);

  const { h, m } = useMemo(() => minToHM(totalLast), [totalLast]);

  const diffPct: number | null = useMemo(() => {
    if (!totalPrev) return null;
    return ((totalLast - totalPrev) / totalPrev) * 100;
  }, [totalLast, totalPrev]);

  const { note, accent } = useMemo(() => {
    if (loading || diffPct == null) return { note: "—", accent: "none" };
    if (diffPct > 20) return {
      note: t("weeklyLoad.status.muchMore"),
      accent: appColors.stateWarning
    };
    if (diffPct < -20) return {
      note: t("weeklyLoad.status.muchLess"),
      accent: appColors.stateWarning
    };
    return {
      note: t("weeklyLoad.status.similar"),
      accent: "none"
    };
  }, [loading, diffPct, t]);

  const rangeTxt =
    r7?.last?.range?.start && r7?.last?.range?.end
      ? fmtRange(r7.last.range.start, r7.last.range.end)
      : "—";

  return (
    <WidgetCard
      title={title ?? t("weeklyLoad.widget.title")}
      tooltip={t("weeklyLoad.widget.tooltip")}
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