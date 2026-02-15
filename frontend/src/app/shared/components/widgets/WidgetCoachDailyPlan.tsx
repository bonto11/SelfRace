"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

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

import { apiFetchUserPref } from "@/app/features/prefs/api/prefs"; // ✅ Potrebujeme na kontrolu zranení

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  horizonDays: number;
  daysCount: number;
  sessionsCount: number;
  todayLabel: string | null;
  todaySessions: DailyPlanDay["sessions"] | null;
  // ✅ Nové stavy pre zranenie
  isMedicalSuspend: boolean;
  maxInjurySeverity: number;
};

function buildUiState(overview: DailyOverview | null, injurySeverity: number): UiState {
  const base = {
    horizonDays: 0,
    daysCount: 0,
    sessionsCount: 0,
    todayLabel: null,
    todaySessions: null,
    isMedicalSuspend: injurySeverity >= 7,
    maxInjurySeverity: injurySeverity,
  };

  if (!overview || !overview.days?.length) {
    return base;
  }

  const days = overview.days;
  const daysCount = days.length;

  let sessionsCount = 0;
  for (const d of days) sessionsCount += d.sessions?.length ?? 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = days.find((d) => d.date === todayStr) ?? days[0];

  return {
    ...base,
    horizonDays: overview.horizon_days ?? daysCount,
    daysCount,
    sessionsCount,
    todayLabel: todayDay?.date ?? null,
    todaySessions: todayDay?.sessions ?? [],
  };
}

export default function WidgetCoachDailyPlan({ onOpenDetail }: Props) {
  const { userId } = useUserId();
  const t = useT();

  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [injurySeverity, setInjurySeverity] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Stiahneme prehľad plánu
        const r = await apiGetDailyOverview(userId);
        
        // 2. Skontrolujeme zranenia v prefs
        const prefs = await apiFetchUserPref(userId, "coach.prefs");
        let maxSev = 0;
        if (prefs && Array.isArray(prefs.injuries)) {
          maxSev = Math.max(...prefs.injuries.map((i: any) => i.severity || 0), 0);
        }

        if (alive) {
          setOverview(r ?? null);
          setInjurySeverity(maxSev);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? t("coachDaily.widget.errorFetch"));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t]);

  const ui = useMemo(() => buildUiState(overview, injurySeverity), [overview, injurySeverity]);

  const note = ui.isMedicalSuspend 
    ? t("coachDaily.widget.medicalTitle")
    : ui.daysCount
      ? `${t("coachDaily.widget.noteOK")} ${ui.daysCount}`
      : t("coachDaily.widget.noteMissing");

  return (
    <WidgetCard
      title={t("coachDaily.widget.title")}
      tooltip={t("coachDaily.widget.tooltip")}
      note={note}
      accent={ui.isMedicalSuspend ? "danger" : "none"} // ✅ Červený akcent pri zranení
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
          {t("widget.missingUserId")}
        </div>
      ) : ui.isMedicalSuspend ? (
        /* ✅ MEDICAL SUSPEND UI */
        <div className="flex flex-col items-center justify-center text-center px-2 py-4 h-full">
          <div className="text-2xl mb-2">🚑</div>
          <div className="text-sm font-bold text-red-400 mb-1">
            {t("coachDaily.widget.medicalTitle")}
          </div>
          <div className="text-[11px] opacity-70 leading-relaxed mb-3">
            {t("coachDaily.widget.medicalText").replace("{{severity}}", String(ui.maxInjurySeverity))}
          </div>
          <div className="text-[10px] italic opacity-50 border-t border-white/5 pt-2">
            {t("coachDaily.widget.medicalAction")}
          </div>
        </div>
      ) : !overview || !ui.daysCount ? (
        <div className={WIDGET_EMPTY_TEXT}>
          {t("coachDaily.widget.missingData")}
        </div>
      ) : (
        /* ŠTANDARDNÉ UI PLÁNU */
        <>
          <div className={WIDGET_KV_GRID}>
            <div className={WIDGET_KV_LABEL}>{t("coachDaily.widget.labelDays")}</div>
            <div className={WIDGET_KV_VALUE}>{ui.daysCount}</div>

            <div className={WIDGET_KV_LABEL}>{t("coachDaily.widget.labelSessions")}</div>
            <div className={WIDGET_KV_VALUE}>{ui.sessionsCount}</div>

            <div className={WIDGET_KV_LABEL}>{t("coachDaily.widget.todayLabel")}</div>
            <div className={[WIDGET_KV_VALUE, WIDGET_TRUNCATE].join(" ")}>
              {ui.todayLabel ?? "—"}
            </div>
          </div>

          {ui.todaySessions && ui.todaySessions.length > 0 && (
            <div className={WIDGET_SUMMARY_WRAP}>
              <div className={WIDGET_SUMMARY_HEAD}>
                {t("coachDaily.widget.summary")}
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
                      {s.duration_min ? ` · ${s.duration_min} ${t("common.units.min")}` : ""}
                      {s.intensity ? ` · ${s.intensity}` : ""}
                    </span>
                  </li>
                ))}
              </ul>

              {ui.todaySessions.length > 3 && (
                <div className={WIDGET_MORE_HINT}>
                  + {ui.todaySessions.length - 3} {t("coachDaily.widget.moreSessions")}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}