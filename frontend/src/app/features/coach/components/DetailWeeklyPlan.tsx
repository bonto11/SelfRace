"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/app/shared/ui/tokens";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
  type WeeklyPlanWeek,
} from "@/app/features/coach/api/coach_plan_weekly";
import { THEME } from "@/app/shared/theme/tokens";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  PANEL_GRID_3,
  PANEL_ACTIONS_INLINE,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

/* ---------- helpery ---------- */

type PhaseKey = "base" | "build" | "peak" | "recovery" | "other";

type WeeklyView = {
  weeksSorted: WeeklyPlanWeek[];
  rangeLabel: string | null;
  totalKm: number;
  totalMin: number;
  phaseCounts: Record<PhaseKey, number>;
  maxKm: number;
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

function phaseKey(load_phase?: string | null): PhaseKey {
  const l = (load_phase || "").toLowerCase();
  if (!l) return "other";
  if (l.startsWith("base")) return "base";
  if (l.startsWith("build")) return "build";
  if (l.startsWith("peak")) return "peak";
  if (l.startsWith("recovery") || l.startsWith("deload")) return "recovery";
  return "other";
}

function phaseColor(phase: PhaseKey): string {
  const chart = (THEME as any)?.chart ?? {};
  switch (phase) {
    case "base":
      return chart.base ?? chart.fitness ?? chart.run ?? "#10B981";
    case "build":
      return chart.build ?? chart.athletes ?? "#6366F1";
    case "peak":
      return chart.peak ?? chart.race ?? "#F59E0B";
    case "recovery":
      return chart.recovery ?? chart.fair ?? "#22C55E";
    default:
      return chart.neutral ?? "#64748B";
  }
}

function phaseLabel(phase: PhaseKey): string {
  const weekLabels = (THEME as any)?.weekLabels ?? {};
  switch (phase) {
    case "base":
      return weekLabels.base ?? "Base";
    case "build":
      return weekLabels.build ?? "Build";
    case "peak":
      return weekLabels.peak ?? "Peak";
    case "recovery":
      return weekLabels.recovery ?? "Recovery";
    default:
      return weekLabels.default ?? "Other";
  }
}

// (farby “semantic” – nechávam hardcoded, ale layout je token-first)
function phasePillClass(k: PhaseKey): string {
  switch (k) {
    case "base":
      return "bg-sky-900/60 text-sky-100 border border-sky-500/60";
    case "build":
      return "bg-violet-900/60 text-violet-100 border border-violet-500/60";
    case "peak":
      return "bg-emerald-900/60 text-emerald-100 border border-emerald-500/60";
    case "recovery":
      return "bg-amber-900/60 text-amber-100 border border-amber-500/60";
    default:
      return "bg-slate-800 text-slate-100 border border-slate-600";
  }
}

/* ---------- tiny Card wrapper (token-first) ---------- */

function Card({
  title,
  subtitle,
  children,
  footerTone = "muted",
  headRight,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footerTone?: "muted" | "accent";
  headRight?: React.ReactNode;
}) {
  return (
    <section className={SURFACE_CARD}>
      {(title || subtitle || headRight) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title ? <div className={PANEL_SECTION_TITLE}>{title}</div> : null}
            {subtitle ? (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            ) : null}
          </div>
          {headRight ? <div>{headRight}</div> : null}
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

export default function DetailWeeklyPlan() {
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

  const view = useMemo<WeeklyView>(() => {
    if (!plan || !plan.weeks?.length) {
      return {
        weeksSorted: [],
        rangeLabel: null,
        totalKm: 0,
        totalMin: 0,
        phaseCounts: { base: 0, build: 0, peak: 0, recovery: 0, other: 0 },
        maxKm: 0,
      };
    }

    const weeksSorted = [...plan.weeks].sort(
      (a, b) => (a.week_index || 0) - (b.week_index || 0)
    );

    const first = weeksSorted.find((w) => w.week_start) ?? weeksSorted[0];
    const last =
      [...weeksSorted].reverse().find((w) => w.week_end) ??
      weeksSorted[weeksSorted.length - 1];

    const firstStr = formatDate(first?.week_start);
    const lastStr = formatDate(last?.week_end);
    let rangeLabel: string | null = null;
    if (firstStr && lastStr) rangeLabel = `${firstStr} – ${lastStr}`;
    else if (firstStr) rangeLabel = firstStr;

    let totalKm = 0;
    let totalMin = 0;
    let maxKm = 0;

    const phaseCounts: Record<PhaseKey, number> = {
      base: 0,
      build: 0,
      peak: 0,
      recovery: 0,
      other: 0,
    };

    for (const w of weeksSorted) {
      const km = Number(w.planned_km || 0);
      const mins = Number(w.planned_minutes || 0);
      totalKm += km;
      totalMin += mins;
      if (km > maxKm) maxKm = km;

      const pk = phaseKey(w.load_phase);
      phaseCounts[pk] = (phaseCounts[pk] ?? 0) + 1;
    }

    return { weeksSorted, rangeLabel, totalKm, totalMin, phaseCounts, maxKm };
  }, [plan]);

  const { weeksSorted, rangeLabel, totalKm, totalMin, phaseCounts, maxKm } =
    view;

  /* ---------- stavy ---------- */

  if (!userId) {
    return (
      <Card
        title="Weekly plán"
        subtitle="Chýba userId (useUserId)."
        footerTone="muted"
      >
        <div className={PANEL_PREVIEW}>Skontroluj prihlásenie používateľa.</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, "grid place-items-center"].join(" ")}>
          <LoadingSpinner size="widget" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <Card
        title="Weekly plán"
        subtitle="Nepodarilo sa načítať weekly plán."
        footerTone="muted"
      >
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  if (!plan || !weeksSorted.length) {
    return (
      <Card
        title="Weekly plán"
        subtitle="Zatiaľ nemáš uložený weekly plán."
        footerTone="muted"
      >
        <div className={PANEL_PREVIEW}>
          Vygeneruj ho cez widget <strong>Coach — Plan</strong> (tlačidlo
          „Generate Weekly plan“), potom sa tu objaví rozpis týždňov.
        </div>
      </Card>
    );
  }

  const weeksCount = weeksSorted.length;
  const avgKm = weeksCount ? Math.round((totalKm / weeksCount) * 10) / 10 : 0;
  const totalHours = Math.round((totalMin / 60) * 10) / 10;
  const avgHours = weeksCount
    ? Math.round((totalHours / weeksCount) * 10) / 10
    : 0;

  /* ---------- UI ---------- */

  return (
    <div className={PANEL_STACK}>
      <Card
        title="Weekly plán – prehľad blokov"
        subtitle={
          <>
            Tento prehľad ukáže, ako AI rozdelila nasledujúce týždne – fázy,
            približný objem a cieľ každého týždňa.
            {rangeLabel ? (
              <span className="block">Rozsah plánu: {rangeLabel}</span>
            ) : null}
          </>
        }
        headRight={
          <div className={[PANEL_INNER_STACK, "text-right"].join(" ")}>
            <div className={PANEL_SECTION_SUBTITLE}>
              Počet týždňov: <span className="font-semibold">{weeksCount}</span>
            </div>
            <div className={PANEL_SECTION_SUBTITLE}>
              Celkový objem:{" "}
              <span className="font-semibold">
                ~{Math.round(totalKm)} km / {totalHours} h
              </span>
            </div>
            <div className={PANEL_SECTION_SUBTITLE}>
              Priemer:{" "}
              <span className="font-semibold">
                ~{avgKm} km / {avgHours} h
              </span>
            </div>
          </div>
        }
        footerTone="accent"
      >
        <div className={PANEL_ACTIONS_INLINE}>
          {(Object.keys(phaseCounts) as PhaseKey[])
            .filter((k) => phaseCounts[k] > 0)
            .map((k) => (
              <div
                key={k}
                className={[
                  "inline-flex items-center justify-between gap-2 rounded-full px-3 py-1 text-xs",
                  phasePillClass(k),
                ].join(" ")}
              >
                <span>{phaseLabel(k)}</span>
                <span className="font-semibold">{phaseCounts[k]}×</span>
              </div>
            ))}
        </div>
      </Card>

      <Card
        title="Rozpis týždňov"
        subtitle="Každý blok zobrazuje cieľ týždňa, plánovaný objem a krátke vysvetlenie. Dĺžka pruhu ~ km objemu."
        footerTone="muted"
      >
        <div className={PANEL_STACK}>
          {weeksSorted.map((w: WeeklyPlanWeek) => {
            const pk = phaseKey(w.load_phase);
            const km = Number(w.planned_km || 0);
            const mins = Number(w.planned_minutes || 0);
            const hours = mins ? Math.round((mins / 60) * 10) / 10 : null;

            const widthPct =
              maxKm > 0 ? Math.max(6, Math.min(100, (km / maxKm) * 100)) : 0;

            const weekRange = (() => {
              const s = formatDate(w.week_start);
              const e = formatDate(w.week_end);
              if (s && e) return `${s} – ${e}`;
              if (s) return s;
              return "bez dátumu";
            })();

            const barColor = phaseColor(pk);

            return (
              <div key={w.week_index} className={SURFACE_SUBCARD}>
                <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        Week {w.week_index}
                      </span>

                      <span
                        className={[
                          "px-2 py-0.5 rounded-full text-[11px] font-medium",
                          phasePillClass(pk),
                        ].join(" ")}
                      >
                        {w.load_phase || "phase ?"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400">{weekRange}</div>
                  </div>

                  <div className="text-sm font-semibold">
                    {w.goal || w.focus || "Bez konkrétneho cieľa"}
                  </div>

                  {w.focus ? (
                    <div className="text-xs text-slate-300">
                      Focus: {w.focus}
                    </div>
                  ) : null}

                  <div className={PANEL_INNER_STACK}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Plánovaný objem</span>
                      <span className="font-semibold">
                        {km ? `${km} km` : "—"}
                        {hours ? ` · ${hours} h` : ""}
                      </span>
                    </div>

                    <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>

                  {w.notes ? (
                    <div className="text-xs text-slate-300">{w.notes}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
