// src/features/coach/components/WidgetCoachPlan.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/shared/components/ui/WidgetCard";
import Pill from "@/shared/components/ui/Pill";
import Button from "@/shared/components/ui/Button";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

import { apiGetCoachPrefs } from "@/features/coach/api/prefs";
import {
  apiAnalyzeAthleteState,
  apiGetLatestAthleteState,
} from "@/features/coach/api/coach_athlete_state";
import {
  apiActivePlanSave,
  apiActivePlanCancel,
  apiActivePlanStatus,
} from "@/features/coach/api/coach_plan_active";

import { apiGenerateWeeklyPlan } from "@/features/coach/api/coach_plan_weekly";
import { apiGenerateDailyForWeek } from "@/features/coach/api/coach_plan_daily";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import type { AnalyzeResult } from "@/features/coach/types/coachApiTypes";

/* --------------------------------------------- */

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

  const main = (prefs as any).main_sport ?? prefs.primary_sports?.[0] ?? "—";
  const goal = prefs.goal_kind ?? "—";
  const weeks = prefs.weeks ?? "—";

  return (
    <span className="text-[11px] opacity-80">
      Goal: <span className="font-semibold">{goal}</span>{" "}
      • Weeks: <span className="font-semibold">{weeks}</span>{" "}
      • Main: <span className="font-semibold">{main}</span>
    </span>
  );
}

function RowAction({ onPrimary, primaryLabel, loading, disabled, onDetail }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-black/5 dark:bg-white/5 px-2 py-2">
      <div className="flex-1 space-y-0.5">
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
        className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-xs hover:bg-black/10 dark:hover:bg-white/20"
      >
        →
      </button>
    </div>
  );
}

/* --------------------------------------------- */
/*                    MAIN                      */
/* --------------------------------------------- */

