// src/app/features/coach/components/DetailAthleteProgress.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteProgress,
  type AthleteProgressRecord,
} from "@/app/features/coach/api/coach_athlete_state";
import { useT } from "@/app/shared/i18n/useT";

// ✅ Import pre ukladanie metrík
import { apiSaveMetrics } from "@/app/features/profile/api/metrics";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_GRID_3,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

/* ---------- helpers ---------- */

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
  vo2maxEstimate: number | null; // ✅ Pridané pre VO2Max
  raw: any | null;
};

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

function slovakLevel(level: string | null, t: any): string {
  const l = (level || "").toLowerCase();
  if (!l) return "—";
  if (l === "low") return t("common.levels.low");
  if (l === "moderate") return t("common.levels.moderate");
  if (l === "high") return t("common.levels.high");
  return l;
}

// ✅ Nová funkcia na preklad FÁZY TRÉNINGU (z katalógu coach.weekly.phases)
function translatePhase(phase: string | null, t: any): string {
  const p = (phase || "").toLowerCase();
  if (!p) return "—";
  const key = `common.phases.${p}`;
  const translated = t(key);
  // TypeScript fix: phase môže byť null, tak mu dáme fallback na string
  return translated === key ? (phase || "—") : translated;
}

function formatMinutesRange(min: number | null | undefined, max: number | null | undefined, t: any): string {
  if (!min && !max) return "—";
  const toHours = (v: number | null | undefined) =>
    typeof v === "number" ? Math.round(v / 60) : null;
  const hMin = toHours(min);
  const hMax = toHours(max);
  const unit = t("common.units.hPerWeek");
  if (hMin != null && hMax != null) return `${hMin}–${hMax} ${unit}`;
  if (hMin != null) return `${hMin} ${unit} (min)`;
  if (hMax != null) return `${hMax} ${unit} (max)`;
  return "—";
}

function parseProgress(row: AthleteProgressRecord | null): Parsed {
  const payload: any = (row as any)?.report ?? (row as any)?.compare_previous ?? null;

  if (!row || !payload) {
    return {
      model: null, schemaVersion: null, headline: null, generatedAt: null, summaryBullets: [],
      fatiguePrev: null, fatigueCurr: null, fatigueComment: null,
      injuryPrev: null, injuryCurr: null, injuryComment: null,
      blockPrev: null, blockCurr: null, blockComment: null,
      fitnessRunPrev: null, fitnessRunCurr: null, fitnessRunComment: null,
      fitnessRidePrev: null, fitnessRideCurr: null, fitnessRideComment: null,
      fitnessStrengthPrev: null, fitnessStrengthCurr: null, fitnessStrengthComment: null,
      volPrevMin: null, volPrevMax: null, volCurrMin: null, volCurrMax: null, volComment: null,
      planSoften: null, planWeekly: null, celebrations: [], risksToWatch: [], focusNextWeeks: [],
      vo2maxEstimate: null,
      raw: payload,
    };
  }

  const cp = payload;
  const comp = cp.comparisons || {};
  const fatigue = comp.fatigue_level || {};
  const injury = comp.injury_risk || {};
  const block = comp.block_kind || {};
  const planAdj = comp.plan_adjustment || {};
  const vol = comp.volume_tolerance || {};
  const fit = comp.fitness_level || {};

  let generatedAt: string | null = cp.generated_at || row.created_at || null;
  if (generatedAt) {
    try {
      const d = new Date(generatedAt);
      generatedAt = d.toLocaleString("sk-SK", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    } catch { /* fallback */ }
  }

  // ✅ Vyhľadávanie VO2Max z rôznych miest v JSONe
  let vo2max = null;
  if (typeof comp.vo2max?.current === "number") vo2max = comp.vo2max.current;
  else if (typeof cp.vo2max_estimate === "number") vo2max = cp.vo2max_estimate;
  else if (typeof fit.vo2max_estimate === "number") vo2max = fit.vo2max_estimate;

  return {
    model: cp.model || null,
    schemaVersion: typeof cp.schema_version === "number" ? cp.schema_version : null,
    headline: cp.summary?.headline || cp.headline || null,
    generatedAt,
    summaryBullets: toStringArray(cp.summary?.bullets) || toStringArray(cp.summary_bullets),
    fatiguePrev: fatigue.previous || null,
    fatigueCurr: fatigue.current || null,
    fatigueComment: fatigue.comment || null,
    injuryPrev: injury.previous || null,
    injuryCurr: injury.current || null,
    injuryComment: injury.comment || null,
    blockPrev: block.previous || null,
    blockCurr: block.current || null,
    blockComment: block.comment || null,
    fitnessRunPrev: typeof fit.run?.previous === "number" ? fit.run.previous : null,
    fitnessRunCurr: typeof fit.run?.current === "number" ? fit.run.current : null,
    fitnessRunComment: fit.run?.comment || null,
    fitnessRidePrev: typeof fit.ride?.previous === "number" ? fit.ride.previous : null,
    fitnessRideCurr: typeof fit.ride?.current === "number" ? fit.ride.current : null,
    fitnessRideComment: fit.ride?.comment || null,
    fitnessStrengthPrev: typeof fit.strength?.previous === "number" ? fit.strength.previous : null,
    fitnessStrengthCurr: typeof fit.strength?.current === "number" ? fit.strength.current : null,
    fitnessStrengthComment: fit.strength?.comment || null,
    volPrevMin: vol.previous_weekly_minutes_min,
    volPrevMax: vol.previous_weekly_minutes_max,
    volCurrMin: vol.current_weekly_minutes_min,
    volCurrMax: vol.current_weekly_minutes_max,
    volComment: vol.comment || null,
    planSoften: planAdj.soften_change || null,
    planWeekly: planAdj.weekly_replan_change || null,
    celebrations: toStringArray(cp.recommendations?.celebrations),
    risksToWatch: toStringArray(cp.recommendations?.risks_to_watch),
    focusNextWeeks: toStringArray(cp.recommendations?.focus_next_weeks),
    vo2maxEstimate: vo2max, // ✅
    raw: cp,
  };
}

/* ---------- building blocks ---------- */

function Card({ title, subtitle, children, footer = true }: { title?: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: boolean; }) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>}
          </div>
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      {footer && <div className={ACCORDION_FOOTER_BAR_MUTED} />}
    </section>
  );
}

