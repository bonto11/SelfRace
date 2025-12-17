// src/features/coach/components/DetailDailyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/shared/ui/classes";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  apiGetDailyOverview,
  type DailyOverview,
  type DailyPlanDay,
} from "@/features/coach/api/coach_plan_daily";
import SessionCard, {
  type SessionCardItem,
} from "@/shared/components/SessionCard";

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

function describeTargets(t: any): string | null {
  if (!t) return null;
  const parts: string[] = [];

  if (t.pace_min_per_km) {
    parts.push(`tempo ${t.pace_min_per_km} min/km`);
  }

  if (Array.isArray(t.hr_bpm) && t.hr_bpm.length === 2) {
    const [lo, hi] = t.hr_bpm;
    if (lo && hi) parts.push(`TF ${lo}–${hi} bpm`);
  } else if (typeof t.hr_bpm === "number") {
    parts.push(`TF ${t.hr_bpm} bpm`);
  }

  if (typeof t.power_w === "number") {
    parts.push(`výkon ${t.power_w} W`);
  }

  return parts.length ? parts.join(" · ") : null;
}

function buildPlanItemFromDailySession(
  day: DailyPlanDay,
  s: DailyPlanDay["sessions"][number],
  index: number
): SessionCardItem {
  const sport = (s as any).sport || "other";
  const targetStr = describeTargets((s as any).targets);

  const kpis = [
    s.duration_min ? { label: "DURATION", value: `${s.duration_min} min` } : null,
    s.intensity ? { label: "INTENSITY", value: s.intensity } : null,
    targetStr ? { label: "TARGET", value: targetStr } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const structure = (s as any).structure ?? undefined;

  const item: SessionCardItem = {
    id: `${day.date ?? "day"}-${index}`,
    kind: "plan",
    title: s.title || s.session_type || s.sport || "Session",
    dateIso: day.date ?? null,
    sport,
    hideDateLine: true,
    subtitle: null,
    kpis,

    status: "planned",
    planDur: s.duration_min ? `${s.duration_min} min` : null,
    planIntensity: s.intensity ?? null,
    planTarget: targetStr,
    planNotes: s.notes ?? null,
    planRaw: s,
    planStructure: structure,
    planExercises: Array.isArray(structure?.strength_exercises)
      ? structure.strength_exercises
      : [],
  };

  return item;
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

  const { hasPlan, days, daysCount, sessionsCount, horizonDays, startDateLabel, endDateLabel } =
    view;

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
            (generovanie, spustenie, zrušenie, predĺženie) prebieha cez
            widget <strong>Coach — Plan</strong> na hlavnom coach
            dashboarde.
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
            Zatiaľ nemáš žiadny aktívny AI daily plán uložený v DB.
            Vygeneruj ho a spusti cez widget{" "}
            <strong>Coach — Plan</strong>, potom sa tu zobrazí detailný
            prehľad jednotlivých tréningov.
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
              Každý blok predstavuje jeden deň – pre každý tréning je
              použitá rovnaká Session card ako v kalendári.
            </p>
          </header>

          <div className="px-4 pb-4 space-y-3">
            {days.map((d) => {
              const dateLabel = formatDate(d.date) ?? d.date;
              const wdLabel = weekdayLabel(d.date);

              return (
                <div key={d.date} className={SURFACE_SUBCARD}>
                  <div className="px-3 pt-3 pb-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {dateLabel}
                        </span>
                        {wdLabel && (
                          <span className="text-xs text-slate-400 uppercase">
                            {wdLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {d.sessions && d.sessions.length > 0 ? (
                      <ul className="space-y-2">
                        {d.sessions.map((s, i) => {
                          const item = buildPlanItemFromDailySession(d, s, i);
                          return (
                            <li key={item.id}>
                              <SessionCard variant="plan" item={item} />
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Žiadny tréning – voľno alebo len veľmi ľahký pohyb.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-1.5 rounded-b-2xl bg-slate-700" />
        </section>
      )}
    </div>
  );
}