export default function WidgetCoachPlan() {
  const router = useRouter();
  const { userId } = useUserId();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [latestStateId, setLatestStateId] = useState<number | null>(null);

  const [loadingKind, setLoadingKind] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);

  const [hasGenerated, setHasGenerated] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  /* ---- Prefs ---- */
  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const p = await apiGetCoachPrefs(userId).catch(() => null);
        const eff = p ?? readPrefsFromStorage();
        setPrefs(eff);
      } catch {
        setPrefs(readPrefsFromStorage());
      }
    })();
  }, [userId]);

  /* ---- athlete state ---- */
  useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      try {
        const row = await apiGetLatestAthleteState(userId);
        if (!alive) return;

        setLatestStateId(row?.id ?? null);
      } catch {
        if (alive) setLatestStateId(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  /* ---- generated flag ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasGenerated(!!localStorage.getItem("coach.generated"));
  }, []);

  /* ---- active plan status FROM DB (autorita) ---- */
  useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      setLoadingKind("status");
      try {
        const s = await apiActivePlanStatus(userId);
        if (!alive) return;

        const pid = s.has_active ? s.plan_id : null;
        setActivePlanId(pid);

        if (pid) {
          localStorage.setItem("coach.active_plan_id", String(pid));
        } else {
          localStorage.removeItem("coach.active_plan_id");
        }
      } catch {}
      finally {
        if (alive) setLoadingKind(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  /* --------------------------------------------- */
  /*                    ACTIONS                    */
  /* --------------------------------------------- */

  const handleAnalyze = useCallback(async () => {
    if (!userId) return;

    setLoadingKind("analyze");
    setError(null);

    try {
      const json = await apiAnalyzeAthleteState(userId, {
        debugRaw: false,
        explicitModel: "coach-analyze-stub",
      });

      setResult({
        analysis: json.state,
        model: json.model,
        state_id: json.state_id,
      });

      if (json.state_id) setLatestStateId(json.state_id);
    } catch (e: any) {
      setError(e?.message || "Error analyzing athlete.");
    } finally {
      setLoadingKind(null);
    }
  }, [userId]);

  const handleGenerateWeekly = useCallback(async () => {
    if (!userId) return;

    setLoadingKind("weekly");
    setError(null);

    try {
      const weeks = (prefs as any)?.weeks ?? null;
      const sid = result?.state_id ?? latestStateId;

      await apiGenerateWeeklyPlan(userId, {
        overwrite: true,
        weeks,
        state_id: sid,
      });

      localStorage.setItem("coach.generated", "1");
      setHasGenerated(true);
    } catch (e: any) {
      setError(e?.message || "Weekly plan generation failed.");
    } finally {
      setLoadingKind(null);
    }
  }, [userId, prefs, result, latestStateId]);

  const handleGenerateDaily = useCallback(async () => {
    if (!userId) return;

    setLoadingKind("daily");
    setError(null);

    try {
      await apiGenerateDailyForWeek(userId, {
        week_index: 1,
        plan_id: null,
        overwrite: true,
      });

      localStorage.setItem("coach.generated", "1");
      setHasGenerated(true);
    } catch (e: any) {
      setError(e?.message || "Daily plan generation failed.");
    } finally {
      setLoadingKind(null);
    }
  }, [userId]);

  const handleStartPlan = useCallback(async () => {
    if (!userId) return;

    if (!latestStateId) {
      setError("Najprv spusti AI analýzu atleta.");
      return;
    }
    if (!hasGenerated) {
      setError("Najprv vygeneruj weekly aj daily plán.");
      return;
    }

    setLoadingKind("start");
    setError(null);

    try {
      const res = await apiActivePlanSave(userId, {});
      const pid = res.plan_id ?? null;

      setActivePlanId(pid);
      localStorage.setItem("coach.active_plan_id", String(pid));
    } catch (e: any) {
      setError(e?.message || "Unable to start plan.");
    } finally {
      setLoadingKind(null);
    }
  }, [userId, latestStateId, hasGenerated]);

  /* ---------- DOUBLE-STEP CANCEL ---------- */
  const handleCancelPlan = useCallback(async () => {
    if (!userId || !activePlanId) return;

    const ok = window.confirm(
      "Naozaj chceš ukončiť tento plán?\nTáto akcia je nezvratná."
    );
    if (!ok) return;

    setLoadingKind("cancel");
    setError(null);

    try {
      await apiActivePlanCancel(userId, activePlanId);

      // frontend cleanup
      setActivePlanId(null);
      localStorage.removeItem("coach.active_plan_id");

      // refresh status z DB
      try {
        const stat = await apiActivePlanStatus(userId);
        setActivePlanId(stat.has_active ? stat.plan_id : null);
      } catch {}

    } catch (e: any) {
      setError(e?.message || "Unable to cancel plan.");
    } finally {
      setLoadingKind(null);
    }
  }, [userId, activePlanId]);

  /* --------------------------------------------- */

  const loading = loadingKind !== null && loadingKind !== "status";
  const disabled = !userId || loading;

  const accent = THEME?.chart?.athletes ?? THEME?.chart?.run ?? "#22C55E";

  return (
    <WidgetCard
      title="Coach — Plan"
      note="Analyzuj stav, vygeneruj weekly/daily a spusti aktívny plán."
      accent={accent}
      interactive={false}
      minH={210}
    >
      {/* STATUS */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <Pill
          label={
            activePlanId
              ? "active plan ✓"
              : hasGenerated
              ? "generated ✓"
              : "no plan"
          }
          color={
            activePlanId
              ? THEME?.chart?.good ?? "#22C55E"
              : THEME?.chart?.neutral ?? "#64748B"
          }
        />
        <PrefsMiniInline prefs={prefs} />
      </div>

      {error && (
        <div className="mt-1 text-[11px] text-red-300">{error}</div>
      )}

      {/* ACTIONS */}
      <div className="mt-3 space-y-2 text-xs">
        <RowAction
          onPrimary={handleAnalyze}
          primaryLabel={
            loadingKind === "analyze" ? "Analyzing…" : "Analyze athlete state"
          }
          loading={loadingKind === "analyze"}
          disabled={disabled}
          onDetail={() => router.push("/coach/ai/athleteState")}
        />

        <RowAction
          onPrimary={handleGenerateWeekly}
          primaryLabel={
            loadingKind === "weekly"
              ? "Generating…"
              : "Generate weekly plan"
          }
          loading={loadingKind === "weekly"}
          disabled={disabled}
          onDetail={() => router.push("/coach/ai/weeklyPlan")}
        />

        <RowAction
          onPrimary={handleGenerateDaily}
          primaryLabel={
            loadingKind === "daily" ? "Generating…" : "Generate daily plan"
          }
          loading={loadingKind === "daily"}
          disabled={disabled}
          onDetail={() => router.push("/coach/ai/dailyPlan")}
        />

        {/* START + DOUBLE-STEP CANCEL */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="xs"
            variant={activePlanId ? "success" : "primary"}
            disabled={disabled || !!activePlanId}
            onClick={handleStartPlan}
          >
            {loadingKind === "start" ? (
              <>
                <LoadingSpinner size="button" /> Starting…
              </>
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
              <>
                <LoadingSpinner size="button" /> Cancelling…
              </>
            ) : (
              "Cancel plan"
            )}
          </Button>
        </div>
      </div>
    </WidgetCard>
  );
}