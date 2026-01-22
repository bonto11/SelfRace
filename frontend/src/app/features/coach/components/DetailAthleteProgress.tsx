"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/app/shared/ui/tokens";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteProgress,
  type AthleteProgressRecord,
} from "@/app/features/coach/api/coach_athlete_state";

/* ---------- helper typy ---------- */

type Parsed = {
  model: string | null;
  schemaVersion: number | null;

  headline: string | null;
  generatedAt: string | null;
  summaryBullets: string[];

  fatiguePrev: string | null;
  fatigueCurr: string | null;
  fatigueComment: string | null;

  injuryPrev: string | null;
  injuryCurr: string | null;
  injuryComment: string | null;

  blockPrev: string | null;
  blockCurr: string | null;
  blockComment: string | null;

  fitnessRunPrev: number | null;
  fitnessRunCurr: number | null;
  fitnessRunComment: string | null;

  fitnessRidePrev: number | null;
  fitnessRideCurr: number | null;
  fitnessRideComment: string | null;

  fitnessStrengthPrev: number | null;
  fitnessStrengthCurr: number | null;
  fitnessStrengthComment: string | null;

  volPrevMin: number | null;
  volPrevMax: number | null;
  volCurrMin: number | null;
  volCurrMax: number | null;
  volComment: string | null;

  planSoften: string | null;
  planWeekly: string | null;

  celebrations: string[];
  risksToWatch: string[];
  focusNextWeeks: string[];

  raw: any | null;
};

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

function slovakLevel(level?: string | null): string {
  const l = (level || "").toLowerCase();
  if (!l) return "—";
  if (l === "low") return "nízka";
  if (l === "moderate") return "stredná";
  if (l === "high") return "vysoká";
  return l;
}

function formatMinutesRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  const toHours = (v: number | null | undefined) =>
    typeof v === "number" ? Math.round(v / 60) : null;
  const hMin = toHours(min ?? null);
  const hMax = toHours(max ?? null);
  if (hMin != null && hMax != null) return `${hMin}–${hMax} h / týždeň`;
  if (hMin != null) return `${hMin} h / týždeň (min)`;
  if (hMax != null) return `${hMax} h / týždeň (max)`;
  return "—";
}

function parseProgress(row: AthleteProgressRecord | null): Parsed {
  // payload z DB je v stĺpci compare_previous → v API ho mapujeme na "report"
  const payload: any =
    (row as any)?.report ?? (row as any)?.compare_previous ?? null;

  if (!row || !payload) {
    return {
      model: null,
      schemaVersion: null,
      headline: null,
      generatedAt: null,
      summaryBullets: [],
      fatiguePrev: null,
      fatigueCurr: null,
      fatigueComment: null,
      injuryPrev: null,
      injuryCurr: null,
      injuryComment: null,
      blockPrev: null,
      blockCurr: null,
      blockComment: null,
      fitnessRunPrev: null,
      fitnessRunCurr: null,
      fitnessRunComment: null,
      fitnessRidePrev: null,
      fitnessRideCurr: null,
      fitnessRideComment: null,
      fitnessStrengthPrev: null,
      fitnessStrengthCurr: null,
      fitnessStrengthComment: null,
      volPrevMin: null,
      volPrevMax: null,
      volCurrMin: null,
      volCurrMax: null,
      volComment: null,
      planSoften: null,
      planWeekly: null,
      celebrations: [],
      risksToWatch: [],
      focusNextWeeks: [],
      raw: payload,
    };
  }

  const cp = payload;

  const model: string | null = cp.model || null;
  const schemaVersion: number | null =
    typeof cp.schema_version === "number" ? cp.schema_version : null;

  const headline: string | null = cp.summary?.headline || cp.headline || null;

  const summaryBullets: string[] =
    toStringArray(cp.summary?.bullets) || toStringArray(cp.summary_bullets);

  const comp = cp.comparisons || {};

  const fatigue = comp.fatigue_level || {};
  const injury = comp.injury_risk || {};
  const block = comp.block_kind || {};
  const planAdj = comp.plan_adjustment || {};
  const vol = comp.volume_tolerance || {};
  const fit = comp.fitness_level || {};
  const fitRun = fit.run || {};
  const fitRide = fit.ride || {};
  const fitStrength = fit.strength || {};

  let generatedAt: string | null = cp.generated_at || row.created_at || null;
  if (generatedAt) {
    try {
      const d = new Date(generatedAt);
      generatedAt = d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      // nechaj raw
    }
  }

  const celebrations = toStringArray(cp.recommendations?.celebrations);
  const risksToWatch = toStringArray(cp.recommendations?.risks_to_watch);
  const focusNextWeeks = toStringArray(cp.recommendations?.focus_next_weeks);

  return {
    model,
    schemaVersion,
    headline,
    generatedAt,
    summaryBullets,
    fatiguePrev: fatigue.previous || null,
    fatigueCurr: fatigue.current || null,
    fatigueComment: fatigue.comment || null,
    injuryPrev: injury.previous || null,
    injuryCurr: injury.current || null,
    injuryComment: injury.comment || null,
    blockPrev: block.previous || null,
    blockCurr: block.current || null,
    blockComment: block.comment || null,
    fitnessRunPrev:
      typeof fitRun.previous === "number" ? fitRun.previous : null,
    fitnessRunCurr: typeof fitRun.current === "number" ? fitRun.current : null,
    fitnessRunComment: fitRun.comment || null,
    fitnessRidePrev:
      typeof fitRide?.previous === "number" ? fitRide.previous : null,
    fitnessRideCurr:
      typeof fitRide?.current === "number" ? fitRide.current : null,
    fitnessRideComment: fitRide?.comment || null,
    fitnessStrengthPrev:
      typeof fitStrength.previous === "number" ? fitStrength.previous : null,
    fitnessStrengthCurr:
      typeof fitStrength.current === "number" ? fitStrength.current : null,
    fitnessStrengthComment: fitStrength.comment || null,
    volPrevMin:
      typeof vol.previous_weekly_minutes_min === "number"
        ? vol.previous_weekly_minutes_min
        : null,
    volPrevMax:
      typeof vol.previous_weekly_minutes_max === "number"
        ? vol.previous_weekly_minutes_max
        : null,
    volCurrMin:
      typeof vol.current_weekly_minutes_min === "number"
        ? vol.current_weekly_minutes_min
        : null,
    volCurrMax:
      typeof vol.current_weekly_minutes_max === "number"
        ? vol.current_weekly_minutes_max
        : null,
    volComment: vol.comment || null,
    planSoften: planAdj.soften_change || null,
    planWeekly: planAdj.weekly_replan_change || null,
    celebrations,
    risksToWatch,
    focusNextWeeks,
    raw: cp,
  };
}

