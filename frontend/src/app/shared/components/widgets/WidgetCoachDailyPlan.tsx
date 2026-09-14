// src/app/features/coach/components/WidgetCoachDailyPlan.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { parseAndFormatPrettyDate } from "@/app/shared/utils/time";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

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

import type { PlanRow } from "@/app/shared/components/dataProviders/CoachDataProvider";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  daysCount: number;
  sessionsCount: number;
  todayLabel: string | null;
  todaySessions: PlanRow[] | null;
  isMedicalSuspend: boolean;
  maxInjurySeverity: number;
  hasAnyPlan: boolean;
};

function buildUiState(
  rows: PlanRow[],
  injurySeverity: number,
): UiState {
  const base: UiState = {
    daysCount: 0,
    sessionsCount: 0,
    todayLabel: null,
    todaySessions: null,
    isMedicalSuspend: injurySeverity >= 7,
    maxInjurySeverity: injurySeverity,
    hasAnyPlan: false,
  };

  if (!rows.length) {
    return base;
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // zoskup podľa dátumu, presne ako predtým robil DailyOverview.days
  const byDate = new Map<string, PlanRow[]>();
  for (const r of rows) {
    const d = String(r.plan_date).slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }

  let futureActiveDaysCount = 0;
  let futureSessionsCount = 0;

  for (const [date, sessions] of byDate.entries()) {
    if (date < todayStr) continue;

    const sessionCountForDay = sessions.length;
    if (sessionCountForDay > 0) {
      const hasRealWorkout = sessions.some(
        (s) => s.session_type?.toLowerCase() !== "rest",
      );
      if (hasRealWorkout) {
        futureActiveDaysCount++;
        futureSessionsCount += sessionCountForDay;
      }
    }
  }

  const todaySessions = byDate.get(todayStr) ?? [];

  return {
    ...base,
    hasAnyPlan: true,
    daysCount: futureActiveDaysCount,
    sessionsCount: futureSessionsCount,
    todayLabel: byDate.has(todayStr) ? todayStr : null,
    todaySessions,
  };
}

export default function WidgetCoachDailyPlan({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const t = useT();
  const { lang } = useSettings();

  // 🌟 FIX: dáta teraz idú z globálneho CoachDataProvider (plan.rows,
  // prefs.injuries) namiesto vlastného nezávislého fetchu - predtým
  // widget nikdy nereagoval na kliknutie na globálne refresh tlačidlo
  // (RefreshIconBtn -> refreshCoach), obnovil sa až po plnom relogu.
  const {
    plan: { rows: planRows, loading: planLoading },
    prefs,
    loading: coachLoading,
  } = useCoachData();

  const loading = coachLoading || planLoading;

  const injurySeverity = useMemo(() => {
    const injuries = prefs?.injuries;
    if (!Array.isArray(injuries) || injuries.length === 0) return 0;
    const maxInjury = injuries.reduce(
      (prev: any, current: any) =>
        (current.severity || 0) > (prev.severity || 0) ? current : prev,
      { severity: 0 },
    );
    return maxInjury?.severity > 0 ? maxInjury.severity : 0;
  }, [prefs?.injuries]);

  const activeInjury = useMemo(() => {
    const injuries = prefs?.injuries;
    if (!Array.isArray(injuries) || injuries.length === 0) return null;
    const maxInjury = injuries.reduce(
      (prev: any, current: any) =>
        (current.severity || 0) > (prev.severity || 0) ? current : prev,
      { severity: 0 },
    );
    if (!maxInjury || !(maxInjury.severity > 0)) return null;

    const areaKey = `prefs.sections.injuriesSection.areas.${maxInjury.area}`;
    const areaTrans = (t as any)(areaKey);
    const areaLabel = areaTrans === areaKey ? maxInjury.area : areaTrans;

    return {
      severity: maxInjury.severity,
      text: `${areaLabel} (${maxInjury.severity}/10)`,
    };
  }, [prefs?.injuries, t]);

  const ui = useMemo(
    () => buildUiState(planRows, injurySeverity),
    [planRows, injurySeverity],
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
              <AiUsageWarningBanner className="mb-2" />
              {t("coachDaily.widget.missingData")}
            </div>
          ) : (
            <>
              <div className={WIDGET_KV_GRID}>
                <div className={WIDGET_KV_LABEL}>
                  {t("coachDaily.widget.labelDays")}
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
