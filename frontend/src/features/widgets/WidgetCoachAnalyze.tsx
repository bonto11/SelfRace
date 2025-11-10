// src/features/coach/widgets/WidgetCoachAnalyze.tsx
"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";
import PlanResult from "@/features/coach/components/PlanResult";
import { PANEL, NO_X_OVERFLOW } from "@/shared/ui/classes";

import {
  makeCacheKey,
  loadCachedResult,
  saveCachedResult,
  clearCachedByKey,
} from "@/features/coach/utils/cache";

import Button from "@/shared/components/ui/Button";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import Pill from "@/shared/components/ui/Pill";
import { THEME } from "@/shared/theme/tokens";

/* -------------------- Debug JSON block -------------------- */
function JsonBlock({ title, data }: { title: string; data: any }) {
  if (!data) return null;
  return (
    <details className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2" open>
      <summary className="cursor-pointer select-none text-sm font-semibold py-1">
        {title}
      </summary>
      <pre className="mt-2 max-h-80 overflow-auto text-xs leading-5">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export default function WidgetCoachAnalyze() {
  const { userId } = useUserId();
  const { prefs, pbRun } = useCoachData();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<"cache" | "ai" | null>(null);

  // debug: čo sme poslali na BE
  const [debugPayload, setDebugPayload] = useState<any>(null);

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

  // Analyze: najprv cache → inak AI
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

      setDebugPayload(base);
      console.debug?.("[Coach] Sent payload (FE→BE)", base);

      const json = await analyzeCoach(userId, payload);
      if (!json?.success) throw new Error(json?.detail || "Analyze failed");

      setResult(json);
      setSource("ai");
      saveCachedResult(ck, json, json?.model);

      console.debug?.("[Coach] Context used (BE→AI)", json?.context_used);
      console.debug?.("[Coach] AI JSON (BE←AI)", json?.analysis);
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, [canRun, userId, prefs, pbRun]);

  // Force re-run: ignoruj cache
  const handleForceRerun = useCallback(async () => {
    if (!canRun || !userId || !prefs) return;

    setLoading(true);
    setErr(null);
    try {
      const base = toAnalyzePayloadBE(prefs);
      const payload = { ...base, goal_structured: prefs, bests: { run: pbRun } };

      setDebugPayload(base); // fix: basePayload → base
      console.debug?.("[Coach] Sent payload (FE→BE) [force]", base);

      const json = await analyzeCoach(userId, payload);
      if (!json?.success) throw new Error(json?.detail || "Analyze failed");

      setResult(json);
      setSource("ai");
      if (cacheKey) saveCachedResult(cacheKey, json, json?.model);

      console.debug?.("[Coach] Context used (BE→AI) [force]", json?.context_used);
      console.debug?.("[Coach] AI JSON (BE←AI) [force]", json?.analysis);
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
    <>
      <div className="col-span-full space-y-3">
        {/* --- PANEL: AI Analyze ovládanie --- */}
        <section className={[PANEL, NO_X_OVERFLOW].join(" ")}>
          <header className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold">AI Analyze</div>
              <div className="text-xs opacity-75">
                Najprv skúsi cache; ak chýba → zavolá AI a uloží.
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Button
                onClick={handleAnalyzeOrLoad}
                disabled={!canRun}
                variant="primary"
                size="sm"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner size="widget" />
                    Načítavam…
                  </span>
                ) : (
                  "Analyze / Load"
                )}
              </Button>

              <Button
                onClick={handleForceRerun}
                disabled={!canRun || loading}
                variant="secondary"
                size="sm"
              >
                Force re-run
              </Button>

              <Button
                onClick={handleClear}
                disabled={loading}
                variant="danger"
                size="sm"
              >
                Clear cache
              </Button>
            </div>
          </header>

          {/* diagnóza */}
          <div className="px-4 pb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Pill label={`source: ${source ?? "—"}`} color={THEME.chart.neutral} />
              {diag && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <Pill
                    label={`success: ${String(diag.success)}`}
                    color={diag.success ? THEME.chart.excellent : THEME.chart.poor}
                  />
                  <Pill label={`model: ${diag.model ?? "—"}`} color={THEME.chart.neutral} />
                  <Pill label={`summary: ${String(diag.hasSummary)}`} color={THEME.chart.fitness} />
                  <Pill label={`narrative: ${String(diag.hasNarrative)}`} color={THEME.chart.good} />
                  <Pill label={`plan: ${String(diag.hasPlan)}`} color={THEME.chart.athletes} />
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

          <div className="h-1.5 rounded-b-2xl bg-slate-700" />
        </section>

        {/* --- PANEL: výsledok --- */}
        {result && (
          <section className={[PANEL, NO_X_OVERFLOW].join(" ")}>
            <header className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">AI Coach — plán a zhrnutie</div>
                <div className="text-xs opacity-75 flex items-center gap-2 flex-wrap">
                  <span>
                    model: <b>{model}</b>
                  </span>
                  {source === "cache" && (
                    <Pill label="from cache" color={THEME.chart.good} />
                  )}
                  {result?.analysis?._meta?.plan_source === "fallback_min" && (
                    <Pill label="fallback plan" color={THEME.chart.fair} />
                  )}
                </div>
              </div>
            </header>

            <div className="px-4 pb-4">
              <PlanResult result={result} />
            </div>

            <div className="h-1.5 rounded-b-2xl bg-slate-700" />
          </section>
        )}

        {/* --- PANEL: DEBUG --- */}
        {(debugPayload || result) && (
          <section className={[PANEL, NO_X_OVERFLOW].join(" ")}>
            <header className="px-4 py-3">
              <div className="text-base font-semibold">Debug</div>
              <div className="text-xs opacity-75">
                Dočasné – raw payload &amp; AI JSON
              </div>
            </header>
            <div className="px-4 pb-4 space-y-3">
              <JsonBlock title="Sent payload (FE → BE)" data={debugPayload} />
              <JsonBlock title="Context used (BE → AI)" data={result?.context_used} />
              <JsonBlock title="AI JSON (BE ← AI)" data={result?.analysis} />
            </div>
            <div className="h-1.5 rounded-b-2xl bg-slate-700" />
          </section>
        )}
      </div>
    </>
  );
}