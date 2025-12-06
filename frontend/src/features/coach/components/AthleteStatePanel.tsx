"use client";

import type { FC } from "react";

type AthleteStatePanelProps = {
  analysis: any | null;
  model?: string | null;
};

function pillColor(kind: "ok" | "warn" | "bad" | "neutral") {
  switch (kind) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "warn":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "bad":
      return "bg-red-500/15 text-red-300 border-red-500/40";
    default:
      return "bg-white/5 text-slate-200 border-white/10";
  }
}

const AthleteStatePanel: FC<AthleteStatePanelProps> = ({ analysis, model }) => {
  if (!analysis || typeof analysis !== "object") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm opacity-70">
        Žiadna analýza zatiaľ nebola vygenerovaná.
      </div>
    );
  }

  const aiState = (analysis as any).ai_state ?? {};
  const summary = (analysis as any).user_summary ?? {};

  const metrics = aiState.metrics ?? {};
  const volumeTol = aiState.volume_tolerance ?? {};
  const intensityTol = aiState.intensity_tolerance ?? {};

  const fatigue = aiState.fatigue_level ?? null;
  const injuryRisk = aiState.injury_risk ?? null;
  const blockKind = aiState.suggested_block_kind ?? null;

  const strengths: string[] = Array.isArray(aiState.key_strengths)
    ? aiState.key_strengths
    : [];
  const limits: string[] = Array.isArray(aiState.key_limitations)
    ? aiState.key_limitations
    : [];

  const bullets: string[] = Array.isArray(summary.suggestions_short)
    ? summary.suggestions_short
    : [];
  const risks: string[] = Array.isArray(summary.risks) ? summary.risks : [];

  const headline: string =
    summary.headline ?? "Stav atleta – sumarizácia od AI";

  const generatedAt: string | null =
    (analysis as any).generated_at ?? null;

  // jednoduché mapovanie na farby / text
  const fatigueKind: "ok" | "warn" | "bad" | "neutral" =
    fatigue === "low"
      ? "ok"
      : fatigue === "moderate"
      ? "warn"
      : fatigue === "high"
      ? "bad"
      : "neutral";

  const injuryKind: "ok" | "warn" | "bad" | "neutral" =
    injuryRisk === "low"
      ? "ok"
      : injuryRisk === "moderate"
      ? "warn"
      : injuryRisk === "high"
      ? "bad"
      : "neutral";

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Athlete state
          </div>
          <div className="text-base font-semibold text-slate-50">
            {headline}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
          {generatedAt && (
            <div>
              Generated:&nbsp;
              <span className="font-semibold text-slate-200">
                {generatedAt}
              </span>
            </div>
          )}
          {model && (
            <div className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide">
              {model}
            </div>
          )}
        </div>
      </div>

      {/* top status pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        {fatigue && (
          <span
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 " +
              pillColor(fatigueKind)
            }
          >
            <span className="font-semibold">Fatigue</span>
            <span className="opacity-80">{fatigue}</span>
          </span>
        )}
        {injuryRisk && (
          <span
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 " +
              pillColor(injuryKind)
            }
          >
            <span className="font-semibold">Injury risk</span>
            <span className="opacity-80">{injuryRisk}</span>
          </span>
        )}
        {blockKind && (
          <span
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 " +
              pillColor("neutral")
            }
          >
            <span className="font-semibold">Block</span>
            <span className="opacity-80">{blockKind}</span>
          </span>
        )}
      </div>

      {/* metrics + tolerances */}
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Základné metriky
          </div>
          <div className="grid grid-cols-2 gap-y-1 gap-x-2">
            {"acute_load_score" in metrics && (
              <>
                <span className="opacity-70">Acute load</span>
                <span className="font-semibold">
                  {metrics.acute_load_score}
                </span>
              </>
            )}
            {"chronic_load_score" in metrics && (
              <>
                <span className="opacity-70">Chronic load</span>
                <span className="font-semibold">
                  {metrics.chronic_load_score}
                </span>
              </>
            )}
            {"estimated_vo2max" in metrics && metrics.estimated_vo2max && (
              <>
                <span className="opacity-70">VO2max (est.)</span>
                <span className="font-semibold">
                  {metrics.estimated_vo2max}
                </span>
              </>
            )}
            {"estimated_5k_time_min" in metrics && (
              <>
                <span className="opacity-70">5 km (odhad)</span>
                <span className="font-semibold">
                  {metrics.estimated_5k_time_min} min
                </span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Tolerancia záťaže
          </div>
          <div className="grid grid-cols-2 gap-y-1 gap-x-2">
            {"weekly_minutes_min" in volumeTol && (
              <>
                <span className="opacity-70">Min. min/týž.</span>
                <span className="font-semibold">
                  {volumeTol.weekly_minutes_min}
                </span>
              </>
            )}
            {"weekly_minutes_max" in volumeTol && (
              <>
                <span className="opacity-70">Max. min/týž.</span>
                <span className="font-semibold">
                  {volumeTol.weekly_minutes_max}
                </span>
              </>
            )}
            {"hard_sessions_per_week_max" in intensityTol && (
              <>
                <span className="opacity-70">Max hard / týždeň</span>
                <span className="font-semibold">
                  {intensityTol.hard_sessions_per_week_max}
                </span>
              </>
            )}
          </div>
          {volumeTol.note && (
            <p className="mt-1 text-xs text-slate-300 opacity-80">
              {volumeTol.note}
            </p>
          )}
          {intensityTol.comment && (
            <p className="mt-1 text-xs text-slate-300 opacity-80">
              {intensityTol.comment}
            </p>
          )}
        </div>
      </div>

      {/* strengths + limitations */}
      {(strengths.length > 0 || limits.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          {strengths.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-emerald-300 mb-1">
                Silné stránky
              </div>
              <ul className="space-y-0.5 list-disc list-inside text-slate-100/90">
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {limits.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-300 mb-1">
                Limity / slabiny
              </div>
              <ul className="space-y-0.5 list-disc list-inside text-slate-100/90">
                {limits.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* suggestions + risks */}
      {(bullets.length > 0 || risks.length > 0) && (
        <div className="space-y-2 text-sm">
          {bullets.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-sky-300 mb-1">
                Kľúčové odporúčania
              </div>
              <ul className="space-y-0.5 list-disc list-inside text-slate-100/90">
                {bullets.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {risks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {risks.map((r, i) => (
                <span
                  key={i}
                  className={
                    "inline-flex items-center rounded-full border px-2 py-0.5 " +
                    pillColor("warn")
                  }
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AthleteStatePanel;