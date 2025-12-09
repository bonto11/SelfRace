// src/shared/components/widgets/WidgetCoachWeeklyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
  type WeeklyPlanWeek,
} from "@/features/coach/api/coach_plan_weekly";

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

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

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
    (a, b) => (a.week_index || 0) - (b.week_index || 0),
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

  const accent =
    THEME?.chart?.linePrimary ??
    THEME?.chart?.lineSecondary ??
    THEME?.chart?.neutral ??
    "#F59E0B";

  return (
    <WidgetCard
      title="Coach — Weekly plan"
      note={
        ui.lastPlanRange
          ? `Rozsah plánu: ${ui.lastPlanRange}`
          : "Vygeneruj weekly plán cez AI."
      }
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-300">
          Nepodarilo sa načítať weekly plán.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="text-sm opacity-80">
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !plan ? (
        <div className="text-sm opacity-80">
          Zatiaľ nemáš uložený AI weekly plán. Spusť generovanie plánu a widget
          sa naplní.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <div className="opacity-75">Počet týždňov</div>
            <div className="font-semibold">{ui.weeksCount || "—"}</div>

            <div className="opacity-75">Aktuálny týždeň</div>
            <div className="font-semibold">
              {ui.currentWeekLabel ?? "—"}
            </div>

            <div className="opacity-75">Focus</div>
            <div className="font-semibold truncate">
              {ui.currentWeekFocus ?? "—"}
            </div>

            <div className="opacity-75">Fáza</div>
            <div className="font-semibold truncate">
              {ui.currentWeekLoad ?? "—"}
            </div>
          </div>

          {ui.currentWeekFocus && (
            <p className="mt-3 text-xs opacity-80">
              Tento týždeň: {ui.currentWeekFocus}
              {ui.currentWeekLoad ? ` (${ui.currentWeekLoad})` : ""}
            </p>
          )}
        </>
      )}
    </WidgetCard>
  );
}