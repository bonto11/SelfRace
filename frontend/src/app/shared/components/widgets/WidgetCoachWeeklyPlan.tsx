// src/app/features/coach/components/WidgetCoachWeeklyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import {
  WIDGET_CENTER_SPINNER,
  WIDGET_ERROR_BLOCK,
  WIDGET_ERROR_SUB,
  WIDGET_EMPTY_TEXT,
  WIDGET_INFO_GRID_SM,
  WIDGET_LABEL_MUTED_SM,
  WIDGET_VALUE_STRONG_SM,
} from "@/app/shared/ui/tokens";

import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
  type WeeklyPlanWeek,
} from "@/app/features/coach/api/coach_plan_weekly";
import { formatDate, toDate } from "@/app/shared/utils/time";

type Props = { onOpenDetail?: () => void; };

type SportRow = {
  label: string;
  actKm: number; planKm: number;
  actH: number; planH: number;
};

type UiState = {
  currentWeekLabel: string | null;
  currentWeekFocus: string | null;
  currentWeekLoad: string | null;
  lastPlanRange: string | null;
  sports: SportRow[];
};

function formatHours(mins: number) {
  return Math.round((mins / 60) * 10) / 10;
}

function findCurrentWeek(weeks: WeeklyPlanWeek[]): WeeklyPlanWeek | null {
  if (!weeks.length) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const w of weeks) {
    const start = toDate(w.week_start);
    const end = toDate(w.week_end);
    if (!start || !end) continue;
    const s = new Date(start); const e = new Date(end);
    s.setHours(0, 0, 0, 0); e.setHours(0, 0, 0, 0);
    if (today >= s && today <= e) return w;
  }
  return weeks.find((w) => w.week_index === 1) ?? weeks[0];
}

function buildUiState(plan: WeeklyPlanLatest | null, t: any): UiState {
  if (!plan || !plan.weeks?.length) {
    return { currentWeekLabel: null, currentWeekFocus: null, currentWeekLoad: null, lastPlanRange: null, sports: [] };
  }

  const weeks = [...plan.weeks].sort((a, b) => (a.week_index || 0) - (b.week_index || 0));
  const firstStr = formatDate(weeks[0].week_start);
  const lastStr = formatDate(weeks[weeks.length - 1].week_end);
  const lastPlanRange = firstStr && lastStr ? `${firstStr} – ${lastStr}` : firstStr;

  const current = findCurrentWeek(weeks);
  const currentWeekLabel = current ? `${current.week_index} / ${weeks.length}` : null;
  const currentWeekFocus = current?.focus ?? current?.goal ?? null;
  const currentWeekLoad = current?.load_phase ?? null;

  const ps = current?.planned_stats || {};
  const as = current?.actual_stats || {};

  const sports: SportRow[] = [];

  // BEH
  const runPKm = ps.run_distance_km || 0; const runAKm = as.run_distance_km || 0;
  const runPMin = ps.run_time_min || 0; const runAMin = as.run_time_min || 0;
  if (runPKm > 0 || runAKm > 0 || runPMin > 0 || runAMin > 0) {
    sports.push({ label: "Beh", actKm: runAKm, planKm: runPKm, actH: formatHours(runAMin), planH: formatHours(runPMin) });
  }

  // BIKE
  const bikePKm = ps.bike_distance_km || 0; const bikeAKm = as.bike_distance_km || 0;
  const bikePMin = ps.bike_time_min || 0; const bikeAMin = as.bike_time_min || 0;
  if (bikePKm > 0 || bikeAKm > 0 || bikePMin > 0 || bikeAMin > 0) {
    sports.push({ label: "Bicykel", actKm: bikeAKm, planKm: bikePKm, actH: formatHours(bikeAMin), planH: formatHours(bikePMin) });
  }

  // SWIM
  const swimPKm = (ps.swim_distance_m || 0) / 1000; const swimAKm = (as.swim_distance_m || 0) / 1000;
  const swimPMin = ps.swim_time_min || 0; const swimAMin = as.swim_time_min || 0;
  if (swimPKm > 0 || swimAKm > 0 || swimPMin > 0 || swimAMin > 0) {
    sports.push({ label: "Plávanie", actKm: swimAKm, planKm: swimPKm, actH: formatHours(swimAMin), planH: formatHours(swimPMin) });
  }

  return { currentWeekLabel, currentWeekFocus, currentWeekLoad, lastPlanRange, sports };
}

export default function WidgetCoachWeeklyPlan({ onOpenDetail }: Props) {
  const { userId } = useUserId();
  const t = useT();

  const [plan, setPlan] = useState<WeeklyPlanLatest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await apiGetLatestWeeklyPlan(userId);
        if (alive) setPlan(r ?? null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? t("coachWeekly.widget.errorFetch"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, t]);

  const ui = useMemo(() => buildUiState(plan, t), [plan, t]);

  const getPhaseLabel = (phaseStr?: string | null) => {
    if (!phaseStr) return "—";
    const safeKey = phaseStr.toLowerCase().replace(/ /g, "_");
    const key = `common.phases.${safeKey}`;
    const translated = (t as any)(key);
    return translated === key ? phaseStr : translated;
  };

  return (
    <WidgetCard
      title={t("coachWeekly.widget.title")}
      tooltip={t("coachWeekly.widget.tooltip")}
      accent="none"
      note={ui.lastPlanRange ? `${t("coachWeekly.widget.noteRange")} ${ui.lastPlanRange}` : t("coachWeekly.widget.noteMissing")}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading ? (
        <div className={WIDGET_CENTER_SPINNER}><LoadingSpinner size="widget" /></div>
      ) : error ? (
        <div className={WIDGET_ERROR_BLOCK}>{t("coachWeekly.widget.errorTitle")}<div className={WIDGET_ERROR_SUB}>{error}</div></div>
      ) : !userId ? (
        <div className={WIDGET_EMPTY_TEXT}>{t("widget.missingUserId")}</div>
      ) : !plan ? (
        <div className={WIDGET_EMPTY_TEXT}>{t("coachWeekly.widget.emptyText")}</div>
      ) : (
        <div className={WIDGET_INFO_GRID_SM}>
          <div className={WIDGET_LABEL_MUTED_SM}>{t("coachWeekly.widget.labelCurrentWeek")}</div>
          <div className={WIDGET_VALUE_STRONG_SM}>{ui.currentWeekLabel ?? "—"}</div>

          <div className={WIDGET_LABEL_MUTED_SM}>{t("coachWeekly.widget.labelFocus")}</div>
          <div className={`${WIDGET_VALUE_STRONG_SM} truncate`}>{ui.currentWeekFocus ?? "—"}</div>

          <div className={WIDGET_LABEL_MUTED_SM}>{t("coachWeekly.widget.labelPhase")}</div>
          <div className={`${WIDGET_VALUE_STRONG_SM} truncate`}>{getPhaseLabel(ui.currentWeekLoad)}</div>

          {/* Dynamické riadky pre športy */}
          {ui.sports.map((s, i) => (
             <div key={i} className="contents">
                <div className={WIDGET_LABEL_MUTED_SM}>{s.label}</div>
                <div className={WIDGET_VALUE_STRONG_SM}>
                  {s.planKm > 0 || s.actKm > 0 ? `${s.actKm}/${s.planKm} km` : ""}
                  {(s.planKm > 0 || s.actKm > 0) && (s.planH > 0 || s.actH > 0) ? " · " : ""}
                  {s.planH > 0 || s.actH > 0 ? `${s.actH}/${s.planH} h` : ""}
                </div>
             </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}