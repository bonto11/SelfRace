// src/app/shared/components/session/DetailPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentVariant } from "@/app/features/activities/types/activities";
import { ActivitySectionShell } from "@/app/shared/components/session/DetailActivity";
import SectionTrainingStructure, {
  hasTrainingStructure,
} from "@/app/shared/components/session/SectionTrainingStructure";
import SectionPreview from "@/app/shared/components/session/SectionPreview";
import { safeText } from "@/app/shared/components/session/sessionUtils";
import type { SessionItem } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
// 🌟 NOVÉ: spoločné formátovanie predpisu (pauza 1:45 min, výdrž 30-45s)
import { formatPrescription } from "@/app/shared/utils/strengthFormat";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import StrengthLogEditor from "@/app/features/activities/components/StrengthLogEditor";
import {
  apiCreateStrengthSession,
  apiGetStrengthSessionByPlan,
} from "@/app/features/activities/api/strength_sessions";
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
  const { userId } = useUserId();
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

  // Zápis odcvičeného - strength_sessions záznam naviazaný na tento plán.
  // Funguje bez ohľadu na dátum (aj budúci tréning, ak ho spravíš skôr)
  // aj bez Strava aktivity.
  const [logSessionId, setLogSessionId] = useState<number | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    if (!userId || item.planId == null) return;
    let alive = true;
    apiGetStrengthSessionByPlan(Number(userId), Number(item.planId)).then((s) => {
      if (alive && s) setLogSessionId(s.id);
    });
    return () => {
      alive = false;
    };
  }, [userId, item.planId]);

  const handleOpenLog = async () => {
    if (!userId || item.planId == null || logLoading) return;
    setLogLoading(true);
    const created = await apiCreateStrengthSession(Number(userId), {
      plan_session_id: Number(item.planId),
    });
    setLogLoading(false);
    if (created) setLogSessionId(created.id);
  };

  // 🌟 ZMENA: predpis sa formátuje cez spoločný helper - pauza ako
  // "2:30 min" namiesto "150s", výdrž/vzdialenosť ("30-45s", "20-30m")
  // sa zobrazí tak, ako prišla, bez dopísania "opak."
  const prescriptionLabels = useMemo(
    () => ({
      sets: t("sessions.detail.unitSets") || "sérií",
      reps: t("sessions.detail.unitReps") || "opak.",
      rest: t("sessions.detail.unitRest") || "Pauza",
      sec: t("sessions.detail.unitSec") || "s",
    }),
    [t],
  );

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

        const prescription = formatPrescription(
          {
            sets: e?.sets,
            reps: e?.reps,
            rest_s: e?.rest_s ?? e?.rest_sec,
            seconds: e?.seconds,
          },
          prescriptionLabels,
        );

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
                <div className={PLAN_EX_LINE}>{prescription || "—"}</div>
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
          status={item.status}
        />
      )}

      {/* --- SEKCIA: CVIKY (Strength) --- */}
      {hasStrength && (
        <ActivitySectionShell
          title={t("sessions.detail.sectionExercises")}
          defaultOpen={item.status !== "done"}
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

            {item.planId != null && (
              <div className="pt-3 border-t border-white/10">
                {logSessionId != null ? (
                  <StrengthLogEditor
                    sessionId={logSessionId}
                    showAdvanced={showAdvanced}
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleOpenLog}
                    disabled={logLoading}
                  >
                    {logLoading ? (
                      <LoadingSpinner size="button" />
                    ) : (
                      t("strengthLog.openForPlan")
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </ActivitySectionShell>
      )}

      {/* --- SEKCIA: SESSION PREVIEW (konverzácia s trénerom k tejto session) --- */}
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