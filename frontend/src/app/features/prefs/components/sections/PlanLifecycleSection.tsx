// src/app/features/prefs/components/sections/PlanLifecycleSection.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import DateField from "@/app/shared/ui/components/DateField";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useCoachDataOptional } from "@/app/shared/components/dataProviders/CoachDataProvider";

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
import { apiStartManualPlan } from "@/app/features/coach/api/advisor_daily";
import { apiGetActiveHealthLogs } from "@/app/features/coach/api/users_health_log";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";

type LoadingKind = "generate" | "start" | "cancel" | "status" | null;

/** Lokálny dnešný dátum (nie UTC) vo formáte YYYY-MM-DD. */
function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDay(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function PlanLifecycleSection({
  prefs,
}: {
  prefs: {
    start_date?: string | null;
    targets?: { run?: { races?: any[] } };
    coach_mode?: "coach" | "advisor";
  };
}) {
  const router = useRouter();
  const { userId, userUuid } = useUserId();
  const t = useT();
  const locale = (t("common.locale" as any) as string) || "sk-SK";

  const coach = useCoachDataOptional();
  const refreshCoach = useCallback(() => {
    void coach?.refresh(true);
  }, [coach]);

  const isAdvisor = prefs?.coach_mode === "advisor";

  const canGenerate = useMemo(() => {
    const hasStartDate = !!(prefs?.start_date && prefs.start_date.trim());
    const races = prefs?.targets?.run?.races;
    const hasRace = Array.isArray(races) && races.length > 0;
    return hasStartDate || hasRace;
  }, [prefs?.start_date, prefs?.targets]);

  // 🌟 NOVÉ: advisor - najbližšie budúce preteky (A-priorita má prednosť)
  // ako predvyplnený koniec plánu
  const nearestRaceDate = useMemo(() => {
    const races = Array.isArray(prefs?.targets?.run?.races) ? prefs!.targets!.run!.races! : [];
    const today = todayIsoLocal();
    const future = races
      .filter((r: any) => r?.date && String(r.date).slice(0, 10) >= today)
      .sort(
        (a: any, b: any) =>
          (a.priority === "A" ? 0 : 1) - (b.priority === "A" ? 0 : 1) ||
          String(a.date).localeCompare(String(b.date)),
      );
    return future[0] ? String(future[0].date).slice(0, 10) : "";
  }, [prefs?.targets]);

  const [latestStateId, setLatestStateId] = useState<number | null>(null);
  const [loadingKind, setLoadingKind] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [isPlanActive, setIsPlanActive] = useState(false);
  const [hasWeekly, setHasWeekly] = useState(false);
  const [hasDaily, setHasDaily] = useState(false);
  const [activeMeta, setActiveMeta] = useState<any>(null);

  const [maxInjurySeverity, setMaxInjurySeverity] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(1);
  const [loadingStepLabel, setLoadingStepLabel] = useState<string | null>(null);

  // 🌟 NOVÉ: advisor - voliteľný koniec plánu
  const [advisorEnd, setAdvisorEnd] = useState<string>("");
  const advisorEndTouched = useRef(false);

  useEffect(() => {
    if (!advisorEndTouched.current && nearestRaceDate) {
      setAdvisorEnd(nearestRaceDate);
    }
  }, [nearestRaceDate]);

  const loading = loadingKind !== null && loadingKind !== "status";
  const isMedicalSuspend = maxInjurySeverity >= 7;
  const blockActions = isMedicalSuspend && !isAdvisor;

  const dailyRoute = isAdvisor ? "/coach/advisor/daily" : "/coach/ai/dailyPlan";

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
        setActiveMeta(planStatus.has_active ? (planStatus as any).meta ?? null : null);
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

  const handleGenerate = useCallback(async () => {
    if (!userId || !userUuid || isMedicalSuspend || loading) return;
    setError(null);
    setQuotaExceeded(false);
    setLoadingKind("generate");

    setLoadingStepLabel(t("prefs.sections.planLifecycleSection.step1of3" as any));
    const stepTimer2 = setTimeout(() => {
      setLoadingStepLabel(t("prefs.sections.planLifecycleSection.step2of3" as any));
    }, 20000);
    const stepTimer3 = setTimeout(() => {
      setLoadingStepLabel(t("prefs.sections.planLifecycleSection.step3of3" as any));
    }, 40000);

    try {
      const analyzeOut = await apiAnalyzeAthleteState(userId, userUuid);
      if (!analyzeOut?.success) {
        setError(formatAiError(analyzeOut));
        if ((analyzeOut as any)?.code === "ai_quota_exceeded") setQuotaExceeded(true);
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
        full_reset: true,
        state_id: stateId,
      });
      if (!weeklyOut?.success) {
        setError(formatAiError(weeklyOut));
        if ((weeklyOut as any)?.code === "ai_quota_exceeded") setQuotaExceeded(true);
        return;
      }
      setHasWeekly(true);

      const newPlanMetaId = (weeklyOut as any)?.plan_meta_id ?? null;

      await apiEnsureCoachPlanStartFuture(userId);
      const dailyOut = await apiGenerateDailyForWeek(userId, userUuid, {
        week_index: 1,
        overwrite: true,
        plan_meta_id: newPlanMetaId,
      });
      if (!dailyOut?.success) {
        setError(formatAiError(dailyOut));
        if ((dailyOut as any)?.code === "ai_quota_exceeded") setQuotaExceeded(true);
        return;
      }
      setHasDaily(true);
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setLoadingKind(null);
      setLoadingStepLabel(null);
      refreshCoach();
    }
  }, [userId, userUuid, latestStateId, formatAiError, isMedicalSuspend, loading, t, refreshCoach]);

  const handleStartPlan = useCallback(async () => {
    if (!userId || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("start");
    try {
      const res = await apiActivePlanSave(userId, {});
      if (res.success) {
        await fetchStatus();
        refreshCoach();
      } else {
        setError(res.error || t("prefs.sections.planLifecycleSection.errors.genericStart" as any));
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, isMedicalSuspend, fetchStatus, t, refreshCoach]);

  // "Začať plán" v advisor režime - prázdny aktívny plán bez AI
  const handleStartManual = useCallback(async () => {
    if (!userId || loading) return;
    setError(null);

    if (advisorEnd && advisorEnd < todayIsoLocal()) {
      setError(t("prefs.sections.planLifecycleSection.errors.invalidEndDate" as any));
      return;
    }

    setLoadingKind("start");
    try {
      const res = await apiStartManualPlan(userId, { end_date: advisorEnd || null });
      if (res.success) {
        await fetchStatus();
        refreshCoach();
        router.push("/coach/advisor/daily");
        return;
      }
      if (res.error_code === "not_advisor_mode") {
        setError(t("prefs.sections.planLifecycleSection.errors.advisorNotSaved" as any));
      } else if (res.error_code === "active_plan_exists") {
        setError(t("prefs.sections.planLifecycleSection.errors.alreadyActive" as any));
      } else if (res.error_code === "invalid_end_date") {
        setError(t("prefs.sections.planLifecycleSection.errors.invalidEndDate" as any));
      } else {
        setError(res.message || t("prefs.sections.planLifecycleSection.errors.genericStart" as any));
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, loading, advisorEnd, fetchStatus, refreshCoach, router, t]);

  const handleCancelPlan = useCallback(async () => {
    if (!userId) return;
    // nespustený plán sa len zahodí, aktívny sa archivuje - iný text
    const kind = isPlanActive ? "confirmCancel" : "confirmCancelDraft";
    const ok = await confirm({
      title: t(`prefs.sections.planLifecycleSection.${kind}.title` as any),
      message: t(`prefs.sections.planLifecycleSection.${kind}.message` as any),
      okText: t(`prefs.sections.planLifecycleSection.${kind}.ok` as any),
      cancelText: t("prefs.sections.planLifecycleSection.confirmCancel.cancel" as any),
      tone: "danger",
    });
    if (!ok) return;

    setLoadingKind("cancel");
    try {
      await apiActivePlanCancel(userId);
      await fetchStatus();
      refreshCoach();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, t, fetchStatus, refreshCoach, isPlanActive]);

  const isGlobalLoading = loading;
  const isFullyGenerated = !!latestStateId && hasWeekly && hasDaily;
  const canCancel = (hasWeekly || hasDaily || isPlanActive) && !isGlobalLoading;

  const startDisabledReason = useMemo(() => {
    if (isMedicalSuspend) return t("prefs.sections.planLifecycleSection.errors.medicalBlocked" as any);
    if (isPlanActive) return t("prefs.sections.planLifecycleSection.errors.alreadyActive" as any);
    if (!latestStateId) return t("prefs.sections.planLifecycleSection.errors.needAnalyze" as any);
    if (!hasWeekly) return t("prefs.sections.planLifecycleSection.errors.needWeekly" as any);
    if (!hasDaily) return t("prefs.sections.planLifecycleSection.errors.needDaily" as any);
    return null;
  }, [isPlanActive, latestStateId, hasWeekly, hasDaily, isMedicalSuspend, t]);

  const advisorRunningText = useMemo(() => {
    if (!isAdvisor || !isPlanActive || !activeMeta) return null;
    const start = formatDay(activeMeta.start_date, locale);
    const end = activeMeta.end_date
      ? formatDay(activeMeta.end_date, locale)
      : t("prefs.sections.planLifecycleSection.advisorNoEnd" as any);
    return (t("prefs.sections.planLifecycleSection.advisorRunning" as any) as string)
      .replace("{{start}}", start)
      .replace("{{end}}", end);
  }, [isAdvisor, isPlanActive, activeMeta, locale, t]);

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
        {t("prefs.sections.planLifecycleSection.title" as any)}
      </div>

      {!isAdvisor && <AiUsageWarningBanner forceShow={quotaExceeded} className="mb-3" />}

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
              {t("prefs.sections.planLifecycleSection.medicalSuspendBanner.title" as any)}
            </strong>
          </div>
          <p className="text-xs opacity-90 leading-relaxed mb-3">
            {(
              t(
                (isAdvisor
                  ? "prefs.sections.planLifecycleSection.medicalSuspendBanner.textAdvisor"
                  : "prefs.sections.planLifecycleSection.medicalSuspendBanner.text") as any,
              ) as string
            ).replace("{{severity}}", String(maxInjurySeverity))}
          </p>
          <Button
            size="sm"
            variant="danger"
            onClick={() => router.push("/coach/health")}
            className="w-full"
          >
            {t("prefs.sections.planLifecycleSection.medicalSuspendBanner.action" as any)}
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

      {!blockActions && (
        <>
          {/* Bez spusteného plánu niet čo otvárať - denný plán sa ukáže až po
              začatí, týždenný (náhľad) len keď je už vygenerovaný */}
          {(isPlanActive || (!isAdvisor && hasWeekly)) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {isPlanActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(dailyRoute)}
              disabled={isGlobalLoading}
              className="flex-1"
            >
              {t("prefs.sections.planLifecycleSection.actions.openPlan" as any)}
            </Button>
            )}
            {!isAdvisor && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/coach/ai/weeklyPlan")}
                disabled={isGlobalLoading}
                className="flex-1"
              >
                {t("prefs.sections.planLifecycleSection.goToWeekly" as any)}
              </Button>
            )}
          </div>
          )}

          {/* ADVISOR: plán beží */}
          {advisorRunningText && (
            <div className="text-xs opacity-70 text-center mb-2">{advisorRunningText}</div>
          )}

          {/* ADVISOR: voliteľný koniec + Začať plán */}
          {isAdvisor && !isPlanActive && (
            <div className="flex flex-col gap-2 mb-2">
              <div>
                <div className="text-xs opacity-60 mb-1">
                  {t("prefs.sections.planLifecycleSection.advisorEndLabel" as any)}
                </div>
                <DateField
                  value={advisorEnd}
                  onChange={(v: string | null) => {
                    advisorEndTouched.current = true;
                    setAdvisorEnd(v ?? "");
                  }}
                />
                  {advisorEnd && (
                    <button
                      type="button"
                      onClick={() => {
                        advisorEndTouched.current = true;
                        setAdvisorEnd("");
                      }}
                      className="text-[11px] underline opacity-60 hover:opacity-100 self-start mt-1"
                    >
                      {t("prefs.sections.planLifecycleSection.advisorClearEnd" as any)}
                    </button>
                  )}

                <div className="text-[11px] opacity-50 mt-1 leading-snug">
                  {t("prefs.sections.planLifecycleSection.advisorEndHint" as any)}
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleStartManual}
                disabled={isGlobalLoading}
                className="w-full"
              >
                {loadingKind === "start" ? (
                  <LoadingSpinner size="button" />
                ) : (
                  t("prefs.sections.planLifecycleSection.actions.startManual" as any)
                )}
              </Button>
              <div className="text-[11px] opacity-60 text-center">
                {t("prefs.sections.planLifecycleSection.advisorHint" as any)}
              </div>
            </div>
          )}

          {/* COACH: Vygenerovať */}
          {!isAdvisor && !isPlanActive && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={isGlobalLoading || !canGenerate}
              title={
                !canGenerate
                  ? t("prefs.sections.planLifecycleSection.needRaceOrDate" as any)
                  : undefined
              }
              className="w-full mb-2"
            >
              {loadingKind === "generate" ? (
                <LoadingSpinner size="button" />
              ) : (
                t("prefs.sections.planLifecycleSection.generateButton" as any)
              )}
            </Button>
          )}

          {/* COACH: Aktivovať - len po plnom vygenerovaní */}
          {!isAdvisor && !isPlanActive && isFullyGenerated && (
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
                t("prefs.sections.planLifecycleSection.actions.startPlan" as any)
              )}
            </Button>
          )}

          {/* Zrušiť - aktívny plán (oba režimy) aj vygenerovaný, ešte
              nespustený plán (coach), aby sa ho dalo zbaviť bez spustenia */}
          {(isPlanActive || (!isAdvisor && (hasWeekly || hasDaily))) && (
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
                t("prefs.sections.planLifecycleSection.actions.cancelPlan" as any)
              )}
            </Button>
          )}

          {loading && !isAdvisor && (
            <div className="text-[10px] text-center opacity-60 italic py-1 mt-2">
              <span className="animate-pulse block text-white/80">
                {loadingKind === "generate" && loadingStepLabel
                  ? loadingStepLabel
                  : (t as any)(`prefs.sections.planLifecycleSection.loading.msg${loadingMsgIdx}`)}
              </span>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/coach/history")}
            disabled={isGlobalLoading}
            className="w-full mt-2"
          >
            {t("prefs.sections.planLifecycleSection.historyButton" as any)}
          </Button>
        </>
      )}
    </div>
  );
}
