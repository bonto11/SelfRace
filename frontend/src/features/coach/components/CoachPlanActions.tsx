// src/features/coach/components/CoachPlanActions.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

import PlanPreview from "@/features/coach/components/PlanPreview";
import PlanActive from "@/features/coach/components/PlanActive";

import {
  apiSaveActivePlan,
  apiUpdateActivePlan,
  apiCancelActivePlan,
} from "@/features/coach/api/plan";
import { apiGetPrefs } from "@/features/coach/api/prefs";
import {
  apiAnalyzeCoach,
  apiToAnalyzePayloadBE,
} from "@/features/coach/api/coach";

import {
  makeCacheKey,
  saveCachedResult,
  loadCachedResult,
  clearCachedByKey,
} from "@/features/coach/utils/cache";

import Button from "@/shared/components/ui/Button";
import Pill from "@/shared/components/ui/Pill";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { THEME } from "@/shared/theme/tokens";
import { API_URL as RAW_API_URL } from "@/shared/config";

const API_URL: string = RAW_API_URL ?? "";
const COACH_DEBUG = false;

/* … JsonBlock, PrefsMini, steps helpery, readPrefsFromStorage – nechávam tak ako ich máš … */

type ActiveSummary = {
  goal: string | null;
  weeks: number | null;
  from_iso: string | null;
  to_iso: string | null;
};

