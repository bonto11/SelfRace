"use client";

import type { ComponentVariant } from "@/app/features/activities/types/activities";
import DetailSection from "@/app/shared/components/session/DetailSection";
import { fmtMin, safeText, tgtToStr } from "@/app/shared/components/session/sessionUtils";
import type { PlanSession } from "@/app/shared/components/session/SessionCard";

import {
  SESSION_MINIGRID_BASE,
  SESSION_MINIGRID_2COL,
  SESSION_MINIGRID_3COL,
  SESSION_MINITILE,
  SESSION_MINITILE_STYLE,
  SESSION_MINITILE_LABEL,
  SESSION_MINITILE_VALUE,

  PLAN_STRUCT_STACK,
  PLAN_BLOCK,
  PLAN_BLOCK_LABEL,
  PLAN_BLOCK_TEXT,

  PLAN_MAIN_STACK,
  PLAN_MAIN_ITEM,
  PLAN_MAIN_ITEM_STYLE,
  PLAN_MAIN_TGT,
  PLAN_MAIN_NOTE,

  PLAN_EX_LIST,
  PLAN_EX_ITEM,
  PLAN_EX_ITEM_STYLE,
  PLAN_EX_NAME,
  PLAN_EX_LINE,
  PLAN_EX_NOTE,

  PLAN_NOTES,
  PLAN_DEBUG_PRE,
} from "@/app/shared/ui/tokens";

type Props = {
  variant: ComponentVariant;
  item: PlanSession;
  showPlanDebug: boolean;
};

/** ==== shared mini KPI grid ==== */

type MiniMetric = {
  label: string;
  value: string | number | null;
};

type MiniMetricGridProps = {
  metrics: MiniMetric[];
  cols?: 2 | 3;
};

function valOrDash(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function MiniMetricGrid({ metrics, cols = 3 }: MiniMetricGridProps) {
  if (!metrics || metrics.length === 0) return null;

  const colClass = cols === 2 ? SESSION_MINIGRID_2COL : SESSION_MINIGRID_3COL;

  return (
    <div className={[SESSION_MINIGRID_BASE, colClass].join(" ")}>
      {metrics.map((m) => (
        <div
          key={m.label}
          className={SESSION_MINITILE}
          style={SESSION_MINITILE_STYLE}
        >
          <div className={SESSION_MINITILE_LABEL}>{m.label}</div>
          <div className={SESSION_MINITILE_VALUE}>{valOrDash(m.value)}</div>
        </div>
      ))}
    </div>
  );
}

/** ================= main ================= */

export default function PlanSessionDetail({ item, showPlanDebug }: Props) {
  const kpis = Array.isArray(item.kpis) ? item.kpis : [];

  const raw = item.planRaw ?? undefined;
  const structure = item.planStructure ?? raw?.structure ?? undefined;

  const exercises =
    Array.isArray(item.planExercises) && item.planExercises.length > 0
      ? item.planExercises
      : Array.isArray((structure as any)?.strength_exercises) &&
        (structure as any).strength_exercises.length > 0
      ? (structure as any).strength_exercises
      : Array.isArray((raw as any)?.strength_exercises)
      ? (raw as any).strength_exercises
      : [];

  const wu = (structure as any)?.warmup ?? undefined;
  const mainBlocks: any[] = Array.isArray((structure as any)?.main)
    ? (structure as any).main
    : (structure as any)?.main
    ? [(structure as any).main]
    : [];
  const cd = (structure as any)?.cooldown ?? undefined;

  // KPI blok
  const metricsFromKpis: MiniMetric[] = kpis.map((k) => ({
    label: k.label,
    value: k.value,
  }));

  const fallbackMetrics: MiniMetric[] = [
    item.planDur ? { label: "Duration", value: item.planDur } : null,
    item.planIntensity ? { label: "Intensity", value: item.planIntensity } : null,
    item.planTarget ? { label: "Target", value: item.planTarget } : null,
  ].filter(Boolean) as MiniMetric[];

  return (
    <div>
      {metricsFromKpis.length > 0 && (
        <MiniMetricGrid metrics={metricsFromKpis} cols={3} />
      )}

      {metricsFromKpis.length === 0 && fallbackMetrics.length > 0 && (
        <MiniMetricGrid metrics={fallbackMetrics} cols={3} />
      )}

      {(wu || mainBlocks.length || cd) && (
        <DetailSection title="Štruktúra tréningu">
          <div className={PLAN_STRUCT_STACK}>
            {wu && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>WARM-UP</div>
                <div className={PLAN_BLOCK_TEXT}>
                  {[
                    fmtMin((wu as any).minutes),
                    typeof (wu as any).notes === "string"
                      ? (wu as any).notes
                      : (wu as any).notes != null
                      ? safeText((wu as any).notes)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
            )}

            {mainBlocks.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>MAIN</div>
                <div className={PLAN_MAIN_STACK}>
                  {mainBlocks.map((mn: any, idx: number) => {
                    const line =
                      [
                        mn?.reps ? `${mn.reps}×` : null,
                        fmtMin(mn?.work_min),
                        mn?.recover_min ? `rec ${mn.recover_min} min` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—";

                    const tgt = tgtToStr(mn?.target);
                    const noteText =
                      typeof mn?.notes === "string"
                        ? mn.notes
                        : mn?.notes != null
                        ? safeText(mn.notes)
                        : null;

                    return (
                      <div
                        key={idx}
                        className={PLAN_MAIN_ITEM}
                        style={PLAN_MAIN_ITEM_STYLE}
                      >
                        <div>{line}</div>
                        {tgt && <div className={PLAN_MAIN_TGT}>target: {tgt}</div>}
                        {noteText && <div className={PLAN_MAIN_NOTE}>{noteText}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cd && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>COOL-DOWN</div>
                <div className={PLAN_BLOCK_TEXT}>
                  {[
                    fmtMin((cd as any).minutes),
                    typeof (cd as any).notes === "string"
                      ? (cd as any).notes
                      : (cd as any).notes != null
                      ? safeText((cd as any).notes)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {Array.isArray(exercises) && exercises.length > 0 && (
        <DetailSection title="Exercises">
          <ul className={PLAN_EX_LIST}>
            {exercises.map((e: any, i: number) => {
              const name = e?.exercise_name || e?.name || `Exercise ${i + 1}`;

              const parts = [
                e?.sets ? `${e.sets} sets` : null,
                e?.reps ? `${e.reps} reps` : null,
                e?.seconds ? `${e.seconds}s` : null,
                e?.rest_sec
                  ? `rest ${e.rest_sec}s`
                  : e?.rest_s
                  ? `rest ${e.rest_s}s`
                  : null,
              ].filter(Boolean);

              const line = parts.length ? parts.join(" · ") : "—";

              const notesText =
                typeof e?.notes === "string"
                  ? e.notes
                  : e?.notes != null
                  ? safeText(e.notes)
                  : null;

              return (
                <li key={`${name}-${i}`} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
                  <div className={PLAN_EX_NAME}>{name}</div>
                  <div className={PLAN_EX_LINE}>{line}</div>
                  {notesText && <div className={PLAN_EX_NOTE}>{notesText}</div>}
                </li>
              );
            })}
          </ul>
        </DetailSection>
      )}

      {(item.planNotes || item.notes) && (
        <div className={PLAN_NOTES}>{safeText(item.planNotes ?? item.notes)}</div>
      )}

      {showPlanDebug && (
        <DetailSection title="Plan debug" defaultOpen={false}>
          <pre className={PLAN_DEBUG_PRE}>{safeText({ structure, exercises, raw })}</pre>
        </DetailSection>
      )}
    </div>
  );
}