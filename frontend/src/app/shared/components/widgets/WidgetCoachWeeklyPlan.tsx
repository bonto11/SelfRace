// src/shared/components/widgets/WidgetCoachWeeklyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  WIDGET_CENTER_SPINNER,
  WIDGET_ERROR_BLOCK,
  WIDGET_ERROR_SUB,
  WIDGET_EMPTY_TEXT,
  WIDGET_INFO_GRID_SM,
  WIDGET_LABEL_MUTED_SM,
  WIDGET_VALUE_STRONG_SM,
  WIDGET_NOTE_P_SM,
} from "@/app/shared/theme/uiTokens";

import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
  type WeeklyPlanWeek,
} from "@/app/features/coach/api/coach_plan_weekly";
import { formatDate, toDate } from "@/app/shared/utils/time";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  weeksCount: number;
  currentWeekLabel: string | null;
  currentWeekFocus: string | null;
  currentWeekLoad: string | null;
  lastPlanRange: string | null;
};

function findCurrentWeek(weeks: WeeklyPlanWeek[]): WeeklyPlanWeek | null {
  if (!weeks.length) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const w of weeks) {
    const start = toDate(w.week_start);
    const end = toDate(w.week_end);
    if (!start || !end) continue;

    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);

    if (today >= s && today <= e) return w;
  }

  const idx1 = weeks.find((w) => w.week_index === 1);
  return idx1 ?? weeks[0];
}

function buildUiState(plan: WeeklyPlanLatest | null): UiState {
  if (!plan || !plan.weeks?.length) {
    return {
      weeksCount: 0,
      currentWeekLabel: null,
      currentWeekFocus: null,
      currentWeekLoad: null,
      lastPlanRange: null,
    };
  }

  const weeks = [...plan.weeks].sort(
    (a, b) => (a.week_index || 0) - (b.week_index || 0)
  );

  const first = weeks[0];
  const last = weeks[weeks.length - 1];

  const firstStr = formatDate(first.week_start);
  const lastStr = formatDate(last.week_end);
  let lastPlanRange: string | null = null;
  if (firstStr && lastStr) lastPlanRange = `${firstStr} – ${lastStr}`;
  else if (firstStr) lastPlanRange = firstStr;

  const current = findCurrentWeek(weeks);
  const currentWeekLabel = current ? `Week ${current.week_index}` : null;
  const currentWeekFocus = current?.focus ?? current?.goal ?? null;
  const currentWeekLoad = current?.load_phase ?? null;

  return {
    weeksCount: weeks.length,
    currentWeekLabel,
    currentWeekFocus,
    currentWeekLoad,
    lastPlanRange,
  };
}

export default function WidgetCoachWeeklyPlan({ onOpenDetail }: Props) {
  const { userId } = useUserId();

  const [plan, setPlan] = useState<WeeklyPlanLatest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestWeeklyPlan(userId);
        if (alive) setPlan(r ?? null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Chyba pri načítaní weekly plánu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ui = useMemo(() => buildUiState(plan), [plan]);

  // bez THEME + bez hardcoded hex
  const accent = appColors.brandPrimary;

  return (
    <WidgetCard
      title="Coach — Weekly plan"
      note={
        ui.lastPlanRange ? `Rozsah plánu: ${ui.lastPlanRange}` : "Vygeneruj weekly plán cez AI."
      }
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading ? (
        <div className={WIDGET_CENTER_SPINNER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_BLOCK}>
          Nepodarilo sa načítať weekly plán.
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_EMPTY_TEXT}>
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !plan ? (
        <div className={WIDGET_EMPTY_TEXT}>
          Zatiaľ nemáš uložený AI weekly plán. Spusť generovanie plánu a widget sa naplní.
        </div>
      ) : (
        <>
          <div className={WIDGET_INFO_GRID_SM}>
            <div className={WIDGET_LABEL_MUTED_SM}>Počet týždňov</div>
            <div className={WIDGET_VALUE_STRONG_SM}>{ui.weeksCount || "—"}</div>

            <div className={WIDGET_LABEL_MUTED_SM}>Aktuálny týždeň</div>
            <div className={WIDGET_VALUE_STRONG_SM}>{ui.currentWeekLabel ?? "—"}</div>

            <div className={WIDGET_LABEL_MUTED_SM}>Focus</div>
            <div className={`${WIDGET_VALUE_STRONG_SM} truncate`}>{ui.currentWeekFocus ?? "—"}</div>

            <div className={WIDGET_LABEL_MUTED_SM}>Fáza</div>
            <div className={`${WIDGET_VALUE_STRONG_SM} truncate`}>{ui.currentWeekLoad ?? "—"}</div>
          </div>

          {ui.currentWeekFocus && (
            <p className={WIDGET_NOTE_P_SM}>
              Tento týždeň: {ui.currentWeekFocus}
              {ui.currentWeekLoad ? ` (${ui.currentWeekLoad})` : ""}
            </p>
          )}
        </>
      )}
    </WidgetCard>
  );
}