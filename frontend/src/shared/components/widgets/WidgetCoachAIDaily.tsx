// src/shared/components/widgets/WidgetCoachAIDaily.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
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
  horizonInfo: string | null;
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
  const { userId } = useUserId();

  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const accent =
    THEME?.chart?.linePrimary ??
    THEME?.chart?.lineSecondary ??
    THEME?.chart?.neutral ??
    "#0EA5E9";

  return (
    <WidgetCard
      title="Coach — Daily plan"
      note={ui.horizonInfo ?? "AI plán na dnešok a zajtrajšok."}
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
          Nepodarilo sa načítať daily plán.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="text-sm opacity-80">
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !ui.hasPlan ? (
        <div className="text-sm opacity-80">
          Zatiaľ nemáš uložený AI daily plán v najbližších dňoch. Vygeneruj
          daily týždeň a widget sa naplní.
        </div>
      ) : (
        <>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>{ui.todayLabel ?? "Dnes"}</span>
              <span className="font-semibold text-slate-50">
                {ui.todaySessionsCount
                  ? `${ui.todaySessionsCount} tréning${
                      ui.todaySessionsCount > 1 ? "y" : ""
                    }`
                  : "—"}
              </span>
            </div>
            <div className="text-xs opacity-80">
              {ui.todayMain ?? "Žiadny plánovaný tréning na dnes."}
            </div>

            <div className="flex justify-between text-slate-300 pt-2 border-t border-white/5">
              <span>{ui.tomorrowLabel ?? "Zajtra"}</span>
              <span className="font-semibold text-slate-50">
                {ui.tomorrowSessionsCount
                  ? `${ui.tomorrowSessionsCount} tréning${
                      ui.tomorrowSessionsCount > 1 ? "y" : ""
                    }`
                  : "—"}
              </span>
            </div>
          </div>

          {ui.horizonInfo && (
            <p className="mt-3 text-xs opacity-80">{ui.horizonInfo}</p>
          )}
        </>
      )}
    </WidgetCard>
  );
}