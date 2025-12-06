// src/features/coach/components/CoachPlanActions.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { useUserId } from "@/shared/hooks/useUserId";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

import Button from "@/shared/components/ui/Button";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

import { apiGetCoachPrefs } from "@/features/coach/api/prefs";
import { apiAnalyzeAthleteState } from "@/features/coach/api/coach_athlete_state";
import { apiGenerateWeeklyPlan } from "@/features/coach/api/coach_plan_weekly";
import { apiGenerateDailyForWeek } from "@/features/coach/api/coach_plan_daily";
import type { AnalyzeResult } from "@/features/coach/types/coachApiTypes";

import AthleteStatePanel from "@/features/coach/components/AthleteStatePanel";

/* ───────────────────────── helpers ───────────────────────── */

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

/** Mini summary v hornej kartičke */
function PrefsMini({ prefs }: { prefs: CoachPrefs | null }) {
  if (!prefs)
    return <div className="text-sm opacity-75">— preferences nenačítané —</div>;

  const main = (prefs as any).main_sport ?? prefs.primary_sports?.[0] ?? "—";
  const sec =
    (prefs as any).secondary_mix
      ?.filter((x: any) => Number(x?.share_pct) > 0)
      .map((x: any) => x.sport)
      .join(", ") || "—";

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      <div className="opacity-75">Goal</div>
      <div className="font-semibold truncate">{prefs.goal_kind ?? "—"}</div>

      <div className="opacity-75">Weeks</div>
      <div className="font-semibold">{prefs.weeks ?? "—"}</div>

      <div className="opacity-75">Plan start</div>
      <div className="font-semibold">{(prefs as any).start_date ?? "—"}</div>

      <div className="opacity-75">Main</div>
      <div className="font-semibold">{main}</div>

      <div className="opacity-75">Secondary</div>
      <div className="font-semibold truncate">{sec}</div>

      <div className="opacity-75">Strength mode</div>
      <div className="font-semibold">
        {(prefs as any)?.strength_settings?.equipment_mode ?? "—"} ·{" "}
        {(prefs as any)?.strength_settings?.location ?? "—"}
      </div>
    </div>
  );
}

/* ─────────────────────── hlavný komponent ─────────────────────── */

export default function CoachPlanActions() {
  const { userId } = useUserId();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loadingKind, setLoadingKind] = useState<
    "analyze" | "weekly" | "daily" | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  // prefs len na mini-summary (logika analýzy je už komplet v BE)
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

  const handleAnalyze = useCallback(async () => {
    if (!userId) return;
    setErr(null);
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

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "coach.athlete_state",
            JSON.stringify(json.state ?? null)
          );
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId]);

  const handleGenerateWeekly = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    setLoadingKind("weekly");

    try {
      const weeks = (prefs as any)?.weeks ?? null;
      const stateId = result?.state_id ?? null;

      const json = await apiGenerateWeeklyPlan(userId, {
        overwrite: true,
        weeks,
        state_id: stateId,
      });

      console.log("[coach] weekly plan generated", json);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId, prefs, result]);

  const handleGenerateDaily = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    setLoadingKind("daily");

    try {
      const json = await apiGenerateDailyForWeek(userId, {
        week_index: 1, // 1. týždeň – neskôr vieš spraviť výber
        plan_id: null, // vezme posledný aktívny plán v BE
        overwrite: true,
      });

      console.log("[coach] daily plan generated", json);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoadingKind(null);
    }
  }, [userId]);

  const loading = loadingKind !== null;
  const canActions = !!userId && !loading;

  const summary =
    result?.analysis && typeof result.analysis === "object"
      ? {
          generated_at: (result.analysis as any).generated_at ?? null,
          model: result.model ?? null,
          state_id: result.state_id ?? null,
        }
      : null;

  return (
    <div className="space-y-4">
      {/* prefs / basic info */}
      <div className="rounded-xl border border-white/10 p-3 bg-white/5">
        <PrefsMini prefs={prefs} />
        {summary && (
          <div className="mt-2 text-xs text-emerald-300">
            Athlete state:&nbsp;
            <span className="font-semibold">
              {summary.generated_at ?? "—"}
            </span>{" "}
            · model{" "}
            <span className="font-semibold">{summary.model ?? "—"}</span>
            {summary.state_id != null && (
              <>
                {" "}
                · state_id{" "}
                <span className="font-semibold">{summary.state_id}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* tlačidlá */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleAnalyze}
          disabled={!canActions}
          variant="primary"
          size="sm"
        >
          {loadingKind === "analyze" ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              Analyzing…
            </span>
          ) : (
            "Analyze athlete state"
          )}
        </Button>

        <Button
          onClick={handleGenerateWeekly}
          disabled={!canActions}
          variant="secondary"
          size="sm"
        >
          {loadingKind === "weekly" ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              Generating weekly…
            </span>
          ) : (
            "Generate weekly plan"
          )}
        </Button>

        <Button
          onClick={handleGenerateDaily}
          disabled={!canActions}
          variant="ghost"
          size="sm"
        >
          {loadingKind === "daily" ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              Generating daily…
            </span>
          ) : (
            "Generate daily plan"
          )}
        </Button>
      </div>

      {/* hlavný panel s analýzou */}
      <AthleteStatePanel
        analysis={result?.analysis ?? null}
        model={result?.model ?? null}
      />

      {err && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 text-red-100 p-3">
          <div className="font-semibold mb-0.5">Error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}
    </div>
  );
}