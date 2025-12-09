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
import { apiAnalyzeAthleteState } from "@/features/coach/api/coach_athlete_state";
import { apiGenerateWeeklyPlan } from "@/features/coach/api/coach_plan_weekly";
import { apiGenerateDailyForWeek } from "@/features/coach/api/coach_plan_daily";
import {
  apiActivePlanSave,
  apiActivePlanCancel,
} from "@/features/coach/api/coach_plan_active";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import type { AnalyzeResult } from "@/features/coach/types/coachApiTypes";

/* ---------- helpers ---------- */

type LoadingKind = "analyze" | "weekly" | "daily" | "start" | "cancel" | null;

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
    <div className="flex items-start justify-between gap-2 rounded-lg bg-black/5 dark:bg-white/5 px-2 py-2">
      <div className="flex-1 space-y-0.5">
        <div className="mt-1">
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

/* ---------- hlavný widget ---------- */

export default function WidgetCoachPlan() {
  const router = useRouter();
  const { userId } = useUserId();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loadingKind, setLoadingKind] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  // init prefs
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

  // flag "generated" z localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setHasGenerated(!!localStorage.getItem("coach.generated"));
    } catch {
      setHasGenerated(false);
    }
  }, []);

  // active plan id z localStorage (jednoduchý stav na FE)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pid = localStorage.getItem("coach.active_plan_id");
      setActivePlanId(pid ?? null);
    } catch {
      setActivePlanId(null);
    }
  }, []);

  const markGenerated = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("coach.generated", "1");
      setHasGenerated(true);
    } catch {
      // ignore
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setLoadingKind("analyze");

    try {
      const json = await apiAnalyzeAthleteState(userId, {
        debugRaw: false,
        explicitModel: "coach-analyze-stub",
      });

      setResult({
        analysis: json.state ?? null,
        model: json.model ?? null,
        state_id: json.state_id ?? null,
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId]);

  const handleGenerateWeekly = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setLoadingKind("weekly");

    try {
      const weeks = (prefs as any)?.weeks ?? null;
      const stateId = result?.state_id ?? null;

      await apiGenerateWeeklyPlan(userId, {
        overwrite: true,
        weeks,
        state_id: stateId,
      });

      markGenerated();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, prefs, result, markGenerated]);

  const handleGenerateDaily = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setLoadingKind("daily");

    try {
      await apiGenerateDailyForWeek(userId, {
        week_index: 1,
        plan_id: null,
        overwrite: true,
      });

      markGenerated();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, markGenerated]);

  const handleStartPlan = useCallback(async () => {
    if (!userId) return;
    setError(null);

    // jednoduchá guarda – nech je aspoň 1x AI analýza + vygenerovaný plán
    if (!result?.state_id) {
      setError("Najprv spusti AI analýzu atleta.");
      return;
    }
    if (!hasGenerated) {
      setError("Najprv vygeneruj weekly aj daily plán.");
      return;
    }

    setLoadingKind("start");

    try {
      // payload nechávame prázdny – BE si nájde last generated plán/meta
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
  }, [userId, result, hasGenerated]);

  const handleCancelPlan = useCallback(async () => {
    if (!userId || !activePlanId) return;
    setError(null);
    setLoadingKind("cancel");

    try {
      await apiActivePlanCancel(userId, activePlanId);

      setActivePlanId(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("coach.active_plan_id");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, activePlanId]);

  const loading = loadingKind !== null;
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
      {/* status riadok */}
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
              ? THEME?.chart?.good ?? accent
              : hasGenerated
              ? THEME?.chart?.neutral ?? "#64748B"
              : THEME?.chart?.neutral ?? "#64748B"
          }
        />
        <PrefsMiniInline prefs={prefs} />
      </div>

      {/* ak je chyba, zobraz krátke info */}
      {error && (
        <div className="mt-1 text-[11px] text-red-300 line-clamp-2">
          {error}
        </div>
      )}

      {/* akcie */}
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
            loadingKind === "weekly" ? "Generating…" : "Generate weekly plan"
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

        {/* START / CANCEL ACTIVE PLAN */}
        <div className="mt-3 flex items-center gap-2">
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