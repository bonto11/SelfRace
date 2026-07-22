// src/app/features/coach/components/PlanLifecycleSection.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import { apiAnalyzeAthleteState } from "@/app/features/coach/api/coach_athlete_state";
import { apiGenerateWeeklyPlan } from "@/app/features/coach/api/coach_plan_weekly";
import { apiGenerateDailyForWeek } from "@/app/features/coach/api/coach_plan_daily";
import {
  apiActivePlanStatus,
  apiActivatePlan,
  apiCancelPlan,
} from "@/app/features/coach/api/coach_plan_active";

/* ============================================================ */
/* PLAN LIFECYCLE SEKCIA - zjednotene generovanie/aktivacia/zrusenie */
/* (nahradza predtym samostatny WidgetCoachActions s 3 tlacidlami) */
/*                                                                */
/* Stavy:                                                        */
/*  1. Ziadny plan este nie je vygenerovany  -> "Vygenerovat plan" */
/*  2. Plan je vygenerovany, ale nie aktivny -> "Aktivovat plan"   */
/*  3. Plan je aktivny -> prekliky na Daily/Weekly + "Zrusit plan" */
/* ============================================================ */

type GenerateStep = "state" | "weekly" | "daily" | null;

export default function PlanLifecycleSection() {
  const t = useT();
  const router = useRouter();
  const { userId, userUuid } = useUserId();

  const [status, setStatus] = React.useState<{
    has_active_plan: boolean;
    is_generated: boolean;
  } | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(true);

  const [generating, setGenerating] = React.useState(false);
  const [generateStep, setGenerateStep] = React.useState<GenerateStep>(null);
  const [activating, setActivating] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    if (!userId) return;
    setStatusLoading(true);
    try {
      const out = await apiActivePlanStatus(Number(userId));
      setStatus(out);
    } catch (e) {
      console.error("[PlanLifecycle] status error", e);
    } finally {
      setStatusLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Sekvenčné generovanie: athlete state -> weekly plan -> daily plan (week 1).
  // Všetky tri MUSIA prebehnúť v tomto poradí, aby vznikol funkčný plán -
  // preto je to teraz jedno tlačidlo namiesto troch oddelených krokov, ktoré
  // mätúco vyžadovali ručné poradie a návrat medzi widgetmi.
  const handleGenerate = async () => {
    if (!userId || !userUuid || generating) return;
    setGenerating(true);
    try {
      setGenerateStep("state");
      const stateOut = await apiAnalyzeAthleteState(Number(userId), userUuid);
      if (!stateOut.success) {
        toast.error(stateOut.message || t("coachPrefs.plan.errorState"));
        return;
      }

      setGenerateStep("weekly");
      const weeklyOut = await apiGenerateWeeklyPlan(Number(userId), userUuid, {
        overwrite: true,
      });
      if (!weeklyOut.success) {
        toast.error(weeklyOut.message || t("coachPrefs.plan.errorWeekly"));
        return;
      }

      setGenerateStep("daily");
      const dailyOut = await apiGenerateDailyForWeek(Number(userId), userUuid, {
        week_index: 1,
        overwrite: true,
      });
      if (!dailyOut.success) {
        toast.error(dailyOut.message || t("coachPrefs.plan.errorDaily"));
        return;
      }

      toast.success(t("coachPrefs.plan.generateSuccess"));
      await loadStatus();
    } finally {
      setGenerating(false);
      setGenerateStep(null);
    }
  };

  const handleActivate = async () => {
    if (!userId || activating) return;
    setActivating(true);
    try {
      const out = await apiActivatePlan(Number(userId));
      if (!out.success) {
        toast.error(out.message || t("coachPrefs.plan.errorActivate"));
        return;
      }
      toast.success(t("coachPrefs.plan.activateSuccess"));
      await loadStatus();
    } finally {
      setActivating(false);
    }
  };

  const handleCancel = async () => {
    if (!userId || cancelling) return;
    const ok = await confirm({
      title: t("coachPrefs.plan.cancelConfirmTitle"),
      message: t("coachPrefs.plan.cancelConfirmMessage"),
      okText: t("coachPrefs.plan.cancelConfirmOk"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;

    setCancelling(true);
    try {
      const out = await apiCancelPlan(Number(userId));
      if (!out.success) {
        toast.error(out.message || t("coachPrefs.plan.errorCancel"));
        return;
      }
      toast.success(t("coachPrefs.plan.cancelSuccess"));
      await loadStatus();
    } finally {
      setCancelling(false);
    }
  };

  const generateStepLabel =
    generateStep === "state"
      ? t("coachPrefs.plan.stepState")
      : generateStep === "weekly"
        ? t("coachPrefs.plan.stepWeekly")
        : generateStep === "daily"
          ? t("coachPrefs.plan.stepDaily")
          : null;

  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 20,
        borderTop: `1px solid ${appColors.divider}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: appColors.textMuted,
          marginBottom: 10,
        }}
      >
        {t("coachPrefs.plan.sectionTitle")}
      </div>

      {statusLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
          <LoadingSpinner size="button" />
        </div>
      ) : status?.has_active_plan ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/coach/dailyPlan")}
              className="flex-1"
            >
              {t("coachPrefs.plan.goToDaily")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/coach/weeklyPlan")}
              className="flex-1"
            >
              {t("coachPrefs.plan.goToWeekly")}
            </Button>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full"
          >
            {cancelling ? <LoadingSpinner size="button" /> : t("coachPrefs.plan.cancelButton")}
          </Button>
        </>
      ) : status?.is_generated ? (
        <Button
          variant="primary"
          size="sm"
          onClick={handleActivate}
          disabled={activating}
          className="w-full"
        >
          {activating ? <LoadingSpinner size="button" /> : t("coachPrefs.plan.activateButton")}
        </Button>
      ) : (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full"
          >
            {generating ? <LoadingSpinner size="button" /> : t("coachPrefs.plan.generateButton")}
          </Button>
          {generating && generateStepLabel && (
            <div
              style={{
                fontSize: 11,
                color: appColors.textMuted,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              {generateStepLabel}
            </div>
          )}
        </>
      )}
    </div>
  );
}
