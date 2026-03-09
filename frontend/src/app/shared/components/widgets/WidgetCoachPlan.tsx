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
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useT } from "@/app/shared/i18n/useT";
import { cx } from "@/app/shared/ui/utils/inputs";

/* ---------- helpers ---------- */

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
  highlight = false, // ✅ Zostalo pre tlačidlo, ale zrušíme ho z pozadia riadku
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
        "rounded-xl border overflow-hidden transition-all bg-opacity-10" // Vrátené na pôvodné
      )}
      style={{
        background: appColors.backgroundAlt, // Vrátené na pôvodné, už to nepodfarbuje celý riadok
        borderColor: appColors.surfaceCardBorder, // Vrátené na pôvodné
      }}
      title={title}
    >
      <div className={cx(WIDGET_ACTION_ROW_INNER, "flex items-center justify-between gap-2")}>
        <Button
          size="xs"
          // ✅ Tlačidlo zostáva "kričať" (primary), ak je to krok, ktorý nasleduje
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

/* ---------- main widget ---------- */

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

  // Animácia načítavania
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
    const code = e?.code ?? (e as any)?.code;
    if (code === "ai_quota_exceeded") {
      const used = (e as any).usedTokensThisMonth;
      return t("coachPlan.errors.aiQuota").replace("{{tokens}}", used?.toLocaleString("sk-SK") || "0");
    }
    return e?.message || String(e);
  }, [t]);

  // 1. Load Prefs
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const p = await apiFetchUserPref(userId, "coach.prefs").catch(() => null);
      setPrefs((p ?? readPrefsFromStorage()) as CoachPrefs);
    })();
  }, [userId]);

  // 2. Load Status (Zjednotené volanie)
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
    if (!userId || !userUuid || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("analyze");
    try {
      const json = await apiAnalyzeAthleteState(userId, userUuid, {
        debugRaw: false,
        explicitModel: "coach-analyze-stub",
      });
      const sid = (json as any).state_id ?? (json as any).state?.id ?? null;
      if (typeof sid === "number") {
          setLatestStateId(sid);
          // Po novej analýze, ak boli staré plány, tak už zrejme nesedia s analýzou, 
          // ale necháme to na užívateľovi, či dá Cancel. Zatiaľ len updatneme UI.
      }
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
      await apiEnsureCoachPlanStartFuture(userId);
      await apiGenerateWeeklyPlan(userId, userUuid, {
        overwrite: true,
        weeks: (prefs as any)?.weeks ?? 8,
        state_id: latestStateId,
      });
      setHasWeekly(true);
      // Ak pregenerujeme weekly, daily už nesedí, malo by sa logicky pregenerovať tiež
      setHasDaily(false); 
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, prefs, latestStateId, formatAiError, isMedicalSuspend]);

  const handleGenerateDaily = useCallback(async () => {
    if (!userId || !userUuid || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("daily");
    try {
      await apiEnsureCoachPlanStartFuture(userId);
      await apiGenerateDailyForWeek(userId, userUuid, { week_index: 1, overwrite: true });
      setHasDaily(true);
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, formatAiError, isMedicalSuspend]);

  const handleStartPlan = useCallback(async () => {
    if (!userId || isMedicalSuspend) return;
    setError(null);
    setLoadingKind("start");
    try {
      const res = await apiActivePlanSave(userId, {});
      if (res.success) setIsPlanActive(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, isMedicalSuspend]);

  const handleCancelPlan = useCallback(async () => {
    if (!userId) return;
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
      await apiActivePlanCancel(userId);
      // Zhodíme celý frontend state do KROKU 0
      setIsPlanActive(false);
      setHasWeekly(false);
      setHasDaily(false);
      // Analyzu (latestStateId) si môže nechať, tá sa mazať nemusí, len plán
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, t]);

  // ✅ LOGIKA KROKOV (STATE MACHINE)
  const isGlobalLoading = loading;

  // KROK 0: Ešte nemáme nič.
  const isStep0 = !latestStateId && !hasWeekly && !hasDaily;
  // KROK 1: Máme len analýzu, čakáme na Weekly.
  const isStep1 = !!latestStateId && !hasWeekly && !hasDaily;
  // KROK 2: Máme Weekly, čakáme na Daily.
  const isStep2 = !!latestStateId && hasWeekly && !hasDaily;
  // KROK 3: Máme všetko, čakáme len na Štart.
  const isStep3 = !!latestStateId && hasWeekly && hasDaily && !isPlanActive;

  // Ak je plán už aktívny, zablokujeme všetky generátory.
  const generatorsBlockedGlobally = isPlanActive || isMedicalSuspend || isGlobalLoading;

  // Highlight logiky (Ktoré tlačidlo má "kričať")
  const highlightAnalyze = isStep0;
  const highlightWeekly = isStep1;
  const highlightDaily = isStep2;

  // Môžeme zrušiť plán, ak sa začal generovať (máme aspoň Weekly) ALEBO ak je už aktívny.
  const canCancel = (hasWeekly || hasDaily || isPlanActive) && !isGlobalLoading;

  const startDisabledReason = useMemo(() => {
    if (isMedicalSuspend) return "Kritické zranenie: Tréning pozastavený.";
    if (isPlanActive) return t("coachPlan.errors.alreadyActive");
    if (!latestStateId) return "Najskôr vykonaj analýzu stavu.";
    if (!hasWeekly) return "Chýba vygenerovaný týždenný plán.";
    if (!hasDaily) return "Chýba vygenerovaný denný plán.";
    return null;
  }, [isPlanActive, latestStateId, hasWeekly, hasDaily, isMedicalSuspend, t]);

  return (
    <WidgetCard
      title={t("coachPlan.widget.title")}
      accent={isMedicalSuspend ? "danger" : "none"}
      note={t("coachPlan.widget.note")}
      minH={210}
    >
      {error && <div className={WIDGET_ERROR_LINE_COLORED}>{error}</div>}

      <div className={WIDGET_ACTIONS_WRAP}>
        
        {/* KROK 1: Analýza */}
        <RowAction
          onPrimary={handleAnalyze}
          primaryLabel={loadingKind === "analyze" ? t("coachPlan.actions.analyzing") : t("coachPlan.actions.analyze")}
          loading={loadingKind === "analyze"}
          // Je to ghost tlačidlo, ak sme ďalej. Ale nedovolíme klikať na analýzu, ak je plán aktívny, alebo ak sa niečo nahráva.
          disabled={generatorsBlockedGlobally}
          status={!!latestStateId}
          highlight={highlightAnalyze}
        />

        {/* KROK 2: Weekly */}
        <RowAction
          onPrimary={handleGenerateWeekly}
          primaryLabel={loadingKind === "weekly" ? t("coachPlan.actions.generatingWeekly") : t("coachPlan.actions.generateWeekly")}
          loading={loadingKind === "weekly"}
          // Zakážeme, ak ešte nie je hotová analýza (KROK 0), alebo globálny blok.
          disabled={isStep0 || generatorsBlockedGlobally}
          status={hasWeekly}
          highlight={highlightWeekly}
        />

        {/* KROK 3: Daily */}
        <RowAction
          onPrimary={handleGenerateDaily}
          primaryLabel={loadingKind === "daily" ? t("coachPlan.actions.generatingDaily") : t("coachPlan.actions.generateDaily")}
          loading={loadingKind === "daily"}
          // Zakážeme, ak ešte nie je Weekly (KROKY 0 a 1), alebo globálny blok.
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
          {/* Tlačidlo ŠTART svieti ako primary až vtedy, keď sme v KROKU 3 */}
          <Button
            size="xs"
            variant={isStep3 ? "primary" : "secondary"}
            disabled={!!startDisabledReason || isGlobalLoading}
            onClick={handleStartPlan}
            title={startDisabledReason ?? undefined}
            className="flex-1"
          >
            {loadingKind === "start" ? <LoadingSpinner size="button" /> : isPlanActive ? t("coachPlan.actions.activePlan") : t("coachPlan.actions.startPlan")}
          </Button>

          {isPlanActive && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => router.push("/coach/ai/dailyPlan")}
              className="flex-1"
            >
              {t("coachPlan.actions.openPlan")}
            </Button>
          )}

          <Button
            size="xs"
            variant="danger"
            disabled={!canCancel}
            onClick={handleCancelPlan}
          >
            {loadingKind === "cancel" ? <LoadingSpinner size="button" /> : t("coachPlan.actions.cancelPlan")}
          </Button>
        </div>
      </div>

      {/* Upozornenie na tokeny */}
      <div className="mt-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200/90">
        <span className="shrink-0 text-base leading-none">💡</span>
        <div className="text-xs leading-relaxed">
          <strong className="font-semibold text-amber-400">
            {t("coachPlan.widget.tokenWarning.title")}
          </strong>{" "}
          {t("coachPlan.widget.tokenWarning.text")}
          {/* Ak neskôr dorobíš stránku Predplatné, môžeš tu dať <Link href="/subscription">...</Link> */}
          <span className="underline decoration-amber-500/30 underline-offset-2 cursor-pointer hover:text-amber-100 transition-colors">
            {t("coachPlan.widget.tokenWarning.link")}
          </span>.
        </div>
      </div>
    </WidgetCard>
  );
}
