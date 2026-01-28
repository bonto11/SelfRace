"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
  type WeeklyPlanWeek,
} from "@/app/features/coach/api/coach_plan_weekly";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  PANEL_ACTIONS_INLINE,
  ACCORDION_FOOTER_BAR_MUTED,
  PANEL_BAR_TRACK,
  PANEL_BAR_FILL,
  PANEL_BAR_TRACK_STYLE,
  PANEL_PHASE_PILL_STYLE,
  PANEL_PHASE_BAR_STYLE,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
  SESSION_PILL,
} from "@/app/shared/ui/tokens/sessionCard";

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

function phaseLabel(phase: PhaseKey): string {
  switch (phase) {
    case "base":
      return "Base (budovanie základu)";
    case "build":
      return "Build (zvyšovanie intenzity)";
    case "peak":
      return "Peak (vrchol / preteky)";
    case "recovery":
      return "Recovery (regenerácia)";
    default:
      return "Iné / mix";
  }
}

/* ---------- tiny Card wrapper (token-first) ---------- */

function Card({
  title,
  subtitle,
  children,
  headRight,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  headRight?: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
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

      <div className={ACCORDION_FOOTER_BAR_MUTED} />
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
      (a, b) => (a.week_index || 0) - (b.week_index || 0),
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
      <Card title="Weekly plán" subtitle="Chýba userId (useUserId).">
        <div className={PANEL_PREVIEW}>Skontroluj prihlásenie používateľa.</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <div className={[PANEL_PAD, "grid place-items-center"].join(" ")}>
          <LoadingSpinner size="widget" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <Card title="Weekly plán" subtitle="Nepodarilo sa načítať weekly plán.">
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  if (!plan || !weeksSorted.length) {
    return (
      <Card title="Weekly plán" subtitle="Zatiaľ nemáš uložený weekly plán.">
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
      >
        <div className={PANEL_ACTIONS_INLINE}>
          {(Object.keys(phaseCounts) as PhaseKey[])
            .filter((k) => phaseCounts[k] > 0)
            .map((k) => (
              <div key={k} className={SESSION_PILL} style={PANEL_PHASE_PILL_STYLE[k]}>
                <span className="opacity-90">{phaseLabel(k)}</span>
                <span className="font-semibold tabular-nums">
                  {phaseCounts[k]}×
                </span>
              </div>
            ))}
        </div>
      </Card>

      <Card
        title="Rozpis týždňov"
        subtitle="Každý blok zobrazuje cieľ týždňa, plánovaný objem a krátke vysvetlenie. Dĺžka pruhu ~ km objemu."
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

            return (
              <div
                key={w.week_index}
                className={SESSION_SUBCARD}
                style={SESSION_SUBCARD_STYLE}
              >
                <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] uppercase tracking-wide opacity-70">
                        Week {w.week_index}
                      </span>

                      {/* pill MUST be styled via tokens -> different per phase */}
                      <span className={SESSION_PILL} style={PANEL_PHASE_PILL_STYLE[pk]}>
                        {w.load_phase || "phase ?"}
                      </span>
                    </div>

                    <div className={[PANEL_SECTION_SUBTITLE, "opacity-70"].join(" ")}>
                      {weekRange}
                    </div>
                  </div>

                  <div className="text-sm font-semibold">
                    {w.goal || w.focus || "Bez konkrétneho cieľa"}
                  </div>

                  {w.focus ? (
                    <div className={[PANEL_SECTION_SUBTITLE, "opacity-80"].join(" ")}>
                      Focus: {w.focus}
                    </div>
                  ) : null}

                  <div className={PANEL_INNER_STACK}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-70">Plánovaný objem</span>
                      <span className="font-semibold tabular-nums">
                        {km ? `${km} km` : "—"}
                        {hours ? ` · ${hours} h` : ""}
                      </span>
                    </div>

                    <div className={PANEL_BAR_TRACK} style={PANEL_BAR_TRACK_STYLE}>
                      <div
                        className={PANEL_BAR_FILL}
                        style={{
                          ...PANEL_PHASE_BAR_STYLE[pk],
                          width: `${widthPct}%`,
                        }}
                      />
                    </div>
                  </div>

                  {w.notes ? (
                    <div className={[PANEL_SECTION_SUBTITLE, "opacity-85"].join(" ")}>
                      {w.notes}
                    </div>
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