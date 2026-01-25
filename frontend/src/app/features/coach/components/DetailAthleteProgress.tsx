"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/app/shared/ui/tokens";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteProgress,
  type AthleteProgressRecord,
} from "@/app/features/coach/api/coach_athlete_state";

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
    } catch {}
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
    fitnessRunPrev: typeof fitRun.previous === "number" ? fitRun.previous : null,
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

/* ---------- tiny building blocks (no padding in JSX) ---------- */

function Card({
  title,
  subtitle,
  children,
  footer = true,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: boolean;
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

      {footer ? <div className={ACCORDION_FOOTER_BAR_MUTED} /> : null}
    </section>
  );
}

function Subcard({
  title,
  value,
  text,
}: {
  title: string;
  value: React.ReactNode;
  text?: React.ReactNode;
}) {
  return (
    <div className={SURFACE_SUBCARD}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_SECTION_SUBTITLE}>{title}</div>
        <div className={PANEL_SECTION_TITLE}>{value}</div>
        {text ? <div className={PANEL_SECTION_SUBTITLE}>{text}</div> : null}
      </div>
    </div>
  );
}

/* ---------- component ---------- */

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

  const p = useMemo(() => parseProgress(row), [row]);

  if (!userId) {
    return (
      <Card title="Weekly progress" subtitle="Chýba userId (useUserId).">
        <div className={PANEL_PREVIEW}>
          Skontroluj prihlásenie používateľa.
        </div>
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
      <Card title="Weekly progress" subtitle="Nepodarilo sa načítať report.">
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  if (!row || !(row as any).report) {
    return (
      <Card
        title="Weekly progress"
        subtitle="Zatiaľ nemáš uložené porovnanie analýz."
      >
        <div className={PANEL_PREVIEW}>
          Potrebujeme aspoň dve AI analýzy stavu (cron weekly refresh), potom sa
          tu zobrazí detail.
        </div>
      </Card>
    );
  }

  return (
    <div className={PANEL_STACK}>
      <Card
        title="Weekly progress – porovnanie posledných AI stavov"
        subtitle={
          [
            p.generatedAt ? `Porovnanie vytvorené: ${p.generatedAt}` : null,
            p.model || p.schemaVersion
              ? `Model: ${p.model ?? "—"}, schema v${p.schemaVersion ?? "?"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        }
        footer
      >
        {p.headline ? <div className={PANEL_PREVIEW}>{p.headline}</div> : null}

        {p.summaryBullets.length > 0 ? (
          <ul className="list-disc list-inside text-sm space-y-1">
            {p.summaryBullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="Únava, riziko zranenia a tréningový blok" footer>
        <div className={PANEL_GRID_3}>
          <Subcard
            title="Únava"
            value={
              p.fatiguePrev || p.fatigueCurr
                ? `${slovakLevel(p.fatiguePrev)} → ${slovakLevel(p.fatigueCurr)}`
                : "—"
            }
            text={p.fatigueComment || undefined}
          />
          <Subcard
            title="Riziko zranenia"
            value={
              p.injuryPrev || p.injuryCurr
                ? `${slovakLevel(p.injuryPrev)} → ${slovakLevel(p.injuryCurr)}`
                : "—"
            }
            text={p.injuryComment || undefined}
          />
          <Subcard
            title="Odporúčaný blok"
            value={
              p.blockPrev || p.blockCurr
                ? `${p.blockPrev || "—"} → ${p.blockCurr || "—"}`
                : "—"
            }
            text={p.blockComment || undefined}
          />
        </div>
      </Card>

      <Card title="Fitness úroveň (1–10): predchádzajúca vs. aktuálna" footer>
        <div className={PANEL_GRID_3}>
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
          ].map((r) => (
            <Subcard
              key={r.label}
              title={r.label}
              value={
                r.prev != null || r.curr != null
                  ? `${r.prev ?? "—"}/10 → ${r.curr ?? "—"}/10`
                  : "—"
              }
              text={r.comment || undefined}
            />
          ))}
        </div>
      </Card>

      <Card title="Tréningový objem a úpravy plánu" footer>
        <div className="grid gap-3 md:grid-cols-2">
          <Subcard
            title="Týždenný objem"
            value={`${formatMinutesRange(p.volPrevMin, p.volPrevMax)} → ${formatMinutesRange(
              p.volCurrMin,
              p.volCurrMax
            )}`}
            text={p.volComment || undefined}
          />

          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_SUBTITLE}>Zmeny v pláne</div>
              {p.planSoften ? <div className={PANEL_PREVIEW}>{p.planSoften}</div> : null}
              {p.planWeekly ? <div className={PANEL_PREVIEW}>{p.planWeekly}</div> : null}
              {!p.planSoften && !p.planWeekly ? (
                <div className={PANEL_PREVIEW}>AI neodporúča meniť štruktúru plánu.</div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Odporúčania z posledného porovnania" footer>
        <div className={PANEL_GRID_3}>
          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Čo osláviť</div>
              {p.celebrations.length ? (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {p.celebrations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <div className={PANEL_PREVIEW}>Zatiaľ žiadne špecifické oslavy.</div>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Riziká, ktoré sledovať</div>
              {p.risksToWatch.length ? (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {p.risksToWatch.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <div className={PANEL_PREVIEW}>Momentálne bez konkrétnych varovaní.</div>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Fokus na najbližšie týždne</div>
              {p.focusNextWeeks.length ? (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {p.focusNextWeeks.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <div className={PANEL_PREVIEW}>
                  Po ďalších porovnaniach sem pribudnú konkrétne priority.
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD].join(" ")}>
          <details className="text-xs">
            <summary className="cursor-pointer">Debug – raw JSON progress report</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-900/80 p-3 text-[10px] leading-tight">
              {JSON.stringify(p.raw, null, 2)}
            </pre>
          </details>
        </div>
      </section>
    </div>
  );
}