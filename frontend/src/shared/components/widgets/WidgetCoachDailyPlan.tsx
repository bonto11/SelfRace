// src/shared/components/widgets/WidgetCoachDailyPlan.tsx
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
  for (const d of days) {
    sessionsCount += d.sessions?.length ?? 0;
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

  let todayLabel: string | null = null;
  let todaySessions: DailyPlanDay["sessions"] | null = null;

  const todayDay = days.find((d) => d.date === todayStr);
  if (todayDay) {
    todayLabel = todayDay.date;
    todaySessions = todayDay.sessions ?? [];
  } else {
    todayLabel = days[0]?.date ?? null;
    todaySessions = days[0]?.sessions ?? [];
  }

  return {
    horizonDays: overview.horizon_days ?? daysCount,
    daysCount,
    sessionsCount,
    todayLabel,
    todaySessions,
  };
}

export default function WidgetCoachDailyPlan({ onOpenDetail }: Props) {
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
    THEME?.chart?.run ??
    THEME?.chart?.linePrimary ??
    THEME?.chart?.neutral ??
    "#22C55E";

  return (
    <WidgetCard
      title="Coach — Daily plan"
      note={
        ui.daysCount
          ? `Najbližších ${ui.daysCount} dní (horizon ${ui.horizonDays} d)`
          : "Vygeneruj daily plán (aspoň 1 týždeň) v coach sekcii."
      }
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
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
      ) : !overview || !ui.daysCount ? (
        <div className="text-sm opacity-80">
          Zatiaľ nemáš uložený AI daily plán. Po vygenerovaní prvého týždňa sa
          tu zobrazí prehľad najbližších dní.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <div className="opacity-75">Počet dní</div>
            <div className="font-semibold">{ui.daysCount}</div>

            <div className="opacity-75">Počet tréningov</div>
            <div className="font-semibold">{ui.sessionsCount}</div>

            <div className="opacity-75">Dnešok / najbližší deň</div>
            <div className="font-semibold truncate">
              {ui.todayLabel ?? "—"}
            </div>
          </div>

          {ui.todaySessions && ui.todaySessions.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="opacity-80 mb-1">
                Dnešný plán (skrátený prehľad):
              </div>
              <ul className="space-y-1">
                {ui.todaySessions.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="truncate">
                      {s.title || s.session_type || s.sport}
                      {s.duration_min
                        ? ` · ${s.duration_min} min`
                        : ""}
                      {s.intensity
                        ? ` · ${s.intensity}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {ui.todaySessions.length > 3 && (
                <div className="mt-1 text-[11px] opacity-70">
                  + {ui.todaySessions.length - 3} ďalších blokov…
                </div>
              )}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}