"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD } from "@/app/shared/ui/tokens";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetDailyOverview,
  type DailyOverview,
  type DailyPlanDay,
} from "@/app/features/coach/api/coach_plan_daily";
import SessionCard, { type KPI, type PlanSession } from "@/app/shared/components/session/SessionCard";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  PANEL_GRID_3,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

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
  return d.toLocaleDateString(undefined, { weekday: "short" });
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

/* ---------- tiny Card wrapper (token-first) ---------- */

function Card({
  title,
  subtitle,
  children,
  footerTone = "muted",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footerTone?: "muted" | "accent";
}) {
  return (
    <section className={SURFACE_CARD}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title ? <div className={PANEL_SECTION_TITLE}>{title}</div> : null}
            {subtitle ? (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            ) : null}
          </div>
        </header>
      )}

      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>

      {footerTone === "accent" ? (
        <div className="h-1.5 rounded-b-2xl bg-emerald-500/80" />
      ) : (
        <div className={ACCORDION_FOOTER_BAR_MUTED} />
      )}
    </section>
  );
}

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
        if (alive) setError(e?.message ?? "Chyba pri načítaní AI daily plánu.");
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
    for (const d of days) sessionsCount += d.sessions?.length ?? 0;

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

  /* ---------- stavy ---------- */

  if (!userId) {
    return (
      <Card title="AI Daily plan" subtitle="Chýba userId (useUserId)." footerTone="muted">
        <div className={PANEL_PREVIEW}>
          Skontroluj prihlásenie používateľa.
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, "flex items-center gap-2"].join(" ")}>
          <LoadingSpinner size="button" />
          <div className={PANEL_PREVIEW}>Načítavam tvoj AI daily plán…</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <Card title="AI Daily plan" subtitle="Nepodarilo sa načítať plán." footerTone="muted">
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  /* ---------- UI ---------- */

  return (
    <div className={PANEL_STACK}>
      <Card
        title="AI Daily plan – detail"
        subtitle={
          <>
            Tu vidíš aktuálny tréningový plán podľa AI. Správa plánu (generovanie,
            spustenie, zrušenie, predĺženie) prebieha cez widget{" "}
            <strong>Coach — Plan</strong> na hlavnom coach dashboarde.
          </>
        }
        footerTone="accent"
      >
        {hasPlan ? (
          <div className={PANEL_GRID_3}>
            <div className={PANEL_INNER_STACK}>
              <div className={PANEL_SECTION_SUBTITLE}>Rozsah plánu</div>
              <div className={PANEL_SECTION_TITLE}>
                {startDateLabel && endDateLabel
                  ? `${startDateLabel} – ${endDateLabel}`
                  : "—"}
              </div>
            </div>

            <div className={PANEL_INNER_STACK}>
              <div className={PANEL_SECTION_SUBTITLE}>Počet dní / horizon</div>
              <div className={PANEL_SECTION_TITLE}>
                {daysCount} dní (horizon {horizonDays} d)
              </div>
            </div>

            <div className={PANEL_INNER_STACK}>
              <div className={PANEL_SECTION_SUBTITLE}>Počet tréningov</div>
              <div className={PANEL_SECTION_TITLE}>{sessionsCount}</div>
            </div>
          </div>
        ) : (
          <div className={PANEL_PREVIEW}>
            Zatiaľ nemáš žiadny aktívny AI daily plán uložený v DB. Vygeneruj ho
            a spusti cez widget <strong>Coach — Plan</strong>, potom sa tu zobrazí
            detail.
          </div>
        )}
      </Card>

      {hasPlan ? (
        <Card
          title="Denný rozpis tréningov"
          subtitle="Každá karta predstavuje jeden tréning z AI plánu – rovnaká Session card ako v kalendári."
          footerTone="muted"
        >
          <div className={PANEL_STACK}>
            {days.flatMap((d) => {
              if (!d.sessions || d.sessions.length === 0) return [];

              const dateIso = d.date ?? null;
              const dateLabel = formatDate(d.date) ?? d.date ?? "";
              const wd = weekdayLabel(d.date) ?? "";

              return d.sessions.map((s, idx) => {
                const kpis: KPI[] = [];

                if (s.duration_min) {
                  kpis.push({ label: "DURATION", value: `${s.duration_min} min` });
                }
                if (s.intensity) {
                  kpis.push({ label: "INTENSITY", value: String(s.intensity) });
                }
                if (s.zone_text) {
                  kpis.push({ label: "TARGET", value: String(s.zone_text) });
                }

                const item: PlanSession = {
                  id: `${d.date}-${idx}`,
                  kind: "plan",
                  status: "planned",
                  title: s.title || s.session_type || s.sport || "Tréning",
                  dateIso,
                  sport: s.sport || "other",
                  subtitle: `${dateLabel}${wd ? ` · ${wd.toUpperCase()}` : ""}`,
                  kpis,
                  notes: s.notes ?? null,

                  planDur: s.duration_min ? `${s.duration_min} min` : null,
                  planIntensity: s.intensity ?? null,
                  planTarget: s.zone_text ?? null,
                  planNotes: s.notes ?? null,

                  planRaw: s,
                  planStructure: s.structure ?? null,
                  planExercises: (s.structure?.strength_exercises as any[]) ?? [],
                };

                return <SessionCard key={item.id} variant="calendar" item={item} />;
              });
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}