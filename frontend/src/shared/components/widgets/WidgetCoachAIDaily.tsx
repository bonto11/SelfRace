"use client";

import { useEffect, useMemo, useState } from "react";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import {
  apiGetDailyOverview,
  type DailyOverview,
  type DailyPlanDay,
} from "@/features/coach/api/coach_plan_daily";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  hasPlan: boolean;
  todayLabel: string | null;
  todaySessionsCount: number;
  todayMain: string | null;
  tomorrowLabel: string | null;
  tomorrowSessionsCount: number;
  horizonInfo: string | null; // napr. "Plán na 7 dní"
};

function toDateOnly(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return toDateOnly(d);
}

function findDay(days: DailyPlanDay[], offsetFromToday: number): DailyPlanDay | null {
  const today = toDateOnly(new Date());
  const target = new Date(today);
  target.setDate(today.getDate() + offsetFromToday);

  const targetMs = target.getTime();

  for (const d of days) {
    const dd = parseDate(d.date);
    if (!dd) continue;
    if (dd.getTime() === targetMs) return d;
  }
  return null;
}

function formatDate(dateStr: string | null | undefined): string | null {
  const d = parseDate(dateStr || null);
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildSessionHeadline(day: DailyPlanDay | null): string | null {
  if (!day || !day.sessions?.length) return null;
  const s = day.sessions[0];

  const pieces: string[] = [];

  if (s.sport) pieces.push(s.sport.toUpperCase());
  if (s.title) pieces.push(s.title);
  if (s.duration_min) pieces.push(`${Math.round(s.duration_min)} min`);
  if (s.intensity) pieces.push(s.intensity);
  if (s.zone_text) pieces.push(s.zone_text);

  if (!pieces.length) return null;
  return pieces.join(" · ");
}

function buildUiState(overview: DailyOverview | null): UiState {
  if (!overview || !overview.days?.length) {
    return {
      hasPlan: false,
      todayLabel: null,
      todaySessionsCount: 0,
      todayMain: null,
      tomorrowLabel: null,
      tomorrowSessionsCount: 0,
      horizonInfo: null,
    };
  }

  const daysSorted = [...overview.days].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const todayDay = findDay(daysSorted, 0);
  const tomorrowDay = findDay(daysSorted, 1);

  const todayLabel = todayDay ? "Dnes" : null;
  const tomorrowLabel = tomorrowDay ? "Zajtra" : null;

  const todaySessionsCount = todayDay?.sessions?.length ?? 0;
  const tomorrowSessionsCount = tomorrowDay?.sessions?.length ?? 0;

  const todayMain = buildSessionHeadline(todayDay);

  const horizonInfo =
    overview.horizon_days > 0
      ? `Plán na ${overview.horizon_days} dní`
      : null;

  return {
    hasPlan: true,
    todayLabel,
    todaySessionsCount,
    todayMain,
    tomorrowLabel,
    tomorrowSessionsCount,
    horizonInfo,
  };
}

export default function WidgetCoachAIDaily({ onOpenDetail }: Props) {
  const { user } = useCoachData() as any;
  const userId: number | null = user?.id ?? user?.user_id ?? null;

  const [overview, setOverview] = useState<DailyOverview | null>(null);
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
        const data = await apiGetDailyOverview(userId);
        if (!cancelled) {
          setOverview(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Nastala chyba pri načítaní daily plánu.");
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

  const ui = useMemo(() => buildUiState(overview), [overview]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            AI daily plán
          </div>
          <div className="text-base font-semibold text-slate-50">
            Dnešok &amp; zajtrajšok
          </div>
        </div>
        <span className="rounded-full border border-sky-400/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-sky-200">
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
          Nepodarilo sa načítať daily plán.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="mt-3 text-sm text-slate-300">
          Chýba userId v CoachDataProvider – skontroluj, čo doň posielaš.
        </div>
      ) : !ui.hasPlan ? (
        <div className="mt-3 text-sm text-slate-300">
          Zatiaľ nemáš uložený AI daily plán v najbližších dňoch. Vygeneruj
          daily týždeň a widget sa automaticky naplní.
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>{ui.todayLabel ?? "Dnes"}</span>
              <span className="font-semibold text-slate-50">
                {ui.todaySessionsCount
                  ? `${ui.todaySessionsCount} tréning${ui.todaySessionsCount > 1 ? "y" : ""}`
                  : "—"}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {ui.todayMain ?? "Žiadny plánovaný tréning na dnes."}
            </div>

            <div className="flex justify-between text-slate-300 pt-2 border-t border-white/5">
              <span>{ui.tomorrowLabel ?? "Zajtra"}</span>
              <span className="font-semibold text-slate-50">
                {ui.tomorrowSessionsCount
                  ? `${ui.tomorrowSessionsCount} tréning${ui.tomorrowSessionsCount > 1 ? "y" : ""}`
                  : "—"}
              </span>
            </div>
          </div>

          {ui.horizonInfo && (
            <p className="mt-3 text-xs text-slate-400">{ui.horizonInfo}</p>
          )}
        </>
      )}

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-900"
        >
          Otvoriť detail daily plánu
        </button>
      )}
    </div>
  );
}