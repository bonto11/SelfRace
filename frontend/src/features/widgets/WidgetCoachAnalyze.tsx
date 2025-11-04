// src/features/coach/widgets/WidgetCoachAnalyze.tsx
"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";
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

  // auto-load z cache po mount-e
  useEffect(() => {
    if (!cacheKey || result) return;
    const cached = loadCachedResult(cacheKey);
    if (cached?.result) {
      setResult(cached.result);
      setSource("cache");
    }
  }, [cacheKey, result]);

  // jedno tlačidlo: najprv cache → inak AI
  const handleAnalyzeOrLoad = useCallback(async () => {
    if (!canRun || !userId || !prefs) return;

    setLoading(true);
    setErr(null);
    try {
      const ck = makeCacheKey(String(userId), prefs);
      const cached = loadCachedResult(ck);
      if (cached?.result) {
        setResult(cached.result);
        setSource("cache");
        return;
      }

      const base = toAnalyzePayloadBE(prefs);
      const payload = { ...base, goal_structured: prefs, bests: { run: pbRun } };
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

  // ignoruj cache
  const handleForceRerun = useCallback(async () => {
    if (!canRun || !userId || !prefs) return;
    setLoading(true);
    setErr(null);
    try {
      const base = toAnalyzePayloadBE(prefs);
      const payload = { ...base, goal_structured: prefs, bests: { run: pbRun } };
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
      {/* --- PANEL: AI Analyze ovládanie --- */}
      <section className={PANEL}>
        <header className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">AI Analyze</div>
            <div className="text-xs opacity-75">
              Najprv skúsi cache; ak chýba → zavolá AI a uloží.
            </div>
          </div>

          <button
            onClick={handleAnalyzeOrLoad}
            disabled={!canRun}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5
                       bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
          >
            {loading && (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            )}
            {loading ? "Načítavam…" : "Analyze / Load"}
          </button>
        </header>

        <div className="px-4 pb-4 space-y-2">
          {/* toolbar chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-gray-700/60">
              source: {source ?? "—"}
            </span>
            <button
              onClick={handleForceRerun}
              disabled={!canRun || loading}
              className="px-2 py-1 rounded-full border border-white/10 hover:bg-gray-700/40"
            >
              Force re-run
            </button>
            <button
              onClick={handleClear}
              disabled={loading}
              className="px-2 py-1 rounded-full border border-rose-400/30 text-rose-200 hover:bg-rose-600/20"
            >
              Clear cache
            </button>

            {diag && (
              <div className="ml-auto flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded-full bg-gray-700/60">
                  success: {String(diag.success)}
                </span>
                <span className="px-2 py-1 rounded-full bg-gray-700/60">
                  model: {diag.model ?? "—"}
                </span>
                <span className="px-2 py-1 rounded-full bg-gray-700/60">
                  summary: {String(diag.hasSummary)}
                </span>
                <span className="px-2 py-1 rounded-full bg-gray-700/60">
                  narrative: {String(diag.hasNarrative)}
                </span>
                <span className="px-2 py-1 rounded-full bg-gray-700/60">
                  plan: {String(diag.hasPlan)}
                </span>
              </div>
            )}
          </div>

          {err && (
            <div className="rounded-xl border border-red-600 bg-red-900/30 text-red-100 p-3">
              <div className="font-semibold mb-0.5">AI error</div>
              <p className="text-sm opacity-90">{err}</p>
            </div>
          )}
        </div>

        {/* spodná lišta ako v PB */}
        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* --- PANEL: výsledok (zachovaný tvoj PB look) --- */}
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

          <div className="h-1.5 rounded-b-2xl bg-slate-700" />
        </section>
      )}
    </div>
  );
}