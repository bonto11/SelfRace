// src/app/features/coach/components/WidgetCoachDailyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { parseAndFormatPrettyDate } from "@/app/shared/utils/time";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

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

import { apiFetchUserPref } from "@/app/features/prefs/api/prefs";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  horizonDays: number;
  daysCount: number;
  sessionsCount: number;
  todayLabel: string | null;
  todaySessions: DailyPlanDay["sessions"] | null;
  isMedicalSuspend: boolean;
  maxInjurySeverity: number;
  hasAnyPlan: boolean;
};

function buildUiState(
  overview: DailyOverview | null,
  injurySeverity: number,
): UiState {
  const base = {
    horizonDays: 0,
    daysCount: 0,
    sessionsCount: 0,
    todayLabel: null,
    todaySessions: null,
    isMedicalSuspend: injurySeverity >= 7,
    maxInjurySeverity: injurySeverity,
    hasAnyPlan: false,
  };

  if (!overview || !overview.days?.length) {
    return base;
  }

  const days = overview.days;
  const todayStr = new Date().toISOString().slice(0, 10);

  let futureActiveDaysCount = 0;
  let futureSessionsCount = 0;

  for (const d of days) {
    if (d.date < todayStr) continue;

    const sessionCountForDay = d.sessions?.length ?? 0;
    if (sessionCountForDay > 0) {
      const hasRealWorkout = d.sessions!.some(
        (s) => s.session_type?.toLowerCase() !== "rest",
      );
      if (hasRealWorkout) {
        futureActiveDaysCount++;
        futureSessionsCount += sessionCountForDay;
      }
    }
  }

  const todayDay = days.find((d) => d.date === todayStr) ?? null;

  return {
    ...base,
    hasAnyPlan: true,
    horizonDays: overview.horizon_days ?? days.length,
    daysCount: futureActiveDaysCount,
    sessionsCount: futureSessionsCount,
    todayLabel: todayDay?.date ?? null,
    todaySessions: todayDay?.sessions ?? [],
  };
}

export default function WidgetCoachDailyPlan({ onOpenDetail }: Props) {
  // ✅ isChecking v akcii
  const { userId, isChecking } = useUserId();
  const t = useT();
  const { lang } = useSettings();

  const [overview, setOverview] = useState<DailyOverview | null>(null);

  const [injurySeverity, setInjurySeverity] = useState<number>(0);
  const [activeInjury, setActiveInjury] = useState<{
    severity: number;
    text: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ Nezaťažujeme backend predčasne
    if (!userId || isChecking) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [planRes, prefsRes] = await Promise.all([
          apiGetDailyOverview(userId).catch(() => null),
          apiFetchUserPref(userId, "coach.prefs").catch(() => null),
        ]);

        if (alive) {
          if (planRes) setOverview(planRes);

          if (
            prefsRes &&
            Array.isArray(prefsRes.injuries) &&
            prefsRes.injuries.length > 0
          ) {
            const maxInjury = prefsRes.injuries.reduce(
              (prev: any, current: any) => {
                return (current.severity || 0) > (prev.severity || 0)
                  ? current
                  : prev;
              },
              { severity: 0 },
            );

            if (maxInjury && maxInjury.severity > 0) {
              setInjurySeverity(maxInjury.severity);
              const areaKey = `prefs.sections.injuriesSection.areas.${maxInjury.area}`;
              const areaTrans = (t as any)(areaKey);
              const areaLabel = areaTrans === areaKey ? maxInjury.area : areaTrans;
              
              setActiveInjury({
                severity: maxInjury.severity,
                text: `${areaLabel} (${maxInjury.severity}/10)`,
              });
            } else {
              setInjurySeverity(0);
              setActiveInjury(null);
            }
          } else {
            setInjurySeverity(0);
            setActiveInjury(null);
          }
        }
      } catch (e: any) {
        if (alive) setError(t(e?.message as any) || t("coachDaily.widget.errorFetch" as any));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t, isChecking]); // ✅ Pridali sme dependency

  const ui = useMemo(
    () => buildUiState(overview, injurySeverity),
    [overview, injurySeverity],
  );

  return (
    <WidgetCard
      title={t("coachDaily.widget.title")}
      tooltip={t("coachDaily.widget.tooltip")}
      accent={ui.isMedicalSuspend ? "danger" : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {loading || isChecking ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>
          {t("widget.errorLoad")}
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>{t("widget.missingUserId")}</div>
      ) : (
        <>
          {activeInjury && (
            <div
              className={`mb-4 px-3 py-2 rounded-md border text-xs flex items-center gap-2 ${
                activeInjury.severity >= 7
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              }`}
            >
              <div className="flex-shrink-0 text-base">⚠️</div>
              <div className="leading-tight">
                <strong>{t("common.injury.reported")}</strong>{" "}
                {activeInjury.text}
                <div className="opacity-80 text-[10px] mt-0.5">
                  {activeInjury.severity >= 7
                    ? t("common.injury.dailyPlan")
                    : t("common.injury.planAdjusted")}
                </div>
              </div>
            </div>
          )}

          {!ui.hasAnyPlan ? (
            <div className={WIDGET_EMPTY_TEXT}>
              {t("coachDaily.widget.missingData")}
            </div>
          ) : (
            <>
              <div className={WIDGET_KV_GRID}>
                <div className={WIDGET_KV_LABEL}>
                  {t("coachDaily.widget.labelDays")} / {t("common.metrics.sessions") || "Jednotky"}
                </div>
                <div className={WIDGET_KV_VALUE}>
                  {ui.daysCount} / {ui.sessionsCount}
                </div>
              </div>

              {ui.todaySessions && ui.todaySessions.length > 0 && (
                <div className={WIDGET_SUMMARY_WRAP}>
                  <div className={WIDGET_SUMMARY_HEAD}>
                    {t("coachDaily.widget.summary")} 
                    {ui.todayLabel && ` (${parseAndFormatPrettyDate(ui.todayLabel, lang)})`}
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
                          {s.duration_min
                            ? ` · ${s.duration_min} ${t("common.units.min")}`
                            : ""}
                          {s.intensity ? ` · ${s.intensity}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {ui.todaySessions.length > 3 && (
                    <div className={WIDGET_MORE_HINT}>
                      + {ui.todaySessions.length - 3}{" "}
                      {t("coachDaily.widget.moreSessions")}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </WidgetCard>
  );
}
