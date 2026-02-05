"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetDailyOverview,
  type DailyOverview,
  type DailyPlanDay,
} from "@/app/features/coach/api/coach_plan_daily";
import SessionCard, {
  type KPI,
  type PlanSession,
} from "@/app/shared/components/session/SessionCard";

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

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

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

/* ---------- tiny Card wrapper ---------- */

function Card({
  title,
  subtitle,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
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

      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        {children}
      </div>

      <div className={ACCORDION_FOOTER_BAR_MUTED} />
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

  /* ---------- derived FE state ---------- */

  const days = overview?.days ?? [];

  const planDates = useMemo(
    () => days.map((d) => d.date!).filter(Boolean),
    [days],
  );

  const dayCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const d of days) {
      out[d.date!] = d.sessions?.length ?? 0;
    }
    return out;
  }, [days]);

  /* ---------- local reschedule (FE only) ---------- */

  const moveSession = (
    fromDate: string,
    toDate: string,
    sessionIndex: number,
  ) => {
    setOverview((prev) => {
      if (!prev) return prev;

      const daysNext: DailyPlanDay[] = prev.days.map((d) => {
        if (d.date === fromDate) {
          const nextSessions = [...(d.sessions ?? [])];
          nextSessions.splice(sessionIndex, 1);
          return { ...d, sessions: nextSessions };
        }

        if (d.date === toDate) {
          const moved = prev.days
            .find((x) => x.date === fromDate)
            ?.sessions?.[sessionIndex];

          if (!moved) return d;

          return {
            ...d,
            sessions: [...(d.sessions ?? []), moved],
          };
        }

        return d;
      });

      return { ...prev, days: daysNext };
    });
  };

  /* ---------- states ---------- */

  if (!userId) {
    return (
      <Card title="AI Daily plan" subtitle="Chýba userId (useUserId).">
        <div className={PANEL_PREVIEW}>Skontroluj prihlásenie používateľa.</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <div className={[PANEL_PAD, "flex items-center gap-2"].join(" ")}>
          <LoadingSpinner size="button" />
          <div className={PANEL_PREVIEW}>Načítavam tvoj AI daily plán…</div>
        </div>
        <div className={ACCORDION_FOOTER_BAR_MUTED} />
      </section>
    );
  }

  if (error) {
    return (
      <Card title="AI Daily plan" subtitle="Nepodarilo sa načítať plán.">
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  /* ---------- UI ---------- */

  return (
    <div className={PANEL_STACK}>
      <Card
        title="AI Daily plan – detail"
        subtitle="Detail denného tréningového plánu. Presúvanie dní je lokálne (Save príde neskôr)."
      />

      <Card
        title="Denný rozpis tréningov"
        subtitle="Každá karta je jeden tréning. Môžeš zmeniť deň v rámci existujúceho plánu."
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

              return (
                <SessionCard
                  key={item.id}
                  variant="calendar"
                  item={item}
                  planReschedule={{
                    enabled: true,
                    dates: planDates,
                    dayCounts,
                    maxPerDay: 2,
                    onChangeDate: ({ fromDate, toDate }) =>
                      moveSession(fromDate, toDate, idx),
                  }}
                />
              );
            });
          })}
        </div>
      </Card>
    </div>
  );
}