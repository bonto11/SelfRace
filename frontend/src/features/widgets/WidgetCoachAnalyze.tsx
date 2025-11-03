"use client";

import { useCallback, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";

import CoachNarrative from "@/features/coach/components/CoachNarrative";
import PlanResult from "@/features/coach/components/PlanResult";

/**
 * WidgetCoachAnalyze
 * - Samostatný widget s tlačidlom Analyze
 * - Očíslované debug logy pre jednoduché hľadanie, kde to padlo
 */
export default function WidgetCoachAnalyze() {
  const { userId } = useUserId();
  const { prefs, pbRun } = useCoachData();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // --- Debug helper
  const log = useCallback((step: number, msg: string, data?: unknown) => {
    // konzistentný prefix
    const prefix = `[COACH][AI][${step}] ${msg}`;
    if (data !== undefined) {
      // eslint-disable-next-line no-console
      console.debug(prefix, data);
    } else {
      // eslint-disable-next-line no-console
      console.debug(prefix);
    }
  }, []);

  const canAnalyze = !!userId && !!prefs && !loading;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze || !userId) return;

    setLoading(true);
    setErr(null);
    setResult(null);

    try {
      // (1) kontext
      log(1, "ctx -> userId, prefs snapshot", { userId, prefs });

      // (2) base payload
      const base = toAnalyzePayloadBE(prefs);
      log(2, "base payload", base);

      // (3) rozšírený payload
      const payload = {
        ...base,
        goal_structured: prefs,
        bests: { run: pbRun },
      };
      log(3, "final payload", payload);

      // (4) API call
      log(4, "calling analyzeCoach()");
      const json = await analyzeCoach(userId, payload);

      // (5) response
      log(5, "response json keys", {
        success: json?.success,
        model: json?.model,
        hasAnalysis: !!json?.analysis,
        hasPlan: !!json?.analysis?.next_week_plan,
        hasNarrative: !!json?.narrative,
      });

      if (!json?.success) {
        throw new Error(json?.detail || "Analyze failed");
      }

      setResult(json);
      log(6, "done");
    } catch (e: any) {
      log(99, "ERROR", e);
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, [canAnalyze, userId, prefs, pbRun, log]);

  const model = result?.model || "—";
  const planExists = !!result?.analysis?.next_week_plan;

  // rýchla diagnostika na UI
  const diag = useMemo(() => {
    if (!result) return null;
    return {
      success: !!result?.success,
      model: result?.model,
      hasSummary: !!result?.analysis?.summary,
      hasNarrative: !!result?.narrative,
      hasPlan: !!result?.analysis?.next_week_plan,
    };
  }, [result]);

  return (
    <div className="col-span-full space-y-3">
      <div className="bg-gray-800 p-4 rounded flex items-center justify-between">
        <div>
          <div className="font-semibold">AI Analyze</div>
          <div className="text-sm opacity-75">
            Vygeneruje krátku sumarizáciu a plán na ďalší týždeň z tvojich dát.
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50 flex items-center gap-2"
        >
          {loading && (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          )}
          {loading ? "Analyzujem…" : "Analyze"}
        </button>
      </div>

      {err && (
        <div className="bg-red-900/30 border border-red-600 text-red-200 p-3 rounded">
          <div className="font-semibold mb-0.5">AI error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}

      {/* Diagnostická lišta (voliteľná, nechaj kľudne zobrazené pri debugu) */}
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

      {/* Narrative */}
      {result?.narrative && <CoachNarrative narrative={result.narrative} />}

      {/* Výsledok (summary + calendar/plan) */}
      {result && (
        <div className="bg-gray-800 p-4 rounded">
          <p className="opacity-70 text-sm mb-2">
            model: <b>{model}</b>
            {result?.analysis?._meta?.plan_source === "fallback_min" && (
              <span className="ml-2 inline-block text-xs bg-amber-600/30 border border-amber-600 text-amber-200 px-2 py-0.5 rounded">
                fallback plan
              </span>
            )}
          </p>
          <PlanResult result={result} />
          {!planExists && (
            <details className="mt-3">
              <summary className="cursor-pointer">Raw output</summary>
              <pre className="text-xs bg-black/40 p-2 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}