// src/app/shared/components/session/PlanSessionDetail.tsx
"use client";

import type { ComponentVariant } from "@/app/features/activities/types/activities";
import DetailSection from "@/app/shared/components/session/DetailSection";
import {
  fmtMin,
  safeText,
  tgtToStr,
} from "@/app/shared/components/session/sessionUtils";
import type { PlanSession } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";
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
  PLAN_DEBUG_PRE,
} from "@/app/shared/ui/tokens";

// --- Pomocné funkcie pre čítanie novej štruktúry ---

function getDuration(block: any): string | null {
  if (typeof block === "string") return null; // Pri stringu dĺžku nevieme extrahovať samostatne
  const m = block?.duration_min ?? block?.minutes ?? block?.work_min;
  return m ? fmtMin(m) : null;
}

function getTarget(block: any): string | null {
  if (typeof block === "string") return null;
  return block?.target ?? block?.zone_text ?? null;
}

function getNote(block: any): string | null {
  // Ak je block string, vrátime ho priamo ako inštrukciu
  if (typeof block === "string") return block;
  return block?.instruction ?? block?.notes ?? null;
}

function MiniMetricGrid({
  metrics,
  cols = 3,
}: {
  metrics: any[];
  cols?: 2 | 3;
}) {
  if (!metrics?.length) return null;
  const colClass = cols === 2 ? SESSION_MINIGRID_2COL : SESSION_MINIGRID_3COL;
  return (
    <div className={[SESSION_MINIGRID_BASE, colClass].join(" ")}>
      {metrics.map((m, i) => (
        <div
          key={i}
          className={SESSION_MINITILE}
          style={SESSION_MINITILE_STYLE}
        >
          <div className={SESSION_MINITILE_LABEL}>{m.label}</div>
          <div className={SESSION_MINITILE_VALUE}>{m.value ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

export default function PlanSessionDetail({
  item,
  showPlanDebug,
}: {
  variant?: ComponentVariant;
  item: PlanSession;
  showPlanDebug: boolean;
}) {
  const t = useT();
  const raw = item.planRaw ?? undefined;
  // Fallback: structure môže byť priamo objekt, alebo byť v 'structure' kľúči
  const structure = item.planStructure ?? raw?.structure ?? undefined;

  // 1. Spracovanie Cvikov (Strength)
  const exercises =
    Array.isArray(item.planExercises) && item.planExercises.length > 0
      ? item.planExercises
      : ((structure as any)?.strength_exercises ??
        (raw as any)?.strength_exercises ??
        []);

  // 2. Spracovanie Endurance (Beh/Bike)
  // Nový formát používa "main_part" (pole), starý formát "main" (objekt alebo pole)
  const wu = (structure as any)?.warmup;
  const rawMain = (structure as any)?.main_part ?? (structure as any)?.main;
  const mainBlocks = Array.isArray(rawMain)
    ? rawMain
    : rawMain
      ? [rawMain]
      : [];
  const cd = (structure as any)?.cooldown;

  const hasEnduranceStructure = wu || mainBlocks.length > 0 || cd;

  // Metriky pre MiniGrid
  const metrics = (
    item.kpis?.length
      ? item.kpis
      : [
          item.planDur
            ? { label: t("common.metrics.duration"), value: item.planDur }
            : null,
          item.planIntensity
            ? {
                label: t("prefs.sections.rulesSection.intensityLabel"),
                value: item.planIntensity,
              }
            : null,
          item.planTarget
            ? {
                label: t("sessions.detail.plan.target"),
                value: item.planTarget,
              }
            : null,
        ]
  ).filter(Boolean);

  return (
    <div>
      <MiniMetricGrid metrics={metrics} cols={3} />

      {/* --- SEKCIA: ŠTRUKTÚRA TRÉNINGU (Endurance) --- */}
      {hasEnduranceStructure && (
        <DetailSection title={t("sessions.detail.sectionStructure")}>
          <div className={PLAN_STRUCT_STACK}>
            {/* WARMUP */}
            {wu && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.warmup")}
                </div>
                <div className={PLAN_BLOCK_TEXT}>
                  {typeof wu === "string"
                    ? wu
                    : [getDuration(wu), getTarget(wu), getNote(wu)]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                </div>
              </div>
            )}

            {/* MAIN PART */}
            {mainBlocks.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.main")}
                </div>
                <div className={PLAN_MAIN_STACK}>
                  {mainBlocks.map((blk: any, idx: number) => {
                    // Ak je blk len string (ako v tvojom JSON-e)
                    if (typeof blk === "string") {
                      return (
                        <div
                          key={idx}
                          className={PLAN_MAIN_ITEM}
                          style={PLAN_MAIN_ITEM_STYLE}
                        >
                          <div className={PLAN_MAIN_NOTE}>{safeText(blk)}</div>
                        </div>
                      );
                    }

                    const isInterval = blk.kind === "interval_block";

                    // A) INTERVALY
                    if (isInterval) {
                      const reps = blk.repeats || 1;
                      const workDur = getDuration(blk.work);
                      const restDur = getDuration(blk.rest);
                      const workTgt = getTarget(blk.work);
                      const restTgt = getTarget(blk.rest);
                      const workNote = getNote(blk.work);

                      return (
                        <div
                          key={idx}
                          className={PLAN_MAIN_ITEM}
                          style={PLAN_MAIN_ITEM_STYLE}
                        >
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-white font-bold text-base">
                              {reps}×
                            </span>
                            <span className="opacity-90">
                              {workDur}{" "}
                              <span className="opacity-60 text-xs">
                                ({t("sessions.detail.plan.work")})
                              </span>
                            </span>
                            {restDur && (
                              <span className="opacity-60">
                                + {restDur}{" "}
                                <span className="text-xs">
                                  ({t("sessions.detail.plan.recovery")})
                                </span>
                              </span>
                            )}
                          </div>

                          {/* Targets */}
                          {(workTgt || restTgt) && (
                            <div className={PLAN_MAIN_TGT}>
                              {workTgt && <span>Work: {workTgt}</span>}
                              {workTgt && restTgt && (
                                <span className="mx-1 opacity-30">|</span>
                              )}
                              {restTgt && (
                                <span className="opacity-70">
                                  Rest: {restTgt}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Note/Instruction */}
                          {workNote && (
                            <div className={PLAN_MAIN_NOTE}>
                              {safeText(workNote)}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // B) STEADY / SIMPLE BLOCK
                    const dur = getDuration(blk);
                    const tgt = getTarget(blk);
                    const note = getNote(blk);

                    return (
                      <div
                        key={idx}
                        className={PLAN_MAIN_ITEM}
                        style={PLAN_MAIN_ITEM_STYLE}
                      >
                        <div className="font-semibold text-white/90">
                          {dur || "—"}
                        </div>
                        {tgt && (
                          <div className={PLAN_MAIN_TGT}>{tgtToStr(tgt)}</div>
                        )}
                        {note && (
                          <div className={PLAN_MAIN_NOTE}>{safeText(note)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COOLDOWN */}
            {cd && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.cooldown")}
                </div>
                <div className={PLAN_BLOCK_TEXT}>
                  {typeof wu === "string"
                    ? wu
                    : [getDuration(cd), getTarget(cd), getNote(cd)]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                </div>
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {/* --- SEKCIA: CVIKY (Strength) --- */}
      {exercises?.length > 0 && (
        <DetailSection title={t("sessions.detail.sectionExercises")}>
          <ul className={PLAN_EX_LIST}>
            {exercises.map((e: any, i: number) => (
              <li key={i} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
                <div className={PLAN_EX_NAME}>
                  {e?.exercise_name ||
                    e?.name ||
                    `${t("sessions.detail.sectionExercises")} ${i + 1}`}
                </div>
                <div className={PLAN_EX_LINE}>
                  {[
                    e?.sets
                      ? `${e.sets} ${t("sessions.detail.unitSets")}`
                      : null,
                    e?.reps
                      ? `${e.reps} ${t("sessions.detail.unitReps")}`
                      : null,
                    e?.seconds
                      ? `${e.seconds}${t("sessions.detail.unitSec")}`
                      : null,
                    e?.rest_sec || e?.rest_s
                      ? `${t("sessions.detail.unitRest")} ${e.rest_sec || e.rest_s}s`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                {e?.notes && (
                  <div className={PLAN_EX_NOTE}>{safeText(e.notes)}</div>
                )}
              </li>
            ))}
          </ul>
        </DetailSection>
      )}

      {/* --- DEBUG SEKCIA --- */}
      {showPlanDebug && (
        <DetailSection
          title={t("sessions.detail.sectionDebug")}
          defaultOpen={false}
        >
          <pre className={PLAN_DEBUG_PRE}>
            {safeText({ structure, exercises, raw })}
          </pre>
        </DetailSection>
      )}
    </div>
  );
}
