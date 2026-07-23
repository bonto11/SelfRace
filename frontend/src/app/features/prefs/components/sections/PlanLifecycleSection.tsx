// src/app/features/prefs/components/sections/PlanLifecycleSection.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import { apiEnsureCoachPlanStartFuture } from "@/app/features/prefs/api/prefs";
import {
  apiAnalyzeAthleteState,
  apiGetLatestAthleteState,
} from "@/app/features/coach/api/coach_athlete_state";
import {
  apiActivePlanSave,
  apiActivePlanCancel,
  apiActivePlanStatus,
} from "@/app/features/coach/api/coach_plan_active";
import { apiGenerateWeeklyPlan } from "@/app/features/coach/api/coach_plan_weekly";
import { apiGenerateDailyForWeek } from "@/app/features/coach/api/coach_plan_daily";
import { apiGetActiveHealthLogs } from "@/app/features/coach/api/users_health_log";

/* ============================================================ */
/* PLAN LIFECYCLE SEKCIA - jedno miesto na cely zivotny cyklus   */
/* planu (analyze -> weekly -> daily -> aktivovat -> zrusit).   */
/* Logika prevzata 1:1 z povodneho WidgetCoachActions.tsx, len   */
/* zlucena pod jedno "Vygenerovat plan" tlacidlo namiesto troch  */
/* samostatnych krokov ktore mylili userov (napr. zabudli ist    */
/* naspat aktivovat plan po vygenerovani).                       */
/* ============================================================ */

type LoadingKind = "generate" | "start" | "cancel" | "status" | null;

