// src/shared/components/widgets/WidgetCoachDailyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_ERROR_TEXT,
  WIDGET_ERROR_SUB,
  WIDGET_INFO_TEXT,
  WIDGET_EMPTY_TEXT,
  WIDGET_KV_GRID,
  WIDGET_KV_LABEL,
  WIDGET_KV_VALUE,
  WIDGET_SUMMARY_WRAP,
  WIDGET_SUMMARY_HEAD,
  WIDGET_LIST,
  WIDGET_LIST_ITEM,
  WIDGET_BULLET,
  WIDGET_MORE_HINT,
  WIDGET_TRUNCATE,
} from "@/app/shared/ui/tokens";

import {
  apiGetDailyOverview,
  type DailyOverview,
  type DailyPlanDay,
} from "@/app/features/coach/api/coach_plan_daily";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  horizonDays: number;
  daysCount: number;
  sessionsCount: number;
  todayLabel: string | null;
  todaySessions: DailyPlanDay["sessions"] | null;
};

function buildUiState(overview: DailyOverview | null): UiState {
  if (!overview || !overview.days?.length) {
    return {
      horizonDays: 0,
      daysCount: 0,
      sessionsCount: 0,
      todayLabel: null,
      todaySessions: null,
    };
  }

  const days = overview.days;
  const daysCount = days.length;

  let sessionsCount = 0;
  for (const d of days) sessionsCount += d.sessions?.length ?? 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = days.find((d) => d.date === todayStr) ?? days[0];

  return {
    horizonDays: overview.horizon_days ?? daysCount,
    daysCount,
    sessionsCount,
    todayLabel: todayDay?.date ?? null,
    todaySessions: todayDay?.sessions ?? [],
  };
}

export default function WidgetCoachDailyPlan({ onOpenDetail }: Props) {
  const { userId } = useUserId();

  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetDailyOverview(userId);
        if (alive) setOverview(r ?? null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Chyba pri načítaní daily plánu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ui = useMemo(() => buildUiState(overview), [overview]);

  const note = ui.daysCount
    ? t("coachDaily.widget.noteOK") + `${ui.daysCount}`
    : t("coachDaily.widget.noteMissing");

  return (
    <WidgetCard
      title={t("coachDaily.widget.title")}
      tooltip={t("coachDaily.widget.tooltip")}
      note={note}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {loading ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>
         {t("widget.errorLoad")}
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>
           {t("widget.missingserId")}
        </div>
      ) : !overview || !ui.daysCount ? (
        <div className={WIDGET_EMPTY_TEXT}>
          {t("coachDaily.widget.missingData")}
        </div>
      ) : (
        <>
          <div className={WIDGET_KV_GRID}>
            <div className={WIDGET_KV_LABEL}>{t("coachDaily.widget.sessionsCount")}</div>
            <div className={WIDGET_KV_VALUE}>{ui.daysCount}</div>

            <div className={WIDGET_KV_LABEL}>{t("coachDaily.widget.injuryRisk")}</div>
            <div className={WIDGET_KV_VALUE}>{ui.sessionsCount}</div>

            <div className={WIDGET_KV_LABEL}>{t("coachDaily.widget.todayLabel")}</div>
            <div className={[WIDGET_KV_VALUE, WIDGET_TRUNCATE].join(" ")}>
              {ui.todayLabel ?? "—"}
            </div>
          </div>

          {ui.todaySessions && ui.todaySessions.length > 0 && (
            <div className={WIDGET_SUMMARY_WRAP}>
              <div className={WIDGET_SUMMARY_HEAD}>
                :  {t("coachDaily.widget.summary")}
              </div>

              <ul className={WIDGET_LIST}>
                {ui.todaySessions.slice(0, 3).map((s, i) => (
                  <li key={i} className={WIDGET_LIST_ITEM}>
                    <span
                      className={WIDGET_BULLET}
                      style={{ background: appColors.brandPrimary }}
                    />
                    <span className={WIDGET_TRUNCATE}>
                      {s.title || s.session_type || s.sport}
                      {s.duration_min ? ` · ${s.duration_min} min` : ""}
                      {s.intensity ? ` · ${s.intensity}` : ""}
                    </span>
                  </li>
                ))}
              </ul>

              {ui.todaySessions.length > 3 && (
                <div className={WIDGET_MORE_HINT}>
                  + {ui.todaySessions.length - 3} {t("coachDaily.widget.todaySessions")}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}