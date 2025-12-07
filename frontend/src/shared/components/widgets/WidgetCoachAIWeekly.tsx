"use client";

import { useEffect, useMemo, useState } from "react";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
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

function formatDate(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function findCurrentWeek(weeks: WeeklyPlanWeek[]): WeeklyPlanWeek | null {
  if (!weeks.length) return null;
  const today = new Date();
  // normalizuj len na dátum
  today.setHours(0, 0, 0, 0);

  for (const w of weeks) {
    const start = toDateOrNull(w.week_start);
    const end = toDateOrNull(w.week_end);

    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      s.setHours(0, 0, 0, 0);
      e.setHours(0, 0, 0, 0);

      if (today >= s && today <= e) return w;
    }
  }

  // fallback – ak nič nesedí, zober week_index == 1 alebo prvý
  const byIndex1 = weeks.find((w) => w.week_index === 1);
  return byIndex1 ?? weeks[0];
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

  const firstStart = toDateOrNull(first.week_start);
  const lastEnd = toDateOrNull(last.week_end);

  let lastPlanRange: string | null = null;
  const firstStr = formatDate(firstStart);
  const lastStr = formatDate(lastEnd);
  if (firstStr && lastStr) {
    lastPlanRange = `${firstStr} – ${lastStr}`;
  } else if (firstStr) {
    lastPlanRange = firstStr;
  }

  const current = findCurrentWeek(weeks);

  const currentWeekLabel = current
    ? `Week ${current.week_index}`
    : null;

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

export default function WidgetCoachAIWeekly({ onOpenDetail }: Props) {
  const { user } = useCoachData() as any;
  const userId: number | null = user?.id ?? user?.user_id ?? null;

  const [plan, setPlan] = useState<WeeklyPlanLatest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiGetLatestWeeklyPlan(userId);
        if (!cancelled) {
          setPlan(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Nastala chyba pri načítaní weekly plánu.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ui = useMemo(() => buildUiState(plan), [plan]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            AI weekly plán
          </div>
          <div className="text-base font-semibold text-slate-50">
            Prehľad týždňov
          </div>
        </div>
        <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-200">
          AI
        </span>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2 text-sm animate-pulse">
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-full rounded bg-white/10" />
        </div>
      ) : error ? (
        <div className="mt-3 text-sm text-red-300">
          Nepodarilo sa načítať weekly plán.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="mt-3 text-sm text-slate-300">
          Chýba userId v CoachDataProvider – skontroluj, čo doň posielaš.
        </div>
      ) : !plan ? (
        <div className="mt-3 text-sm text-slate-300">
          Zatiaľ nemáš uložený AI weekly plán. Spusť generovanie plánu a
          widget sa automaticky naplní.
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Obdobie plánu</span>
              <span className="font-semibold text-slate-50">
                {ui.lastPlanRange ?? "—"}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Počet týždňov</span>
              <span className="font-semibold text-slate-50">
                {ui.weeksCount || "—"}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Aktuálny týždeň</span>
              <span className="font-semibold text-slate-50">
                {ui.currentWeekLabel ?? "—"}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Focus / fáza</span>
              <span className="font-semibold text-slate-50 truncate max-w-[9rem] text-right">
                {ui.currentWeekFocus || ui.currentWeekLoad || "—"}
              </span>
            </div>
          </div>

          {ui.currentWeekFocus && (
            <p className="mt-3 text-xs text-slate-400">
              Tento týždeň: {ui.currentWeekFocus}
              {ui.currentWeekLoad ? ` (${ui.currentWeekLoad})` : ""}
            </p>
          )}
        </>
      )}

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-900"
        >
          Otvoriť detail weekly plánu
        </button>
      )}
    </div>
  );
}