export default function CoachPlanActions() {
  const { userId } = useUserId();
  const { pbRun } = useCoachData();
  const { rows: planRows, refresh: refreshPlan } = usePlanData();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const [steps, setSteps] = useState<StepState[]>(makeSteps());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [diag, setDiag] = useState<{ source: "cache" | "ai" | null; model?: string | null } | null>(null);
  const [debugPayload, setDebugPayload] = useState<any>(null);

  const [aiAttempts, setAiAttempts] = useState<any>(null);
  const [aiSystem, setAiSystem] = useState<any>(null);
  const [aiUser, setAiUser] = useState<any>(null);
  const [aiLastRaw, setAiLastRaw] = useState<any>(null);

  const cacheKey = useMemo(
    () => (userId && prefs ? makeCacheKey(String(userId), prefs) : undefined),
    [userId, prefs],
  );

  const hasGenerated =
    !!analysis &&
    Array.isArray(analysis.next_10_days) &&
    analysis.next_10_days.length > 0;

  // --- ACTIVE PLAN z DB (všetky AI riadky) ---
  const { activeRows, activeSummary }: { activeRows: any[]; activeSummary: ActiveSummary | null } =
    useMemo(() => {
      if (!planRows.length) return { activeRows: [], activeSummary: null };

      const aiRows = planRows.filter((r: any) => r.source === "ai");
      if (!aiRows.length) return { activeRows: [], activeSummary: null };

      // ak by bolo viac plan_id, zober ten s najnovším dátumom
      const byPlan = new Map<string, any[]>();
      for (const r of aiRows) {
        const pid = String((r as any).plan_id ?? "no-id");
        if (!byPlan.has(pid)) byPlan.set(pid, []);
        byPlan.get(pid)!.push(r);
      }
      const plans = Array.from(byPlan.entries()).map(([pid, rows]) => {
        const dates = rows.map((r) => r.plan_date).sort();
        const from_iso = dates[0] ?? null;
        const to_iso = dates[dates.length - 1] ?? null;
        return { pid, rows, from_iso, to_iso };
      });
      plans.sort((a, b) => (a.from_iso ?? "").localeCompare(b.from_iso ?? ""));

      const current = plans[plans.length - 1];
      return {
        activeRows: current.rows,
        activeSummary: {
          goal: (prefs as any)?.goal_kind ?? null,
          weeks: (prefs as any)?.weeks ?? null,
          from_iso: current.from_iso,
          to_iso: current.to_iso,
        },
      };
    }, [planRows, prefs]);

  const hasActivePlan = activeRows.length > 0;

  const canRunGenerate = !!userId && !loading && !hasActivePlan;
  const canStart = !!userId && !loading && hasGenerated && !hasActivePlan;
  const canUpdate = !!userId && !loading && hasActivePlan;
  const canCancel = !!userId && !loading && hasActivePlan;

  /* … tvoje resetSteps, markOnly, markError … */

  // Prefs z DB / storage
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        markOnly("Loading preferences", "initial");
        const p = await apiGetPrefs(userId).catch(() => null);
        const eff = p ?? readPrefsFromStorage();
        setPrefs(eff);
        markOnly(null);
      } catch {
        setPrefs(readPrefsFromStorage());
        markOnly(null);
      }
    })();
  }, [userId, markOnly]);

  // Generated plan z localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawGen = localStorage.getItem("coach.generated");
      setAnalysis(rawGen ? JSON.parse(rawGen) : null);
    } catch {
      setAnalysis(null);
    }
  }, []);

  // Generate plan (AI) – rovnaké, len api* funkcie + PlanPreview
  const handleGenerate = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    setAiAttempts(null);
    setAiSystem(null);
    setAiUser(null);
    setAiLastRaw(null);
    resetSteps();
    setLoading(true);

    try {
      markOnly("Loading preferences", "fetch from DB");
      const fresh = await apiGetPrefs(userId).catch(() => null);
      const effectivePrefs = fresh ?? readPrefsFromStorage();
      if (!effectivePrefs) {
        markError("Loading preferences", "none in DB nor storage");
        throw new Error("Preferences not found in DB or storage.");
      }
      setPrefs(effectivePrefs);
      markOnly(null);

      markOnly("Preparing inputs for AI", "build payload");
      const base = apiToAnalyzePayloadBE(effectivePrefs);
      const payload = { ...base, bests: { run: pbRun ?? [] } };
      setDebugPayload(base);

      markOnly("Checking cache");
      const ck = makeCacheKey(String(userId), effectivePrefs);
      const cached = loadCachedResult(ck);
      if (cached?.result) {
        markOnly("Saving to storage", "from cache");
        setAnalysis(cached.result.analysis);
        setDiag({ source: "cache", model: cached.result.model });
        localStorage.setItem(
          "coach.generated",
          JSON.stringify(cached.result.analysis),
        );
        markOnly(null);
        setLoading(false);
        return;
      }

      markOnly("Sending request", "debug_raw=1, loose=1");
      markOnly("Generating plan (AI)");
      const json = await apiAnalyzeCoach(userId, payload, {
        debugRaw: true,
        loose: true,
      });

      if (!json?.success) {
        const detail = json?.detail || "Analyze failed";
        markError("Generating plan (AI)", detail);
        throw new Error(detail);
      }

      setAiAttempts(json?.ai_debug?.attempts ?? null);
      setAiSystem(json?.ai_debug?.system_prompt ?? null);
      setAiUser(json?.ai_debug?.user_prompt ?? null);
      setAiLastRaw(json?.ai_debug?.last_raw ?? null);

      markOnly("Parsing response", "ok");
      setAnalysis(json.analysis);
      setDiag({ source: "ai", model: json.model });
      saveCachedResult(ck, json, json?.model);

      markOnly("Saving to storage");
      localStorage.setItem("coach.generated", JSON.stringify(json.analysis));
      markOnly(null);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/Failed to fetch/i.test(msg)) {
        setErr(`Failed to fetch (network/CORS/timeout). API_URL=${API_URL}`);
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, pbRun, resetSteps, markOnly, markError]);

  // Start plan -> uloženie do DB, refresh PlanDataProvidera
  const handleStart = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      const raw = localStorage.getItem("coach.generated");
      if (!raw) throw new Error("Najprv vygeneruj plán (Generate).");
      const genAnalysis = JSON.parse(raw);
      if (!genAnalysis?.next_10_days) {
        throw new Error("Generated plan nemá next_10_days.");
      }

      const meta = {
        started_at_iso: new Date().toISOString(),
        plan_start_date:
          (prefs as any)?.plan_start_date ??
          (prefs as any)?.start_date ??
          todayISO(),
        weeks: (prefs as any)?.weeks ?? null,
        goal_kind: (prefs as any)?.goal_kind ?? null,
      };

      const res = await apiSaveActivePlan(userId, genAnalysis, meta);
      if (!res?.success) throw new Error("Uloženie plánu zlyhalo.");

      await refreshPlan(true);
    } catch (e: any) {
      setErr(e?.message || "Start failed");
    }
  }, [userId, prefs, refreshPlan]);

  const handleUpdate = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      await apiUpdateActivePlan(userId);
      await refreshPlan(true);
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }, [userId, refreshPlan]);

  const handleCancel = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      await apiCancelActivePlan(userId, null);
      await refreshPlan(true);
      setAnalysis(null);
      setDiag(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("coach.generated");
      }
    } catch (e: any) {
      setErr(e?.message || "Cancel failed");
    }
  }, [userId, refreshPlan]);

  const handleClearCache = useCallback(() => {
    if (cacheKey) clearCachedByKey(cacheKey);
  }, [cacheKey]);

  /* … StepsStrip nechávam, ak ho používaš … */

  return (
    <div className="space-y-4">
      {/* mini sumár prefs + info o aktívnom pláne */}
      <div className="rounded-xl border border-white/10 p-3 bg-white/5">
        <PrefsMini prefs={prefs} />
        {activeSummary && (
          <div className="mt-2 text-xs text-emerald-300">
            Active plan:{" "}
            <span className="font-semibold">
              {activeSummary.goal ?? "—"}
            </span>
            {", "}
            <span className="font-semibold">
              {activeSummary.weeks ?? "—"}
            </span>{" "}
            weeks{" "}
            {activeSummary.from_iso && activeSummary.to_iso && (
              <span className="opacity-80">
                ({activeSummary.from_iso} – {activeSummary.to_iso})
              </span>
            )}
          </div>
        )}
      </div>

      {/* ovládanie */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleGenerate}
          disabled={!canRunGenerate}
          variant="primary"
          size="sm"
        >
          {loading && !hasGenerated ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              Generating…
            </span>
          ) : (
            "Generate plan"
          )}
        </Button>

        <Button
          onClick={handleStart}
          disabled={!canStart}
          variant="primary"
          size="sm"
        >
          Start plan
        </Button>

        <Button
          onClick={handleUpdate}
          disabled={!canUpdate}
          variant="primary"
          size="sm"
        >
          Update plan
        </Button>

        <Button
          onClick={handleCancel}
          disabled={!canCancel}
          variant="danger"
          size="sm"
        >
          Cancel plan
        </Button>

        {COACH_DEBUG && (
          <Button
            onClick={handleClearCache}
            disabled={loading}
            variant="danger"
            size="sm"
          >
            Clear cache
          </Button>
        )}

        {diag && (
          <div className="ml-auto flex flex-wrap gap-2 text-xs">
            <Pill
              label={`source: ${diag.source ?? "—"}`}
              color={THEME.chart.neutral}
            />
            <Pill
              label={`model: ${diag.model ?? "—"}`}
              color={THEME.chart.neutral}
            />
          </div>
        )}
      </div>

      {/* error */}
      {err && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 text-red-100 p-3">
          <div className="font-semibold mb-0.5">Error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}

      {/* obsah podľa stavu */}
      {hasActivePlan ? (
        <PlanActive rows={activeRows} />
      ) : (
        analysis && (
          <div className="mt-2">
            <PlanPreview
              result={{ analysis, narrative: null, model: diag?.model }}
            />
          </div>
        )
      )}

      {/* debug bloky */}
      {/* JsonBlock-y nechávam, ak ich používaš */}
    </div>
  );
}