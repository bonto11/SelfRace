"use client";

import type { ComponentVariant } from "@/app/features/activities/types/activities";
import DetailSection from "@/app/shared/components/session/DetailSection";
import { fmtMin, safeText, tgtToStr } from "@/app/shared/components/session/sessionUtils";
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
  PLAN_NOTES,
  PLAN_DEBUG_PRE,
} from "@/app/shared/ui/tokens";

function MiniMetricGrid({ metrics, cols = 3 }: { metrics: any[], cols?: 2 | 3 }) {
  if (!metrics?.length) return null;
  const colClass = cols === 2 ? SESSION_MINIGRID_2COL : SESSION_MINIGRID_3COL;
  return (
    <div className={[SESSION_MINIGRID_BASE, colClass].join(" ")}>
      {metrics.map((m) => (
        <div key={m.label} className={SESSION_MINITILE} style={SESSION_MINITILE_STYLE}>
          <div className={SESSION_MINITILE_LABEL}>{m.label}</div>
          <div className={SESSION_MINITILE_VALUE}>{m.value ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

export default function PlanSessionDetail({ item, showPlanDebug }: { variant: ComponentVariant; item: PlanSession; showPlanDebug: boolean; }) {
  const t = useT();
  const raw = item.planRaw ?? undefined;
  const structure = item.planStructure ?? raw?.structure ?? undefined;

  const exercises = Array.isArray(item.planExercises) && item.planExercises.length > 0
      ? item.planExercises
      : (structure as any)?.strength_exercises ?? (raw as any)?.strength_exercises ?? [];

  const wu = (structure as any)?.warmup;
  const mainBlocks = Array.isArray((structure as any)?.main) ? (structure as any).main : (structure as any)?.main ? [(structure as any).main] : [];
  const cd = (structure as any)?.cooldown;

  const metrics = (item.kpis?.length ? item.kpis : [
    item.planDur ? { label: t("common.metrics.duration"), value: item.planDur } : null,
    item.planIntensity ? { label: t("prefs.sections.rulesSection.intensityLabel"), value: item.planIntensity } : null,
    item.planTarget ? { label: t("sessions.detail.plan.target"), value: item.planTarget } : null,
  ]).filter(Boolean);

  return (
    <div>
      <MiniMetricGrid metrics={metrics} cols={3} />

      {(wu || mainBlocks.length || cd) && (
        <DetailSection title={t("sessions.detail.sectionStructure")}>
          <div className={PLAN_STRUCT_STACK}>
            {wu && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>{t("sessions.detail.plan.warmup")}</div>
                <div className={PLAN_BLOCK_TEXT}>{[fmtMin(wu.minutes), wu.notes].filter(Boolean).join(" · ") || "—"}</div>
              </div>
            )}

            {mainBlocks.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>{t("sessions.detail.plan.main")}</div>
                <div className={PLAN_MAIN_STACK}>
                  {mainBlocks.map((mn: any, idx: number) => (
                    <div key={idx} className={PLAN_MAIN_ITEM} style={PLAN_MAIN_ITEM_STYLE}>
                      <div>{[mn?.reps ? `${mn.reps}×` : null, fmtMin(mn?.work_min), mn?.recover_min ? `${t("sessions.detail.plan.recovery")} ${mn.recover_min} min` : null].filter(Boolean).join(" · ") || "—"}</div>
                      {mn?.target && <div className={PLAN_MAIN_TGT}>{t("sessions.detail.plan.target")}: {tgtToStr(mn.target)}</div>}
                      {mn?.notes && <div className={PLAN_MAIN_NOTE}>{safeText(mn.notes)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cd && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>{t("sessions.detail.plan.cooldown")}</div>
                <div className={PLAN_BLOCK_TEXT}>{[fmtMin(cd.minutes), cd.notes].filter(Boolean).join(" · ") || "—"}</div>
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {exercises?.length > 0 && (
        <DetailSection title={t("sessions.detail.sectionExercises")}>
          <ul className={PLAN_EX_LIST}>
            {exercises.map((e: any, i: number) => (
              <li key={i} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
                <div className={PLAN_EX_NAME}>{e?.exercise_name || e?.name || `${t("sessions.detail.sectionExercises")} ${i + 1}`}</div>
                <div className={PLAN_EX_LINE}>{[e?.sets ? `${e.sets} ${t("sessions.detail.unitSets")}` : null, e?.reps ? `${e.reps} ${t("sessions.detail.unitReps")}` : null, e?.seconds ? `${e.seconds}${t("sessions.detail.unitSec")}` : null, (e?.rest_sec || e?.rest_s) ? `${t("sessions.detail.unitRest")} ${e.rest_sec || e.rest_s}s` : null].filter(Boolean).join(" · ") || "—"}</div>
                {e?.notes && <div className={PLAN_EX_NOTE}>{safeText(e.notes)}</div>}
              </li>
            ))}
          </ul>
        </DetailSection>
      )}

      {showPlanDebug && (
        <DetailSection title={t("sessions.detail.sectionDebug")} defaultOpen={false}>
          <pre className={PLAN_DEBUG_PRE}>{safeText({ structure, exercises, raw })}</pre>
        </DetailSection>
      )}
    </div>
  );
}