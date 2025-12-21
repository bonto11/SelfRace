"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD } from "@/app/shared/ui/classes";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetDailyOverview,
  type DailyOverview,
  type DailyPlanDay,
} from "@/app/features/coach/api/coach_plan_daily";
import SessionCard, {
  type KPI,
  type PlanSession,
} from "@/app/shared/components/SessionCard";

/* ---------- helpers ---------- */

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

function weekdayLabel(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
  });
}

type ViewModel = {
  hasPlan: boolean;
  horizonDays: number;
  days: DailyPlanDay[];
  daysCount: number;
  sessionsCount: number;
  startDateLabel: string | null;
  endDateLabel: string | null;
};

/* ---------- hlavný komponent ---------- */

export default function DetailDailyPlan() {
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
        if (alive) {
          setError(e?.message ?? "Chyba pri načítaní AI daily plánu.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const view = useMemo<ViewModel>(() => {
    if (!overview || !overview.days || overview.days.length === 0) {
      return {
        hasPlan: false,
        horizonDays: 0,
        days: [],
        daysCount: 0,
        sessionsCount: 0,
        startDateLabel: null,
        endDateLabel: null,
      };
    }

    const days = overview.days;
    const daysCount = days.length;
    let sessionsCount = 0;
    for (const d of days) {
      sessionsCount += d.sessions?.length ?? 0;
    }

    const startDateLabel = formatDate(days[0]?.date);
    const endDateLabel = formatDate(days[days.length - 1]?.date);

    return {
      hasPlan: true,
      horizonDays: overview.horizon_days ?? daysCount,
      days,
      daysCount,
      sessionsCount,
      startDateLabel,
      endDateLabel,
    };
  }, [overview]);

  const {
    hasPlan,
    days,
    daysCount,
    sessionsCount,
    horizonDays,
    startDateLabel,
    endDateLabel,
  } = view;

  /* ---------- stavy bez usera / loading / error ---------- */

  if (!userId) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Chýba <code>userId</code> z <code>useUserId</code>. Skontroluj
          prihlásenie používateľa.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 flex items-center gap-2 text-sm">
          <LoadingSpinner size="button" />
          <span>Načítavam tvoj AI daily plán…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm text-red-300">
          Nepodarilo sa načítať AI daily plán.
          <div className="mt-1 text-xs opacity-75">{error}</div>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */

  return (
    <div className="space-y-4">
      {/* HLAVNÝ POPIS */}
      <section className={SURFACE_CARD}>
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            AI Daily plan – detail
          </h2>
          <p className="mt-1 text-xs text-slate-400 max-w-xl">
            Tu vidíš aktuálny tréningový plán podľa AI. Správa plánu
            (generovanie, spustenie, zrušenie, predĺženie) prebieha cez widget{" "}
            <strong>Coach — Plan</strong> na hlavnom coach dashboarde.
          </p>
        </div>

        {hasPlan && (
          <div className="px-4 pb-4 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs opacity-70">Rozsah plánu</div>
              <div className="font-semibold">
                {startDateLabel && endDateLabel
                  ? `${startDateLabel} – ${endDateLabel}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs opacity-70">Počet dní / horizon</div>
              <div className="font-semibold">
                {daysCount} dní (horizon {horizonDays} d)
              </div>
            </div>
            <div>
              <div className="text-xs opacity-70">Počet tréningov</div>
              <div className="font-semibold">{sessionsCount}</div>
            </div>
          </div>
        )}

        <div className="h-1.5 rounded-b-2xl bg-emerald-500/80" />
      </section>

      {!hasPlan && (
        <section className={SURFACE_CARD}>
          <div className="px-4 py-4 text-sm">
            Zatiaľ nemáš žiadny aktívny AI daily plán uložený v DB. Vygeneruj ho
            a spusti cez widget <strong>Coach — Plan</strong>, potom sa tu
            zobrazí detailný prehľad jednotlivých tréningov.
          </div>
        </section>
      )}

      {hasPlan && (
        <section className={SURFACE_CARD}>
          <header className="px-4 pt-4 pb-2">
            <h3 className="text-base font-semibold tracking-tight">
              Denný rozpis tréningov
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Každá karta predstavuje jeden tréning z AI plánu – používa sa
              rovnaká Session card ako v kalendári.
            </p>
          </header>

          <div className="px-4 pb-4 space-y-3">
            {days.map((d) => {
              const dateIso = d.date ?? null;
              const dateLabel = formatDate(d.date) ?? d.date;
              const wd = weekdayLabel(d.date) ?? "";

              if (!d.sessions || d.sessions.length === 0) {
                return null;
              }

              return d.sessions.map((s, idx) => {
                const kpis: KPI[] = [];
                if (s.duration_min) {
                  kpis.push({
                    label: "DURATION",
                    value: `${s.duration_min} min`,
                  });
                }
                if (s.intensity) {
                  kpis.push({
                    label: "INTENSITY",
                    value: String(s.intensity),
                  });
                }
                if (s.zone_text) {
                  kpis.push({
                    label: "TARGET",
                    value: String(s.zone_text),
                  });
                }

                const item: PlanSession = {
                  id: `${d.date}-${idx}`,
                  kind: "plan",
                  status: "planned",
                  title: s.title || s.session_type || s.sport || "Tréning",
                  dateIso,
                  sport: s.sport || "other",
                  subtitle: `${dateLabel ?? ""}${
                    wd ? ` · ${wd.toUpperCase()}` : ""
                  }`,
                  kpis,
                  notes: s.notes ?? null,
                  planDur: s.duration_min ? `${s.duration_min} min` : null,
                  planIntensity: s.intensity ?? null,
                  planTarget: s.zone_text ?? null,
                  planNotes: s.notes ?? null,
                  planRaw: s,
                  planStructure: s.structure ?? null,
                  planExercises:
                    (s.structure?.strength_exercises as any[]) ?? [],
                };

                return (
                  <SessionCard key={item.id} variant="calendar" item={item} />
                );
              });
            })}
          </div>

          <div className="h-1.5 rounded-b-2xl bg-slate-700" />
        </section>
      )}
    </div>
  );
}
