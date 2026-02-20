// src/features/coach/components/WidgetCoachPlan.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import Pill from "@/app/shared/ui/components/Pill";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_STATUS_ROW,
  WIDGET_ACTIONS_WRAP,
  WIDGET_ACTION_ROW,
  WIDGET_ACTION_ROW_INNER,
  WIDGET_ACTION_ROW_SURFACE,
  WIDGET_CTA_ROW,
  WIDGET_ERROR_LINE_COLORED,
} from "@/app/shared/ui/tokens";

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

function PrefsMiniInline({ prefs }: { prefs: CoachPrefs | null }) {
  const t = useT();
  if (!prefs) return <span className="text-xs opacity-70">{t("coachPlan.prefs.empty")}</span>;

  const main = (prefs as any).main_sport ?? prefs.main_sport?.[0] ?? "—";
  const goal = (prefs as any).goal_kind ?? "—";
  const weeks = (prefs as any).weeks ?? "—";

  return (
    <span className="text-[11px] opacity-80">
      {t("coachPlan.prefs.goal")}: <span className="font-semibold">{goal}</span> • {t("coachPlan.prefs.weeks")}:{" "}
      <span className="font-semibold">{weeks}</span> • {t("coachPlan.prefs.main")}:{" "}
      <span className="font-semibold">{main}</span>
    </span>
  );
}

function RowAction({
  onPrimary,
  primaryLabel,
  loading,
  disabled,
  title,
}: {
  onPrimary: () => void;
  primaryLabel: string;
  loading: boolean;
  disabled: boolean;
  title?: string;
}) {
  const frameStyle: React.CSSProperties = {
    background: appColors.backgroundAlt,
    borderColor: appColors.surfaceCardBorder,
  };

  return (
    <div
      className={[
        WIDGET_ACTION_ROW,
        WIDGET_ACTION_ROW_SURFACE,
        "rounded-xl border overflow-hidden",
      ].join(" ")}
      style={frameStyle}
      title={title}
    >
      <div className={WIDGET_ACTION_ROW_INNER}>
        <Button
          size="xs"
          variant="secondary"
          disabled={disabled}
          onClick={onPrimary}
          title={title}
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

  const LS_GEN_WEEKLY = "coach.generated.weekly";
  const LS_GEN_DAILY = "coach.generated.daily";

  // ✅ Detekcia kritického zranenia
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
      } catch {
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
        console.warn("[CoachPlan] active status error:", e?.message || String(e));
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

  // ✅ Detekcia kritického zranenia (7+) priamo z prefs
  const isCriticallyInjured = useMemo(() => {
    if (!prefs || !Array.isArray((prefs as any).injuries)) return false;
    const injuries = (prefs as any).injuries as Injury[];
    return injuries.some(inj => (inj.severity ?? 0) >= 7);
  }, [prefs]);

  const injuryLockReason = isCriticallyInjured 
    ? "Generovanie zablokované: Máš nahlásené kritické zranenie. Zmaž ho z profilu." 
    : undefined;

  const canStartPlan = useMemo(() => {
    if (!userId || planLocked || !latestStateId || !hasWeekly || !hasDaily || isCriticallyInjured) return false;
    return true;
  }, [userId, planLocked, latestStateId, hasWeekly, hasDaily, isCriticallyInjured]);

  const startDisabledReason = useMemo(() => {
    if (!userId) return t("coachPlan.errors.missingUserId");
    if (isCriticallyInjured) return injuryLockReason;
    if (planLocked) return t("coachPlan.errors.alreadyActive");
    if (!latestStateId) return t("coachPlan.errors.needAnalyze");
    if (!hasWeekly && !hasDaily) return t("coachPlan.errors.needBoth");
    if (!hasWeekly) return t("coachPlan.errors.needWeekly");
    if (!hasDaily) return t("coachPlan.errors.needDaily");
    return null;
  }, [userId, planLocked, latestStateId, hasWeekly, hasDaily, t, isCriticallyInjured, injuryLockReason]);

  const handleStartPlan = useCallback(async () => {
    if (!userId || isMedicalSuspend) return;
    setError(null);
    if (!canStartPlan) {
      setError(startDisabledReason || t("coachPlan.errors.genericStart"));
      return;
    }
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
  }, [userId, canStartPlan, startDisabledReason, t, isMedicalSuspend]);

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

  const loading = loadingKind !== null && loadingKind !== "status";
  
  // ✅ Pôvodná premenná `disabled`, ktorá chýbala
  const disabled = !userId || loading;
  
  // ✅ Celkové blokovanie generátorov ak je aktívny plán ALEBO kritické zranenie
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

      {/* ✅ Jasné varovanie pre používateľa, ak má 7+ bolesť */}
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
        />

        <RowAction
          onPrimary={handleGenerateWeekly}
          primaryLabel={loadingKind === "weekly" ? t("coachPlan.actions.generatingWeekly") : t("coachPlan.actions.generateWeekly")}
          loading={loadingKind === "weekly"}
          disabled={generatorsDisabled}
          title={lockReason}
        />

        <RowAction
          onPrimary={handleGenerateDaily}
          primaryLabel={loadingKind === "daily" ? t("coachPlan.actions.generatingDaily") : t("coachPlan.actions.generateDaily")}
          loading={loadingKind === "daily"}
          disabled={generatorsDisabled}
          title={lockReason}
        />

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
          <div className="text-[11px] opacity-70">{lockReason}</div>
        )}

        {!planLocked && (!hasWeekly || !hasDaily) && (
          <div className="text-[11px] opacity-70">
            {t("coachPlan.requirements.title")}:{" "}
            <span className="font-semibold">
              {latestStateId ? `${t("coachPlan.requirements.analyze")} ✓` : t("coachPlan.requirements.analyze")}
            </span>
            {" • "}
            <span className="font-semibold">
              {hasWeekly ? `${t("coachPlan.requirements.weekly")} ✓` : t("coachPlan.requirements.weekly")}
            </span>
            {" • "}
            <span className="font-semibold">
              {hasDaily ? `${t("coachPlan.requirements.daily")} ✓` : t("coachPlan.requirements.daily")}
            </span>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

/* ---------- localStorage flags ---------- */
const LS_GEN_WEEKLY = "coach.generated.weekly";
const LS_GEN_DAILY = "coach.generated.daily";
const LS_GEN_ANY = "coach.generated";

function readBoolLS(key: string): boolean {
  if (typeof window === "undefined") return false;
  try { return !!localStorage.getItem(key); } catch { return false; }
}