function Subcard({ title, value, text }: { title: string; value: React.ReactNode; text?: React.ReactNode; }) {
  return (
    <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_SECTION_SUBTITLE}>{title}</div>
        <div className={PANEL_SECTION_TITLE}>{value}</div>
        {text && <div className={PANEL_SECTION_SUBTITLE}>{text}</div>}
      </div>
    </div>
  );
}

export default function DetailAthleteProgress() {
  const { userId } = useUserId();
  const t = useT();
  const [row, setRow] = useState<AthleteProgressRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Udržujeme stav, aby sa VO2Max neukladal pri každom re-rendri komponentu
  const [vo2maxSaved, setVo2maxSaved] = useState(false);

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
        if (alive) setError(t(e?.message as any) || t("coach.progress.errorLoad"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, t]);

  const p = useMemo(() => parseProgress(row), [row]);

  // ✅ Automatické uloženie VO2Max_estimated
  useEffect(() => {
    if (userId && p.vo2maxEstimate && !vo2maxSaved) {
      console.log(`[Progress] Zistený nový odhad VO2Max od AI: ${p.vo2maxEstimate}. Odosielam na server...`);
      
      apiSaveMetrics(userId, [{
        metric: "VO2Max_estimated",
        value_num: p.vo2maxEstimate,
        unit: "ml/kg/min", // Hardcoded alebo zober t("common.units.vo2max") ak chceš
        measured_at: new Date().toISOString(),
        source: "system", // Zmenené z "user" na "system", keďže je to odhad AI
      }]).then(() => {
        setVo2maxSaved(true);
        console.log(`[Progress] VO2Max úspešne uložený do profilu.`);
      }).catch(err => {
        console.warn(`[Progress] Uloženie VO2Max zlyhalo:`, err);
      });
    }
  }, [userId, p.vo2maxEstimate, vo2maxSaved]);

  if (!userId) {
    return (
      <Card title={t("coach.progress.title")} subtitle={t("common.errors.missingUserAuth")}>
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <div className={[PANEL_PAD, "grid place-items-center"].join(" ")}>
          <LoadingSpinner size="widget" />
        </div>
        <div className={ACCORDION_FOOTER_BAR_MUTED} />
      </section>
    );
  }

  if (error || !row || !(row as any).report) {
    return (
      <Card title={t("coach.progress.title")} subtitle={t("coach.progress.noDataTitle")}>
        <div className={PANEL_PREVIEW}>{error ?? t("coach.progress.noDataDesc")}</div>
      </Card>
    );
  }

  return (
    <div className={PANEL_STACK}>
      <Card
        title={t("coach.progress.summaryTitle")}
        subtitle={[
          p.generatedAt ? `${t("coach.progress.createdAt")}: ${p.generatedAt}` : null,
        ].filter(Boolean).join(" · ")}
      >
        {p.headline && <div className={PANEL_PREVIEW}>{p.headline}</div>}
        {p.summaryBullets.length > 0 && (
          <ul className="list-disc list-inside text-sm space-y-1">
            {p.summaryBullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </Card>

      <Card title={t("coach.progress.indicatorsTitle")}>
        <div className={PANEL_GRID_3}>
          <Subcard
            title={t("coachAthleteState.lastAnalysis.fatigue")}
            value={`${slovakLevel(p.fatiguePrev, t)} → ${slovakLevel(p.fatigueCurr, t)}`}
            text={p.fatigueComment || undefined}
          />
          <Subcard
            title={t("coachAthleteState.lastAnalysis.injuryRisk")}
            value={`${slovakLevel(p.injuryPrev, t)} → ${slovakLevel(p.injuryCurr, t)}`}
            text={p.injuryComment || undefined}
          />
          <Subcard
            title={t("coach.progress.blockTitle")}
            // ✅ Použitý bezpečný preklad fáz
            value={`${translatePhase(p.blockPrev, t)} → ${translatePhase(p.blockCurr, t)}`}
            text={p.blockComment || undefined}
          />
        </div>
      </Card>

      <Card title={t("coach.progress.fitnessTitle")}>
        <div className={PANEL_GRID_3}>
          {[
            { label: t("common.sports.run"), prev: p.fitnessRunPrev, curr: p.fitnessRunCurr, comment: p.fitnessRunComment },
            { label: t("common.sports.bike"), prev: p.fitnessRidePrev, curr: p.fitnessRideCurr, comment: p.fitnessRideComment },
            { label: t("common.sports.strength"), prev: p.fitnessStrengthPrev, curr: p.fitnessStrengthCurr, comment: p.fitnessStrengthComment },
          ].map((r) => (
            <Subcard
              key={r.label}
              title={r.label}
              value={r.prev != null || r.curr != null ? `${r.prev ?? "—"} → ${r.curr ?? "—"}` : "—"}
              text={r.comment || undefined}
            />
          ))}
        </div>
      </Card>

      <Card title={t("coach.progress.volumeTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Subcard
            title={t("coach.state.weeklyVolume")}
            value={`${formatMinutesRange(p.volPrevMin, p.volPrevMax, t)} → ${formatMinutesRange(p.volCurrMin, p.volCurrMax, t)}`}
            text={p.volComment || undefined}
          />
          <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_SUBTITLE}>{t("coach.progress.planChanges")}</div>
              {p.planSoften || p.planWeekly ? (
                <div className="space-y-2">
                   {p.planSoften && <div className={PANEL_PREVIEW}>{p.planSoften}</div>}
                   {p.planWeekly && <div className={PANEL_PREVIEW}>{p.planWeekly}</div>}
                </div>
              ) : (
                <div className={PANEL_PREVIEW}>{t("coach.progress.noPlanChanges")}</div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title={t("coach.progress.recsTitle")}>
        <div className={PANEL_GRID_3}>
          <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>{t("coach.progress.celebrate")}</div>
              {p.celebrations.length ? (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {p.celebrations.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              ) : <div className={PANEL_PREVIEW}>{t("coach.progress.noCelebrate")}</div>}
            </div>
          </div>
          <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>{t("coach.progress.risks")}</div>
              {p.risksToWatch.length ? (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {p.risksToWatch.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              ) : <div className={PANEL_PREVIEW}>{t("coach.progress.noRisks")}</div>}
            </div>
          </div>
          <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>{t("coach.progress.focus")}</div>
              {p.focusNextWeeks.length ? (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {p.focusNextWeeks.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              ) : <div className={PANEL_PREVIEW}>{t("coach.progress.noFocus")}</div>}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}