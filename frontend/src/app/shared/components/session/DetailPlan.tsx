// src/app/shared/components/session/DetailPlan.tsx
"use client";

import type { ComponentVariant } from "@/app/features/activities/types/activities";
import { ActivitySectionShell } from "@/app/shared/components/session/DetailActivity";
import SectionTrainingStructure, {
  hasTrainingStructure,
} from "@/app/shared/components/session/SectionTrainingStructure";
import { safeText } from "@/app/shared/components/session/sessionUtils";
import type { SessionItem } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import SectionPreview from "@/app/shared/components/session/SectionPreview";
import {
  PLAN_STRUCT_STACK,
  PLAN_BLOCK,
  PLAN_BLOCK_LABEL,
  PLAN_EX_LIST,
  PLAN_EX_ITEM,
  PLAN_EX_ITEM_STYLE,
  PLAN_EX_NAME,
  PLAN_EX_LINE,
  PLAN_EX_NOTE,
} from "@/app/shared/ui/tokens";

export default function DetailPlan({
  item,
  showPlanDebug,
  showAdvanced = false,
}: {
  variant?: ComponentVariant;
  item: SessionItem;
  showPlanDebug: boolean;
  showAdvanced?: boolean;
}) {
  const t = useT();
  const currentLang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

  const raw = item.planRaw ?? undefined;
  const structure = item.planStructure ?? raw?.structure ?? undefined;

  // 1. Spracovanie Cvikov (Strength)
  const strengthActivation = (structure as any)?.activation || [];
  const strengthMainPart = (structure as any)?.strength_main_part || [];
  const strengthAddOns = (structure as any)?.add_ons || [];

  const hasStrength =
    strengthActivation.length > 0 ||
    strengthMainPart.length > 0 ||
    strengthAddOns.length > 0;

  const renderExerciseList = (exercises: any[], fallbackLabel: string) => (
    <ul className={PLAN_EX_LIST}>
      {exercises.map((e: any, i: number) => {
        const id = e?.exercise_id;
        const catalogName =
          id && STRENGTH_CATALOG_FE[id]
            ? STRENGTH_CATALOG_FE[id][currentLang]
            : null;
        const formattedId = id ? id.replace(/_/g, " ") : null;

        const displayName =
          catalogName ||
          e?.exercise_name ||
          formattedId ||
          `${fallbackLabel} ${i + 1}`;

        const repsString = String(e?.reps || "");
        const hasTimeFormat =
          repsString.includes("s") || repsString.includes("min");
        const formattedReps = e?.reps
          ? hasTimeFormat
            ? e.reps
            : `${e.reps} ${t("sessions.detail.unitReps") || "opak."}`
          : null;

        return (
          <li key={i} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
            <div
              className={PLAN_EX_NAME}
              style={{
                textTransform: "capitalize",
                fontWeight: showAdvanced ? "600" : "400",
              }}
            >
              {displayName}
            </div>

            {showAdvanced && (
              <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className={PLAN_EX_LINE}>
                  {[
                    e?.sets
                      ? `${e.sets} ${t("sessions.detail.unitSets") || "sérií"}`
                      : null,
                    formattedReps,
                    e?.seconds
                      ? `${e.seconds}${t("sessions.detail.unitSec") || "s"}`
                      : null,
                    e?.rest_sec || e?.rest_s
                      ? `${t("sessions.detail.unitRest") || "Pauza"} ${e.rest_sec || e.rest_s}s`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                {e?.notes && (
                  <div className={PLAN_EX_NOTE}>{safeText(e.notes)}</div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-4">
      {/* --- POZNÁMKA TRÉNERA K PLÁNU --- */}
      {(item.planNotes || item.notes) && (
        <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-sm text-white/80 leading-relaxed">
          {safeText(item.planNotes || item.notes)}
        </div>
      )}

      {/* --- SEKCIA: ŠTRUKTÚRA TRÉNINGU (Endurance) --- */}
      {hasTrainingStructure(structure) && (
        <SectionTrainingStructure
          structure={structure}
          sport={item.sport}
          showAdvanced={showAdvanced}
        />
      )}

      {/* --- SEKCIA: CVIKY (Strength) --- */}
      {hasStrength && (
        <ActivitySectionShell
          title={t("sessions.detail.sectionExercises")}
          defaultOpen={false}
          items={[]}
        >
          <div className={PLAN_STRUCT_STACK}>
            {strengthActivation.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.activation")}
                </div>
                {renderExerciseList(strengthActivation, "Cvik")}
              </div>
            )}
            {strengthMainPart.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.strengthMain")}
                </div>
                {renderExerciseList(strengthMainPart, "Cvik")}
              </div>
            )}
            {strengthAddOns.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.addOns")}
                </div>
                {renderExerciseList(strengthAddOns, "Cvik")}
              </div>
            )}
          </div>
        </ActivitySectionShell>
      )}

      {/* --- SEKCIA: SESSION PREVIEW (konverzácia s trénerom k tejto session) --- */}
      {/* Editovateľné (formulár + otázka/zmena) len keď je session ešte "planned"
          a nie je spárovaná s aktivitou. Inak read-only história, ak existuje. */}
      {item.id != null && (
        <SectionPreview
          sessionId={Number(item.id)}
          isEditable={item.status === "planned" && item.activityId == null}
          initialThread={(raw as any)?.preview_thread ?? []}
        />
      )}
    </div>
  );
}