export default function DetailAthleteProgress() {
  const { userId } = useUserId();
  const [row, setRow] = useState<AthleteProgressRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestAthleteProgress(userId);
        if (alive) setRow(r ?? null);
      } catch (e: any) {
        if (alive)
          setError(e?.message ?? "Chyba pri načítaní AI progress reportu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const parsed = useMemo(() => parseProgress(row), [row]);
  const p = parsed;

  if (!userId) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Chýba userId (useUserId). Skontroluj prihlásenie používateľa.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-8 grid place-items-center">
          <LoadingSpinner size="widget" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm text-red-300">
          Nepodarilo sa načítať AI progress report.
          <div className="mt-1 text-xs opacity-75">{error}</div>
        </div>
      </div>
    );
  }

  // žiadne dáta
  if (!row || !(row as any).report) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Zatiaľ nemáš žiadne uložené porovnanie analýz. Potrebujeme aspoň dve
          AI analýzy stavu (cron weekly refresh), potom sa tu zobrazí detail.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* HLAVNÝ PREHĽAD */}
      <section className={SURFACE_CARD}>
        <div className="px-4 pt-4 pb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Weekly progress – porovnanie posledných AI stavov
            </h2>
            {p.generatedAt && (
              <p className="text-xs text-slate-400 mt-1">
                Porovnanie vytvorené: {p.generatedAt}
              </p>
            )}
            {(p.model || p.schemaVersion) && (
              <p className="text-[11px] text-slate-500 mt-1">
                Model: {p.model ?? "—"}, schema v{p.schemaVersion ?? "?"}
              </p>
            )}
            {p.headline && (
              <p className="mt-2 text-sm text-slate-100">{p.headline}</p>
            )}
            {p.summaryBullets.length > 0 && (
              <ul className="mt-3 text-sm space-y-1 list-disc list-inside text-slate-100">
                {p.summaryBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="h-1.5 rounded-b-2xl bg-sky-500/80" />
      </section>

      {/* ÚNAVA / INJURY / BLOK */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Únava, riziko zranenia a tréningový blok
          </h3>
        </header>
        <div className="px-4 pb-4 grid gap-4 md:grid-cols-3 text-sm">
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <div className="text-xs text-slate-400 mb-1">Únava</div>
              <div className="font-semibold mb-1">
                {p.fatiguePrev || p.fatigueCurr
                  ? `${slovakLevel(p.fatiguePrev)} → ${slovakLevel(
                      p.fatigueCurr
                    )}`
                  : "—"}
              </div>
              {p.fatigueComment && (
                <p className="text-xs text-slate-300">{p.fatigueComment}</p>
              )}
            </div>
          </div>
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <div className="text-xs text-slate-400 mb-1">Riziko zranenia</div>
              <div className="font-semibold mb-1">
                {p.injuryPrev || p.injuryCurr
                  ? `${slovakLevel(p.injuryPrev)} → ${slovakLevel(
                      p.injuryCurr
                    )}`
                  : "—"}
              </div>
              {p.injuryComment && (
                <p className="text-xs text-slate-300">{p.injuryComment}</p>
              )}
            </div>
          </div>
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <div className="text-xs text-slate-400 mb-1">Odporúčaný blok</div>
              <div className="font-semibold mb-1">
                {p.blockPrev || p.blockCurr
                  ? `${p.blockPrev || "—"} → ${p.blockCurr || "—"}`
                  : "—"}
              </div>
              {p.blockComment && (
                <p className="text-xs text-slate-300">{p.blockComment}</p>
              )}
            </div>
          </div>
        </div>
        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* FITNESS LEVELS */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Fitness úroveň (1–10): predchádzajúca vs. aktuálna
          </h3>
        </header>
        <div className="px-4 pb-4 grid gap-4 md:grid-cols-3 text-sm">
          {[
            {
              label: "Beh",
              prev: p.fitnessRunPrev,
              curr: p.fitnessRunCurr,
              comment: p.fitnessRunComment,
            },
            {
              label: "Bicykel",
              prev: p.fitnessRidePrev,
              curr: p.fitnessRideCurr,
              comment: p.fitnessRideComment,
            },
            {
              label: "Sila",
              prev: p.fitnessStrengthPrev,
              curr: p.fitnessStrengthCurr,
              comment: p.fitnessStrengthComment,
            },
          ].map((row, idx) => (
            <div key={idx} className={SURFACE_SUBCARD}>
              <div className="px-3 pt-3 pb-3">
                <div className="text-xs text-slate-400 mb-1">{row.label}</div>
                <div className="font-semibold mb-1">
                  {row.prev != null || row.curr != null
                    ? `${row.prev ?? "—"}/10 → ${row.curr ?? "—"}/10`
                    : "—"}
                </div>
                {row.comment && (
                  <p className="text-xs text-slate-300">{row.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* OBJEM + PLAN ADJUSTMENT */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Tréningový objem a úpravy plánu
          </h3>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2 text-sm">
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3 space-y-2">
              <div className="text-xs text-slate-400">Týždenný objem (min)</div>
              <div className="font-semibold">
                {formatMinutesRange(p.volPrevMin, p.volPrevMax)} →{" "}
                {formatMinutesRange(p.volCurrMin, p.volCurrMax)}
              </div>
              {p.volComment && (
                <p className="text-xs text-slate-300">{p.volComment}</p>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3 space-y-2">
              <div className="text-xs text-slate-400">
                Zmeny v tréningovom pláne
              </div>
              {p.planSoften && (
                <p className="text-xs text-slate-300">{p.planSoften}</p>
              )}
              {p.planWeekly && (
                <p className="text-xs text-slate-300">{p.planWeekly}</p>
              )}
              {!p.planSoften && !p.planWeekly && (
                <p className="text-xs text-slate-400">
                  AI neodporúča meniť štruktúru plánu.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* RECOMMENDATIONS */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Odporúčania z posledného porovnania
          </h3>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-3 text-sm">
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">Čo osláviť</h4>
              {p.celebrations.length ? (
                <ul className="list-disc list-inside text-xs space-y-1 text-emerald-100">
                  {p.celebrations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Zatiaľ žiadne špecifické oslavy.
                </p>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">
                Riziká, ktoré sledovať
              </h4>
              {p.risksToWatch.length ? (
                <ul className="list-disc list-inside text-xs space-y-1 text-amber-100">
                  {p.risksToWatch.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Momentálne bez konkrétnych varovaní.
                </p>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">
                Fokus na najbližšie týždne
              </h4>
              {p.focusNextWeeks.length ? (
                <ul className="list-disc list-inside text-xs space-y-1 text-emerald-100">
                  {p.focusNextWeeks.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Po ďalších porovnaniach sem pribudnú konkrétne priority.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* RAW JSON (debug) */}
      <section className={SURFACE_CARD}>
        <div className="px-4 py-3">
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-300">
              Debug – raw JSON progress report
            </summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-900/80 p-3 text-[10px] leading-tight text-slate-100">
              {JSON.stringify(p.raw, null, 2)}
            </pre>
          </details>
        </div>
      </section>
    </div>
  );
}
