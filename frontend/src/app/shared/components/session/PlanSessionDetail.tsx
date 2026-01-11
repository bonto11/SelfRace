"use client";

import { ComponentVariant } from "@/app/features/activities/types/activities";
import { MetricGrid } from "./MetricGrid";
import DetailSection from "./DetailSection";
import {
  fmtMin,
  safeText,
  tgtToStr,
} from "./sessionUtils";

import type { PlanSession } from "./SessionCard";

type Props = {
  variant: ComponentVariant;
  item: PlanSession;
  showPlanDebug: boolean;
};

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

  console.log("[PlanSessionDetail] PLAN item", {
    title: item.title,
    planDur: item.planDur,
    planIntensity: item.planIntensity,
    planTarget: item.planTarget,
    raw,
    structure,
  });
  console.log("[PlanSessionDetail] PLAN exercises", {
    title: item.title,
    count: Array.isArray(exercises) ? exercises.length : 0,
    sample:
      Array.isArray(exercises) && exercises.length > 0
        ? exercises[0]
        : undefined,
  });

  return (
    <div>
      {/* KPIs (ak prídu zhora) */}
      {kpis.length > 0 && (
        <MetricGrid
          metrics={kpis.map((k) => ({
            label: k.label,
            value: k.value,
          }))}
        />
      )}

      {/* fallback KPI pre plan */}
      {kpis.length === 0 && (
        <MetricGrid
          cols={3}
          metrics={[
            item.planDur ? { label: "DURATION", value: item.planDur } : null,
            item.planIntensity
              ? { label: "INTENSITY", value: item.planIntensity }
              : null,
            item.planTarget
              ? { label: "TARGET", value: item.planTarget }
              : null,
          ].filter(Boolean) as any}
        />
      )}

      {(wu || mainBlocks.length || cd) && (
        <DetailSection title="Štruktúra tréningu">
          <div className="space-y-3">
            {wu && (
              <div className="px-1">
                <div className="text-[11px] font-semibold opacity-80">
                  WARM-UP
                </div>
                <div className="text-sm mt-0.5">
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
              <div className="px-1">
                <div className="text-[11px] font-semibold opacity-80">MAIN</div>
                <div className="text-sm mt-0.5 space-y-1">
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
                        className="border-t border-white/5 pt-1 first:border-t-0 first:pt-0"
                      >
                        <div>{line}</div>
                        {tgt && <div className="opacity-90">target: {tgt}</div>}
                        {noteText && (
                          <div className="opacity-90">{noteText}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cd && (
              <div className="px-1">
                <div className="text-[11px] font-semibold opacity-80">
                  COOL-DOWN
                </div>
                <div className="text-sm mt-0.5">
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
          <ul className="space-y-1.5">
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
                <li
                  key={`${name}-${i}`}
                  className="rounded-md border border-white/10 px-3 py-2"
                >
                  <div className="text-sm font-medium">{name}</div>
                  <div className="text-xs opacity-85 mt-0.5">{line}</div>
                  {notesText && (
                    <div className="text-xs opacity-85 mt-0.5">
                      {notesText}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </DetailSection>
      )}

      {(item.planNotes || item.notes) && (
        <div className="mt-3 text-sm opacity-90">
          {safeText(item.planNotes ?? item.notes)}
        </div>
      )}

      {showPlanDebug && (
        <DetailSection title="Plan debug" defaultOpen={false}>
          <pre className="text-[11px] whitespace-pre-wrap break-words opacity-85">
            {safeText({ structure, exercises, raw })}
          </pre>
        </DetailSection>
      )}
    </div>
  );
}