export default function PlanLifecycleSection({
  canGenerate,
}: {
  canGenerate: boolean;
}) {
  const router = useRouter();
  const { userId, userUuid } = useUserId();
  const t = useT();

  const [latestStateId, setLatestStateId] = useState<number | null>(null);
  const [loadingKind, setLoadingKind] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPlanActive, setIsPlanActive] = useState(false);
  const [hasWeekly, setHasWeekly] = useState(false);
  const [hasDaily, setHasDaily] = useState(false);

  const [maxInjurySeverity, setMaxInjurySeverity] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(1);

  const loading = loadingKind !== null && loadingKind !== "status";
  const isMedicalSuspend = maxInjurySeverity >= 7;

  useEffect(() => {
    if (loading) {
      setLoadingMsgIdx(Math.floor(Math.random() * 4) + 1);
    }
  }, [loading]);

  const formatAiError = useCallback(
    (out: any): string => {
      if (!out) return t("api.ai_errors.generic_error" as any);
      const code = out?.error_code || out?.code || "generic_error";
      const errorKey = `api.ai_errors.${code}`;
      const translated = t(errorKey as any);
      if (translated && translated !== errorKey) return translated;
      return out?.message || t("api.ai_errors.generic_error" as any);
    },
    [t],
  );

  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    setLoadingKind("status");
    try {
      const [state, planStatus, healthLogs] = await Promise.all([
        apiGetLatestAthleteState(userId).catch(() => null),
        apiActivePlanStatus(userId).catch(() => null),
        apiGetActiveHealthLogs(userId).catch(() => []),
      ]);

      if (state && typeof state.id === "number") setLatestStateId(state.id);

      if (planStatus) {
        setIsPlanActive(!!planStatus.has_active);
        setHasWeekly(!!planStatus.has_weekly_data);
        setHasDaily(!!planStatus.has_daily_data);
      }

      if (healthLogs && healthLogs.length > 0) {
        const maxSev = Math.max(...healthLogs.map((l: any) => l.severity || 0));
        setMaxInjurySeverity(maxSev);
      } else {
        setMaxInjurySeverity(0);
      }
    } finally {
      setLoadingKind(null);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Sekvenčné generovanie: analyze -> weekly -> daily (week 1), všetky tri
  // pod jedným tlačidlom namiesto troch oddelených krokov.
  const handleGenerate = useCallback(async () => {
    if (!userId || !userUuid || isMedicalSuspend || loading) return;
    setError(null);
    setLoadingKind("generate");
    try {
      const analyzeOut = await apiAnalyzeAthleteState(userId, userUuid);
      if (!analyzeOut?.success) {
        setError(formatAiError(analyzeOut));
        return;
      }
      const sid =
        (analyzeOut as any).data?.state_id ??
        (analyzeOut as any).state_id ??
        (analyzeOut as any).state?.id ??
        null;
      const stateId = typeof sid === "number" ? sid : latestStateId;
      if (typeof sid === "number") setLatestStateId(sid);

      await apiEnsureCoachPlanStartFuture(userId);
      const weeklyOut = await apiGenerateWeeklyPlan(userId, userUuid, {
        overwrite: true,
        state_id: stateId,
      });
      if (!weeklyOut?.success) {
        setError(formatAiError(weeklyOut));
        return;
      }
      setHasWeekly(true);

      await apiEnsureCoachPlanStartFuture(userId);
      const dailyOut = await apiGenerateDailyForWeek(userId, userUuid, {
        week_index: 1,
        overwrite: true,
      });
      if (!dailyOut?.success) {
        setError(formatAiError(dailyOut));
        return;
      }
      setHasDaily(true);
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, latestStateId, formatAiError, isMedicalSuspend, loading]);

  const handleStartPlan = useCallback(async () => {
    if (!userId || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("start");
    try {
      const res = await apiActivePlanSave(userId, {});
      if (res.success) {
        await fetchStatus();
      } else {
        setError(res.error || t("coachPlan.errors.genericStart" as any));
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, isMedicalSuspend, fetchStatus, t]);

  const handleCancelPlan = useCallback(async () => {
    if (!userId) return;
    const ok = await confirm({
      title: t("coachPlan.confirmCancel.title" as any),
      message: t("coachPlan.confirmCancel.message" as any),
      okText: t("coachPlan.confirmCancel.ok" as any),
      cancelText: t("coachPlan.confirmCancel.cancel" as any),
      tone: "danger",
    });
    if (!ok) return;

    setLoadingKind("cancel");
    try {
      await apiActivePlanCancel(userId);
      await fetchStatus();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, t, fetchStatus]);

  const isGlobalLoading = loading;
  const isFullyGenerated = !!latestStateId && hasWeekly && hasDaily;
  const canCancel = (hasWeekly || hasDaily || isPlanActive) && !isGlobalLoading;

  const startDisabledReason = useMemo(() => {
    if (isMedicalSuspend) return t("coachPlan.errors.medicalBlocked" as any);
    if (isPlanActive) return t("coachPlan.errors.alreadyActive" as any);
    if (!latestStateId) return t("coachPlan.errors.needAnalyze" as any);
    if (!hasWeekly) return t("coachPlan.errors.needWeekly" as any);
    if (!hasDaily) return t("coachPlan.errors.needDaily" as any);
    return null;
  }, [isPlanActive, latestStateId, hasWeekly, hasDaily, isMedicalSuspend, t]);

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
        {t("coachPlan.widget.title" as any)}
      </div>

      {isMedicalSuspend && (
        <div
          className="mb-2 p-3 rounded-xl border"
          style={{
            backgroundColor: `${appColors.statusError}1A`,
            borderColor: `${appColors.statusError}33`,
            color: appColors.statusError,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🛑</span>
            <strong className="text-sm">
              {t("coachPlan.widget.medicalSuspendBanner.title" as any)}
            </strong>
          </div>
          <p className="text-xs opacity-90 leading-relaxed mb-3">
            {(t("coachPlan.widget.medicalSuspendBanner.text" as any) as string).replace(
              "{{severity}}",
              String(maxInjurySeverity),
            )}
          </p>
          <Button
            size="sm"
            variant="danger"
            onClick={() => router.push("/coach/health")}
            className="w-full"
          >
            {t("coachPlan.widget.medicalSuspendBanner.action" as any)}
          </Button>
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 12,
            color: appColors.statusError,
            marginBottom: 8,
          }}
        >
          {error}
        </div>
      )}

      {!isMedicalSuspend && (
        <>
          {/* Prekliky na Weekly/Daily - VZDY viditeľné, nezavisle od stavu planu */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/coach/ai/dailyPlan")}
              disabled={isGlobalLoading}
              className="flex-1"
            >
              {t("coachPlan.actions.openPlan" as any)}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/coach/ai/weeklyPlan")}
              disabled={isGlobalLoading}
              className="flex-1"
            >
              {t("coachPrefs.plan.goToWeekly" as any)}
            </Button>
          </div>

          {/* Vygenerovat - VZDY viditelne, enabled len ked NIE JE aktivny plan
              A zaroven mame vyplneny race alebo start_date */}
          {!isPlanActive && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={isGlobalLoading || !canGenerate}
              title={!canGenerate ? t("coachPrefs.plan.needRaceOrDate" as any) : undefined}
              className="w-full mb-2"
            >
              {loadingKind === "generate" ? (
                <LoadingSpinner size="button" />
              ) : (
                t("coachPrefs.plan.generateButton" as any)
              )}
            </Button>
          )}

          {/* Aktivovat - viditelne len ked je plan plne vygenerovany ale este nie aktivny */}
          {!isPlanActive && isFullyGenerated && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartPlan}
              disabled={!!startDisabledReason || isGlobalLoading}
              title={startDisabledReason ?? undefined}
              className="w-full mb-2"
            >
              {loadingKind === "start" ? (
                <LoadingSpinner size="button" />
              ) : (
                t("coachPlan.actions.startPlan" as any)
              )}
            </Button>
          )}

          {/* Zrusit - viditelne/enabled len ked je plan AKTIVNY */}
          {isPlanActive && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelPlan}
              disabled={!canCancel}
              className="w-full"
            >
              {loadingKind === "cancel" ? (
                <LoadingSpinner size="button" />
              ) : (
                t("coachPlan.actions.cancelPlan" as any)
              )}
            </Button>
          )}

          {loading && (
            <div className="text-[10px] text-center opacity-60 italic py-1 mt-2">
              <span className="animate-pulse block text-white/80">
                {(t as any)(`coachPlan.widget.loading.msg${loadingMsgIdx}`)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}