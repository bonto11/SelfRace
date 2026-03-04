"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

import type { CoachPrefs, Injury } from "@/app/features/prefs/types/prefs";
import type { AnalyzeResult } from "@/app/features/coach/types/coachApiTypes";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useT } from "@/app/shared/i18n/useT";
import { cx } from "@/app/shared/ui/utils/inputs";

/* ---------- helpers ---------- */

type LoadingKind =
  | "analyze"
  | "weekly"
  | "daily"
  | "start"
  | "cancel"
  | "status"
  | null;

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
}: {
  onPrimary: () => void;
  primaryLabel: string;
  loading: boolean;
  disabled: boolean;
  title?: string;
  status: boolean | null;
}) {
  const frameStyle: React.CSSProperties = {
    background: appColors.backgroundAlt,
    borderColor: appColors.surfaceCardBorder,
  };

  return (
    <div
      className={cx(
        WIDGET_ACTION_ROW,
        WIDGET_ACTION_ROW_SURFACE,
        "rounded-xl border overflow-hidden transition-all"
      )}
      style={frameStyle}
      title={title}
    >
      <div className={cx(WIDGET_ACTION_ROW_INNER, "flex items-center justify-between gap-2")}>
        <Button
          size="xs"
          variant="secondary"
          disabled={disabled}
          onClick={onPrimary}
          title={title}
          className="flex-1"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <LoadingSpinner size="button" />
              {primaryLabel}
            </span>
          ) : (
            primaryLabel
          )}
        </Button>

        {!loading && status !== null && (
          <div className="flex items-center pr-1 select-none w-6 justify-center">
            {status ? (
              <span style={{ color: appColors.statusSuccess }} className="text-lg font-bold">✓</span>
            ) : (
              <span style={{ color: appColors.statusError }} className="text-lg font-bold opacity-50">×</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- main widget ---------- */

export default function WidgetCoachPlan() {
  const router = useRouter();
  const { userId, userUuid } = useUserId();
  const t = useT();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [latestStateId, setLatestStateId] = useState<number | null>(null);
  const [loadingKind, setLoadingKind] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [hasWeekly, setHasWeekly] = useState(false);
  const [hasDaily, setHasDaily] = useState(false);

  // ✅ Logika pre náhodnú hlášku
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(1);

  const LS_GEN_WEEKLY = "coach.generated.weekly";
  const LS_GEN_DAILY = "coach.generated.daily";

  const loading = loadingKind !== null && loadingKind !== "status";

  // Vyberieme náhodnú hlášku pri každom spustení loadingu
  useEffect(() => {
    if (loading) {
      setLoadingMsgIdx(Math.floor(Math.random() * 4) + 1);
    }
  }, [loading]);

  const maxInjurySeverity = useMemo(() => {
    if (!prefs?.injuries || !Array.isArray(prefs.injuries)) return 0;
    return Math.max(...prefs.injuries.map((i: any) => i.severity || 0), 0);
  }, [prefs]);

  const isMedicalSuspend = maxInjurySeverity >= 7;

  const formatAiError = useCallback((e: any): string => {
    const code = e?.code ?? (e && (e as any).code);
    if (code === "ai_quota_exceeded") {
      const used = (e as any).usedTokensThisMonth;
      return t("coachPlan.errors.aiQuota")
        .replace("{{tokens}}", used?.toLocaleString("sk-SK") || "0");
    }
    return e?.message || String(e);
  }, [t]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const p = await apiFetchUserPref(userId, "coach.prefs").catch(() => null);
        const eff = p ?? readPrefsFromStorage();
        setPrefs(eff as CoachPrefs | null);
      } catch {
        setPrefs(readPrefsFromStorage());
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const row = await apiGetLatestAthleteState(userId);
        if (!alive) return;
        if (row && typeof row.id === "number") setLatestStateId(row.id);
        else setLatestStateId(null);
      } catch (err) {
        if (alive) setLatestStateId(null);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasWeekly(!!localStorage.getItem(LS_GEN_WEEKLY));
    setHasDaily(!!localStorage.getItem(LS_GEN_DAILY));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoadingKind("status");
      try {
        const s = await apiActivePlanStatus(userId);
        if (!alive) return;
        const pid = s.has_active ? (s.plan_id ?? null) : null;
        setActivePlanId(pid);
        if (typeof window !== "undefined") {
          if (pid) localStorage.setItem("coach.active_plan_id", String(pid));
          else localStorage.removeItem("coach.active_plan_id");
        }
      } catch (e: any) {
        if (!alive) return;
      } finally {
        if (!alive) return;
        setLoadingKind(null);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const ensurePlanStartFuture = useCallback(async () => {
    if (!userId) return;
    try {
      const updated = await apiEnsureCoachPlanStartFuture(userId);
      if (updated) setPrefs(updated);
    } catch (e) {
      console.warn("[CoachPlan] ensurePlanStartFuture error", e);
    }
  }, [userId]);

  const markWeeklyGenerated = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_GEN_WEEKLY, "1");
    setHasWeekly(true);
  }, []);

  const markDailyGenerated = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_GEN_DAILY, "1");
    setHasDaily(true);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!userId || !userUuid || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("analyze");
    try {
      const json = await apiAnalyzeAthleteState(userId, userUuid, {
        debugRaw: false,
        explicitModel: "coach-analyze-stub",
      });
      setResult({
        analysis: json.state ?? null,
        model: json.model ?? null,
        state_id: json.state_id ?? null,
      });
      const sid = (json as any).state_id ?? (json as any).state?.id ?? null;
      if (typeof sid === "number") setLatestStateId(sid);
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, formatAiError, isMedicalSuspend]);

  const handleGenerateWeekly = useCallback(async () => {
    if (!userId || !userUuid || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("weekly");
    try {
      await ensurePlanStartFuture();
      const weeks = (prefs as any)?.weeks ?? null;
      const stateId = result?.state_id ?? latestStateId ?? null;
      await apiGenerateWeeklyPlan(userId, userUuid, {
        overwrite: true,
        weeks,
        state_id: stateId,
      });
      markWeeklyGenerated();
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, prefs, result, latestStateId, ensurePlanStartFuture, markWeeklyGenerated, formatAiError, isMedicalSuspend]);

  const handleGenerateDaily = useCallback(async () => {
    if (!userId || !userUuid || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("daily");
    try {
      await ensurePlanStartFuture();
      await apiGenerateDailyForWeek(userId, userUuid, {
        week_index: 1,
        plan_id: null,
        overwrite: true,
      });
      markDailyGenerated();
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, ensurePlanStartFuture, markDailyGenerated, formatAiError, isMedicalSuspend]);

  const planLocked = !!activePlanId;

  const isCriticallyInjured = useMemo(() => {
    if (!prefs || !Array.isArray((prefs as any).injuries)) return false;
    const injuries = (prefs as any).injuries as Injury[];
    return injuries.some(inj => (inj.severity ?? 0) >= 7);
  }, [prefs]);

  const injuryLockReason = isCriticallyInjured 
    ? "Generovanie zablokované: Máš nahlásené kritické zranenie." 
    : undefined;

  const canStartPlan = useMemo(() => {
    if (!userId || planLocked || isCriticallyInjured) return false;
    return !!(latestStateId && hasWeekly && hasDaily);
  }, [userId, planLocked, latestStateId, hasWeekly, hasDaily, isCriticallyInjured]);

  const startDisabledReason = useMemo(() => {
    if (!userId) return t("coachPlan.errors.missingUserId");
    if (isCriticallyInjured) return injuryLockReason;
    if (planLocked) return t("coachPlan.errors.alreadyActive");
    if (!latestStateId) return "Najskôr vykonaj analýzu stavu.";
    if (!hasWeekly) return "Chýba vygenerovaný týždenný plán.";
    if (!hasDaily) return "Chýba vygenerovaný denný plán.";
    return null;
  }, [userId, planLocked, latestStateId, hasWeekly, hasDaily, isCriticallyInjured, injuryLockReason, t]);

  const handleStartPlan = useCallback(async () => {
    if (!userId || isMedicalSuspend || !canStartPlan) return;
    setError(null);
    setLoadingKind("start");
    try {
      const res = await apiActivePlanSave(userId, {});
      const pid = res.plan_id ?? null;
      setActivePlanId(pid);
      if (typeof window !== "undefined" && pid) localStorage.setItem("coach.active_plan_id", pid);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, canStartPlan, isMedicalSuspend]);

  const handleCancelPlan = useCallback(async () => {
    if (!userId || !activePlanId) return;
    setError(null);
    const ok = await confirm({
      title: t("coachPlan.confirmCancel.title"),
      message: t("coachPlan.confirmCancel.message"),
      okText: t("coachPlan.confirmCancel.ok"),
      cancelText: t("coachPlan.confirmCancel.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    setLoadingKind("cancel");
    try {
      await apiActivePlanCancel(userId, activePlanId);
      setActivePlanId(null);
      if (typeof window !== "undefined") localStorage.removeItem("coach.active_plan_id");
      try {
        const stat = await apiActivePlanStatus(userId);
        setActivePlanId(stat.has_active ? (stat.plan_id ?? null) : null);
      } catch {}
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, activePlanId, t]);

  const disabled = !userId || loading;
  const generatorsDisabled = disabled || planLocked || isCriticallyInjured;
  const lockReason = planLocked ? t("coachPlan.lockReason") : injuryLockReason;

  return (
    <WidgetCard
      title={t("coachPlan.widget.title")}
      tooltip={t("coachPlan.widget.tooltip")}
      accent={isMedicalSuspend ? "danger" : "none"}
      note={t("coachPlan.widget.note")}
      interactive={false}
      minH={210}
    >
      {error && <div className={WIDGET_ERROR_LINE_COLORED}>{error}</div>}

      {isCriticallyInjured && (
        <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium text-center">
          ⚠️ {injuryLockReason}
        </div>
      )}

      <div className={WIDGET_ACTIONS_WRAP}>
        <RowAction
          onPrimary={handleAnalyze}
          primaryLabel={loadingKind === "analyze" ? t("coachPlan.actions.analyzing") : t("coachPlan.actions.analyze")}
          loading={loadingKind === "analyze"}
          disabled={generatorsDisabled}
          title={lockReason}
          status={!!latestStateId}
        />

        <RowAction
          onPrimary={handleGenerateWeekly}
          primaryLabel={loadingKind === "weekly" ? t("coachPlan.actions.generatingWeekly") : t("coachPlan.actions.generateWeekly")}
          loading={loadingKind === "weekly"}
          disabled={generatorsDisabled}
          title={lockReason}
          status={hasWeekly}
        />

        <RowAction
          onPrimary={handleGenerateDaily}
          primaryLabel={loadingKind === "daily" ? t("coachPlan.actions.generatingDaily") : t("coachPlan.actions.generateDaily")}
          loading={loadingKind === "daily"}
          disabled={generatorsDisabled}
          title={lockReason}
          status={hasDaily}
        />

        {/* ✅ DYNAMICKÁ HLÁŠKA + TIME NOTE */}
        {loading && (
           <div className="text-[10px] text-center opacity-60 italic py-1 leading-relaxed">
             <span className="animate-pulse block text-white/80">
                {(t as any)(`coachPlan.loading.msg.${loadingMsgIdx}`)}
             </span>
             <span className="block mt-0.5">
                {t("coachPlan.widget.timeNote")}
             </span>
           </div>
        )}

        <div className={WIDGET_CTA_ROW}>
          <Button
            size="xs"
            variant="primary"
            disabled={disabled || !canStartPlan || isMedicalSuspend}
            onClick={handleStartPlan}
            title={!canStartPlan ? (startDisabledReason ?? undefined) : t("coachPlan.actions.startPlan")}
          >
            {loadingKind === "start" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                {t("coachPlan.actions.startingPlan")}
              </span>
            ) : planLocked ? (
              t("coachPlan.actions.activePlan")
            ) : (
              t("coachPlan.actions.startPlan")
            )}
          </Button>

          <Button
            size="xs"
            variant="primary"
            disabled={disabled}
            onClick={() => router.push("/coach/ai/dailyPlan")}
            title={t("coachPlan.actions.openPlan")}
          >
            {t("coachPlan.actions.openPlan")}
          </Button>

          <Button
            size="xs"
            variant="danger"
            disabled={!planLocked || loadingKind === "cancel"}
            onClick={handleCancelPlan}
          >
            {loadingKind === "cancel" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                {t("coachPlan.actions.cancellingPlan")}
              </span>
            ) : (
              t("coachPlan.actions.cancelPlan")
            )}
          </Button>
        </div>

        {planLocked && !isCriticallyInjured && (
          <div className="text-[11px] text-center opacity-70 mt-1">{lockReason}</div>
        )}
      </div>
    </WidgetCard>
  );
}