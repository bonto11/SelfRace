// src/app/features/coach/components/WidgetCoachPlan.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  WIDGET_ACTIONS_WRAP,
  WIDGET_ACTION_ROW,
  WIDGET_ACTION_ROW_INNER,
  WIDGET_ACTION_ROW_SURFACE,
  WIDGET_CTA_ROW,
  WIDGET_ERROR_LINE_COLORED,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  apiFetchUserPref,
  apiEnsureCoachPlanStartFuture,
} from "@/app/features/prefs/api/prefs";

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
import Link from "next/link";
import type { CoachPrefs } from "@/app/features/prefs/types/prefs";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useT } from "@/app/shared/i18n/useT";
import { cx } from "@/app/shared/ui/utils/inputs";

type LoadingKind = "analyze" | "weekly" | "daily" | "start" | "cancel" | "status" | null;

function readPrefsFromStorage(): CoachPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const rawUP = localStorage.getItem("up:coach.prefs");
    if (rawUP) return JSON.parse(rawUP);
    const raw = localStorage.getItem("coach.prefs");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function RowAction({
  onPrimary,
  primaryLabel,
  loading,
  disabled,
  title,
  status,
  highlight = false,
}: {
  onPrimary: () => void;
  primaryLabel: string;
  loading: boolean;
  disabled: boolean;
  title?: string;
  status: boolean | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cx(
        WIDGET_ACTION_ROW,
        WIDGET_ACTION_ROW_SURFACE,
        "rounded-xl border overflow-hidden transition-all bg-opacity-10" 
      )}
      style={{
        background: appColors.backgroundAlt, 
        borderColor: appColors.surfaceCardBorder, 
      }}
      title={title}
    >
      <div className={cx(WIDGET_ACTION_ROW_INNER, "flex items-center justify-between gap-2")}>
        <Button
          size="xs"
          variant={highlight ? "primary" : "secondary"}
          disabled={disabled}
          onClick={onPrimary}
          className="flex-1 !justify-start px-3"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              {primaryLabel}
            </span>
          ) : (
            primaryLabel
          )}
        </Button>

        {!loading && status !== null && (
          <div className="flex items-center pr-2 select-none w-8 justify-center">
            {status ? (
              <span style={{ color: appColors.statusSuccess }} className="text-lg font-bold">✓</span>
            ) : (
              <span style={{ color: appColors.statusError }} className="text-lg font-bold opacity-30">×</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WidgetCoachPlan() {
  const router = useRouter();
  const { userId, userUuid } = useUserId();
  const t = useT();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [latestStateId, setLatestStateId] = useState<number | null>(null);
  const [loadingKind, setLoadingKind] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPlanActive, setIsPlanActive] = useState(false);
  const [hasWeekly, setHasWeekly] = useState(false);
  const [hasDaily, setHasDaily] = useState(false);

  const [loadingMsgIdx, setLoadingMsgIdx] = useState(1);

  const loading = loadingKind !== null && loadingKind !== "status";

  useEffect(() => {
    if (loading) {
      setLoadingMsgIdx(Math.floor(Math.random() * 4) + 1);
    }
  }, [loading]);

  const formatAiError = useCallback((out: any): string => {
    if (!out) return t("api.ai_errors.generic_error" as any) || "Neznáma chyba";
    
    const code = out?.error_code || out?.code || "generic_error";
    const errorKey = `api.ai_errors.${code}`;
    const translatedError = t(errorKey as any);

    if (translatedError && translatedError !== errorKey) {
        return translatedError;
    }
    
    return out?.message || t("api.ai_errors.generic_error" as any) || "Neznáma chyba";
  }, [t]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const p = await apiFetchUserPref(userId, "coach.prefs").catch(() => null);
      setPrefs((p ?? readPrefsFromStorage()) as CoachPrefs);
    })();
  }, [userId]);

  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    setLoadingKind("status");
    try {
      const [state, planStatus] = await Promise.all([
        apiGetLatestAthleteState(userId).catch(() => null),
        apiActivePlanStatus(userId).catch(() => null)
      ]);

      if (state && typeof state.id === "number") setLatestStateId(state.id);
      
      if (planStatus) {
        setIsPlanActive(!!planStatus.has_active);
        setHasWeekly(!!planStatus.has_weekly_data);
        setHasDaily(!!planStatus.has_daily_data);
      }
    } finally {
      setLoadingKind(null);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleAnalyze = useCallback(async () => {
    if (!userId || !userUuid) return;
    setError(null);
    setLoadingKind("analyze");
    try {
      const out = await apiAnalyzeAthleteState(userId, userUuid, {
        debugRaw: false,
        explicitModel: "coach-analyze-stub",
      });
      
      if (!out?.success) {
          setError(formatAiError(out));
          return;
      }
      
      const sid = (out as any).data?.state_id ?? (out as any).state_id ?? (out as any).state?.id ?? null;
      if (typeof sid === "number") {
          setLatestStateId(sid);
      }
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, formatAiError]);

  const handleGenerateWeekly = useCallback(async () => {
    if (!userId || !userUuid) return;
    setError(null);
    setLoadingKind("weekly");
    try {
      await apiEnsureCoachPlanStartFuture(userId);
      const out = await apiGenerateWeeklyPlan(userId, userUuid, {
        overwrite: true,
        weeks: (prefs as any)?.weeks ?? 8,
        state_id: latestStateId,
      });

      if (!out?.success) {
          setError(formatAiError(out));
          return;
      }

      setHasWeekly(true);
      setHasDaily(false); 
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, prefs, latestStateId, formatAiError]);

  const handleGenerateDaily = useCallback(async () => {
    if (!userId || !userUuid) return;
    setError(null);
    setLoadingKind("daily");
    try {
      await apiEnsureCoachPlanStartFuture(userId);
      const out = await apiGenerateDailyForWeek(userId, userUuid, { week_index: 1, overwrite: true });
      
      if (!out?.success) {
          setError(formatAiError(out));
          return;
      }

      setHasDaily(true);
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, formatAiError]);

  const handleStartPlan = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setLoadingKind("start");
    try {
      const res = await apiActivePlanSave(userId, {});
      if (res.success) {
        await fetchStatus(); 
      } else {
        setError(res.error || "Nepodarilo sa spustiť plán.");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, fetchStatus]);

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

  const isStep0 = !latestStateId && !hasWeekly && !hasDaily;
  const isStep1 = !!latestStateId && !hasWeekly && !hasDaily;
  const isStep2 = !!latestStateId && hasWeekly && !hasDaily;
  const isStep3 = !!latestStateId && hasWeekly && hasDaily && !isPlanActive;

  const generatorsBlockedGlobally = isPlanActive || isGlobalLoading;

  const highlightAnalyze = isStep0;
  const highlightWeekly = isStep1;
  const highlightDaily = isStep2;

  const canCancel = (hasWeekly || hasDaily || isPlanActive) && !isGlobalLoading;

  const startDisabledReason = useMemo(() => {
    if (isPlanActive) return t("coachPlan.errors.alreadyActive" as any);
    if (!latestStateId) return "Najskôr vykonaj analýzu stavu.";
    if (!hasWeekly) return "Chýba vygenerovaný týždenný plán.";
    if (!hasDaily) return "Chýba vygenerovaný denný plán.";
    return null;
  }, [isPlanActive, latestStateId, hasWeekly, hasDaily, t]);

  return (
    <WidgetCard
      title={t("coachPlan.widget.title" as any)}
      accent="none"
      note={t("coachPlan.widget.note" as any)}
      minH={210}
    >
      {error && <div className={WIDGET_ERROR_LINE_COLORED}>{error}</div>}

      <div className={WIDGET_ACTIONS_WRAP}>
        
        <RowAction
          onPrimary={handleAnalyze}
          primaryLabel={loadingKind === "analyze" ? t("coachPlan.actions.analyzing" as any) : t("coachPlan.actions.analyze" as any)}
          loading={loadingKind === "analyze"}
          disabled={generatorsBlockedGlobally}
          status={!!latestStateId}
          highlight={highlightAnalyze}
        />

        <RowAction
          onPrimary={handleGenerateWeekly}
          primaryLabel={loadingKind === "weekly" ? t("coachPlan.actions.generatingWeekly" as any) : t("coachPlan.actions.generateWeekly" as any)}
          loading={loadingKind === "weekly"}
          disabled={isStep0 || generatorsBlockedGlobally}
          status={hasWeekly}
          highlight={highlightWeekly}
        />

        <RowAction
          onPrimary={handleGenerateDaily}
          primaryLabel={loadingKind === "daily" ? t("coachPlan.actions.generatingDaily" as any) : t("coachPlan.actions.generateDaily" as any)}
          loading={loadingKind === "daily"}
          disabled={isStep0 || isStep1 || generatorsBlockedGlobally}
          status={hasDaily}
          highlight={highlightDaily}
        />

        {loading && (
          <div className="text-[10px] text-center opacity-60 italic py-1">
            <span className="animate-pulse block text-white/80">
              {(t as any)(`coachPlan.widget.loading.msg${loadingMsgIdx}`)}
            </span>
          </div>
        )}

                <div className={WIDGET_CTA_ROW}>
          {isPlanActive ? (
            <Button
              size="xs"
              variant="primary" 
              onClick={() => router.push("/coach/ai/dailyPlan")}
              disabled={isGlobalLoading}
              className="flex-1"
            >
              {t("coachPlan.actions.openPlan" as any)}
            </Button>
          ) : (
            <Button
              size="xs"
              variant={isStep3 ? "primary" : "secondary"}
              disabled={!!startDisabledReason || isGlobalLoading}
              onClick={handleStartPlan}
              title={startDisabledReason ?? undefined}
              className="flex-1"
            >
              {loadingKind === "start" ? <LoadingSpinner size="button" /> : t("coachPlan.actions.startPlan" as any)}
            </Button>
          )}

          <Button
            size="xs"
            variant="danger"
            disabled={!canCancel || isGlobalLoading}
            onClick={handleCancelPlan}
            className="flex-1"
          >
            {loadingKind === "cancel" ? <LoadingSpinner size="button" /> : t("coachPlan.actions.cancelPlan" as any)}
          </Button>

          <Button
            size="xs"
            variant="secondary"
            disabled={isGlobalLoading}
            onClick={() => router.push("/coach/history")} 
            className="flex-1"
          >
            {t("coachPlan.actions.history" as any)}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200/90">
        <span className="shrink-0 text-base leading-none">💡</span>
        <div className="text-xs leading-relaxed">
          <strong className="font-semibold text-amber-400">
            {t("coachPlan.widget.tokenWarning.title" as any)}
          </strong>{" "}
          {t("coachPlan.widget.tokenWarning.text" as any)}
          <Link 
            href="/subscription" 
            className="underline decoration-amber-500/30 underline-offset-2 hover:text-amber-100 transition-colors"
          >
            {t("coachPlan.widget.tokenWarning.link" as any)}
          </Link>.
        </div>
      </div>
    </WidgetCard>
  );
}
