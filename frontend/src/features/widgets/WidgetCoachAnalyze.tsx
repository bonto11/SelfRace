"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";
import CoachNarrative from "@/features/coach/components/CoachNarrative";
import PlanResult from "@/features/coach/components/PlanResult";
import { PANEL } from "@/shared/ui/classes";

import {
  makeCacheKey,
  loadCachedResult,
  saveCachedResult,
  clearCachedByKey,
} from "@/features/coach/utils/cache";

export default function WidgetCoachAnalyze() {
  const { userId } = useUserId();
  const { prefs, pbRun } = useCoachData();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<"cache" | "ai" | null>(null);

  const canRun = !!userId && !!prefs && !loading;
  const cacheKey = useMemo(
    () => (userId && prefs ? makeCacheKey(String(userId), prefs) : undefined),
    [userId, prefs]
  );

  // Auto-load z cache po mount-e
  useEffect(() => {
    if (!cacheKey || result) return;
    const cached = loadCachedResult(cacheKey);
    if (cached?.result) {
      setResult(cached.result);
      setSource("cache");
    }
  }, [cacheKey, result]);

  // Jedno tlačidlo: "Analyze / Load"
  const handleAnalyzeOrLoad = useCallback(async () => {
    if (!canRun || !userId || !prefs) return;

    setLoading(true);
    setErr(null);

    try {
      // 1) Skús cache
      const ck = makeCacheKey(String(userId), prefs);
      const cached = loadCachedResult(ck);
      if (cached?.result) {
        setResult(cached.result);
        setSource("cache");
        return; // hotovo bez AI
      }

      // 2) Zavolaj AI
      const base = toAnalyzePayloadBE(prefs);
      const payload = {
        ...base,
        goal_structured: prefs,
        bests: { run: pbRun },
      };
      const json = await analyzeCoach(userId, payload);
      if (!json?.success) throw new Error(json?.detail || "Analyze failed");

      setResult(json);
      setSource("ai");
      saveCachedResult(ck, json, json?.model);
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, [canRun, userId, prefs, pbRun]);

  // Force re-run (ignoruje cache)
  const handleForceRerun = useCallback(async () => {
    if (!canRun || !userId || !prefs) return;
    setLoading(true);
    setErr(null);

    try {
      const base = toAnalyzePayloadBE(prefs);
      const payload = {
        ...base,
        goal_structured: prefs,
        bests: { run: pbRun },
      };
      const json = await analyzeCoach(userId, payload);
      if (!json?.success) throw new Error(json?.detail || "Analyze failed");

      setResult(json);
      setSource("ai");
      if (cacheKey) saveCachedResult(cacheKey, json, json?.model);
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, [canRun, userId, prefs, pbRun, cacheKey]);

  // Clear cache
  const handleClear = useCallback(() => {
    if (cacheKey) clearCachedByKey(cacheKey);
    setResult(null);
    setSource(null);
  }, [cacheKey]);

  const model = result?.model || "—";
  const diag = result
    ? {
        success: !!result?.success,
        model: result?.model,
        hasSummary: !!result?.analysis?.summary,
        hasNarrative: !!result?.narrative,
        hasPlan: !!result?.analysis?.next_week_plan,
      }
    : null;

  return (
    <div className="col-span-full space-y-3">
      <div className="bg-gray-800 p-4 rounded flex items-center justify-between">
        <div>
          <div className="font-semibold">AI Analyze</div>
          <div className="text-sm opacity-75">
            Jedno tlačidlo: najprv skúsi cache, ak chýba → zavolá AI a uloží.
          </div>
        </div>
        <button
          onClick={handleAnalyzeOrLoad}
          disabled={!canRun}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50 flex items-center gap-2"
        >
          {loading && (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          )}
          {loading ? "Načítavam…" : "Analyze / Load"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs opacity-80">
        <span>source: {source ?? "—"}</span>
        <button
          onClick={handleForceRerun}
          disabled={!canRun || loading}
          className="underline"
        >
          Force re-run
        </button>
        <button
          onClick={handleClear}
          disabled={loading}
          className="underline text-red-300"
        >
          Clear cache
        </button>
      </div>

      {err && (
        <div className="bg-red-900/30 border border-red-600 text-red-200 p-3 rounded">
          <div className="font-semibold mb-0.5">AI error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}

      {/* Diagnostika */}
      {diag && (
        <div className="bg-gray-900/40 border border-gray-700 rounded p-2 text-xs opacity-80">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>success: {String(diag.success)}</span>
            <span>model: {diag.model ?? "—"}</span>
            <span>summary: {String(diag.hasSummary)}</span>
            <span>narrative: {String(diag.hasNarrative)}</span>
            <span>plan: {String(diag.hasPlan)}</span>
          </div>
        </div>
      )}

      {/* Výstup */}
      {result && (
        <section className={PANEL}>
          <header className="px-4 py-3 flex items-center justify-between">
            <div className="font-semibold">AI Coach — plán a zhrnutie</div>
            <div className="text-xs opacity-75">
              model: <b>{model}</b>
              {source === "cache" && (
                <span className="ml-2 inline-block text-xs bg-blue-600/30 border border-blue-600 text-blue-200 px-2 py-0.5 rounded">
                  from cache
                </span>
              )}
              {result?.analysis?._meta?.plan_source === "fallback_min" && (
                <span className="ml-2 inline-block text-xs bg-amber-600/30 border border-amber-600 text-amber-200 px-2 py-0.5 rounded">
                  fallback plan
                </span>
              )}
            </div>
          </header>

          <div className="px-4 pb-4">
            <PlanResult result={result} />
          </div>
        </section>
      )}
    </div>
  );
}
