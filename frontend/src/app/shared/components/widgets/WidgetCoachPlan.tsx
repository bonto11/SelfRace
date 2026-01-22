// src/features/coach/components/WidgetCoachPlan.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import Pill from "@/app/shared/components/ui/Pill";
import Button from "@/app/shared/components/ui/Button";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  WIDGET_STATUS_ROW,
  WIDGET_ACTIONS_WRAP,
  WIDGET_ACTION_ROW,
  WIDGET_ACTION_ROW_INNER,
  WIDGET_ACTION_CHEVRON_BTN,
  WIDGET_ACTION_ROW_SURFACE,
  WIDGET_ACTION_CHEVRON_SURFACE,
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

import type { CoachPrefs } from "@/app/features/prefs/types/prefs";
import type { AnalyzeResult } from "@/app/features/coach/types/coachApiTypes";
import { confirm } from "@/app/shared/components/ui/Confirm";

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
  if (!prefs) {
    return <span className="text-xs opacity-70">Prefs: —</span>;
  }

  const main = (prefs as any).main_sport ?? prefs.main_sport?.[0] ?? "—";
  const goal = (prefs as any).goal_kind ?? "—";
  const weeks = (prefs as any).weeks ?? "—";

  return (
    <span className="text-[11px] opacity-80">
      Goal: <span className="font-semibold">{goal}</span> • Weeks:{" "}
      <span className="font-semibold">{weeks}</span> • Main:{" "}
      <span className="font-semibold">{main}</span>
    </span>
  );
}

function RowAction({
  onPrimary,
  primaryLabel,
  loading,
  disabled,
  onDetail,
}: {
  onPrimary: () => void;
  primaryLabel: string;
  loading: boolean;
  disabled: boolean;
  onDetail: () => void;
}) {
  return (
    <div className={[WIDGET_ACTION_ROW, WIDGET_ACTION_ROW_SURFACE].join(" ")}>
      <div className={WIDGET_ACTION_ROW_INNER}>
        <Button
          size="xs"
          variant="secondary"
          disabled={disabled}
          onClick={onPrimary}
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

      <button
        type="button"
        onClick={onDetail}
        className={[WIDGET_ACTION_CHEVRON_BTN, WIDGET_ACTION_CHEVRON_SURFACE].join(
          " "
        )}
        aria-label="Otvoriť detail"
      >
        →
      </button>
    </div>
  );
}

function formatAiError(e: any): string {
  const code = e?.code ?? (e && (e as any).code);
  if (code === "ai_quota_exceeded") {
    const used = (e as any).usedTokensThisMonth;
    if (typeof used === "number") {
      return `AI limit pre tento mesiac je vyčerpaný. Minuté tokeny: ${used.toLocaleString(
        "sk-SK"
      )}. Skús to znova na začiatku ďalšieho mesiaca alebo ma kontaktuj.`;
    }
    return `AI limit pre tento mesiac je vyčerpaný. Skús to znova na začiatku ďalšieho mesiaca alebo ma kontaktuj.`;
  }

  return e?.message || String(e);
}

/* ---------- hlavný widget ---------- */

