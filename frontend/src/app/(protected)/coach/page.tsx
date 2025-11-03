"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";

import WidgetPB from "@/features/widgets/WidgetPB";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";
import WidgetActivitiesCalendar from "@/features/widgets/WidgetActivitiesCalendar";

import { CoachDataProvider, useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";

import PlanResult from "@/features/coach/components/PlanResult";
import CoachNarrative from "@/features/coach/components/CoachNarrative";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";

function AnalyzePanel() {
  const { userId } = useUserId();
  const { prefs, pbRun } = useCoachData();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const canAnalyze = !!userId && !!prefs && !loading;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze || !userId) return;
    setLoading(true);
    setErr(null);
    setResult(null);

    try {
      // základný payload (weeks/goal/primary_sports)
      const base = toAnalyzePayloadBE(prefs);

      // doplníme, aby BE mal kontext (takto si to posielal v raw)
      const payload = {
        ...base,
        goal_structured: prefs,
        bests: { run: pbRun }, // voliteľné – posielame PB bežca
      };

      const json = await analyzeCoach(userId, payload);
      setResult(json);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [canAnalyze, userId, prefs, pbRun]);

  // pomocné info o poslednom modeli
  const model = result?.model || "—";

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

      {/* Narrative (period + last week) */}
      {result?.narrative && <CoachNarrative narrative={result.narrative} />}

      {/* Výsledok (summary + calendar plan) */}
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
        </div>
      )}
    </div>
  );
}

function ClientPage() {
  const router = useRouter();
  return (
    <div className="p-4 grid gap-4 md:grid-cols-2">
      <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
      <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      <WidgetActivitiesCalendar />

      {/* nový panel – plná šírka pod widgetmi */}
      <AnalyzePanel />
    </div>
  );
}

export default function Page() {
  return (
    <CoachDataProvider>
      <ClientPage />
    </CoachDataProvider>
  );
}