export default function WidgetCoachPlan() {
  const router = useRouter();
  const { userId, userUuid } = useUserId();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [latestStateId, setLatestStateId] = useState<number | null>(null);

  const [loadingKind, setLoadingKind] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

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

    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setHasGenerated(!!localStorage.getItem("coach.generated"));
    } catch {
      setHasGenerated(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoadingKind("status");
      try {
        const s = await apiActivePlanStatus(userId);
        if (!alive) return;

        const pid = s.has_active ? s.plan_id ?? null : null;
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

    return () => {
      alive = false;
    };
  }, [userId]);

  const markGenerated = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("coach.generated", "1");
      setHasGenerated(true);
    } catch {
      // ignore
    }
  }, []);

  const ensurePlanStartFuture = useCallback(async () => {
    if (!userId) return;
    try {
      const updated = await apiEnsureCoachPlanStartFuture(userId);
      if (updated) setPrefs(updated);
    } catch (e) {
      console.warn("[CoachPlan] ensurePlanStartFuture error", e);
    }
  }, [userId]);

  const handleAnalyze = useCallback(async () => {
    if (!userId || !userUuid) return;
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
  }, [userId, userUuid]);

  const handleGenerateWeekly = useCallback(async () => {
    if (!userId || !userUuid) return;
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

      markGenerated();
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [
    userId,
    userUuid,
    prefs,
    result,
    latestStateId,
    markGenerated,
    ensurePlanStartFuture,
  ]);

  const handleGenerateDaily = useCallback(async () => {
    if (!userId || !userUuid) return;
    setError(null);
    setLoadingKind("daily");

    try {
      await ensurePlanStartFuture();

      await apiGenerateDailyForWeek(userId, userUuid, {
        week_index: 1,
        plan_id: null,
        overwrite: true,
      });

      markGenerated();
    } catch (e: any) {
      setError(formatAiError(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, userUuid, markGenerated, ensurePlanStartFuture]);

  const handleStartPlan = useCallback(async () => {
    if (!userId) return;
    setError(null);

    if (!latestStateId) {
      setError("Najprv spusti AI analýzu atleta.");
      return;
    }
    if (!hasGenerated) {
      setError("Najprv vygeneruj weekly aj daily plán.");
      return;
    }

    setLoadingKind("start");

    try {
      const res = await apiActivePlanSave(userId, {});
      const pid = res.plan_id ?? null;

      setActivePlanId(pid);

      if (typeof window !== "undefined" && pid) {
        localStorage.setItem("coach.active_plan_id", pid);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, latestStateId, hasGenerated]);

  const handleCancelPlan = useCallback(async () => {
    if (!userId || !activePlanId) return;
    setError(null);

    const ok = await confirm({
      title: "Ukončiť tréningový plán?",
      message:
        "Táto akcia je nezvratná. Weekly aj daily plán budú zrušené a plán sa presunie medzi ukončené.",
      okText: "Ukončiť plán",
      cancelText: "Zrušiť",
      tone: "danger",
    });

    if (!ok) return;

    setLoadingKind("cancel");

    try {
      await apiActivePlanCancel(userId, activePlanId);

      setActivePlanId(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("coach.active_plan_id");
      }

      try {
        const stat = await apiActivePlanStatus(userId);
        setActivePlanId(stat.has_active ? stat.plan_id ?? null : null);
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, activePlanId]);

  const loading = loadingKind !== null && loadingKind !== "status";
  const disabled = !userId || loading;

  const accent = activePlanId ? appColors.brandPrimary : appColors.accentTeal;

  const statusLabel = activePlanId ? "active plan ✓" : hasGenerated ? "generated ✓" : "no plan";
  const statusColor = activePlanId ? appColors.brandPrimary : appColors.textMuted;

  return (
    <WidgetCard
      title="Coach — Plan"
      note="Analyzuj stav, vygeneruj weekly/daily a spusti aktívny plán."
      accent={accent}
      interactive={false}
      minH={210}
    >
      <div className={WIDGET_STATUS_ROW}>
        <Pill label={statusLabel} color={statusColor} />
        <PrefsMiniInline prefs={prefs} />
      </div>

      {error && <div className={WIDGET_ERROR_LINE_COLORED}>{error}</div>}

      <div className={WIDGET_ACTIONS_WRAP}>
        <RowAction
          onPrimary={handleAnalyze}
          primaryLabel={loadingKind === "analyze" ? "Analyzing…" : "Analyze athlete state"}
          loading={loadingKind === "analyze"}
          disabled={disabled}
          onDetail={() => router.push("/coach/ai/athleteState")}
        />

        <RowAction
          onPrimary={handleGenerateWeekly}
          primaryLabel={loadingKind === "weekly" ? "Generating…" : "Generate weekly plan"}
          loading={loadingKind === "weekly"}
          disabled={disabled}
          onDetail={() => router.push("/coach/ai/weeklyPlan")}
        />

        <RowAction
          onPrimary={handleGenerateDaily}
          primaryLabel={loadingKind === "daily" ? "Generating…" : "Generate daily plan"}
          loading={loadingKind === "daily"}
          disabled={disabled}
          onDetail={() => router.push("/coach/ai/dailyPlan")}
        />

        <div className={WIDGET_CTA_ROW}>
          <Button
            size="xs"
            variant={activePlanId ? "success" : "primary"}
            disabled={disabled || !!activePlanId}
            onClick={handleStartPlan}
          >
            {loadingKind === "start" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                Starting…
              </span>
            ) : activePlanId ? (
              "Plan active ✓"
            ) : (
              "Start plan"
            )}
          </Button>

          <Button
            size="xs"
            variant="secondary"
            disabled={!activePlanId || loadingKind === "cancel"}
            onClick={handleCancelPlan}
          >
            {loadingKind === "cancel" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                Cancelling…
              </span>
            ) : (
              "Cancel plan"
            )}
          </Button>
        </div>
      </div>
    </WidgetCard>
  );
}