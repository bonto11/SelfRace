// src/app/(protected)/coach/page.tsx
// Stránka AI Coach: skladá komponenty (PrefsForm, PersonalBestsPanel, GoalPicker, Calendar),
// volá backend /coach/analyze a používá globálny InfoMessage host (success/error).

"use client";

import { useMemo, useState, useCallback } from "react";

import { Calendar, GoalPicker, PrefsForm, PersonalBestsPanel } from "@/features/coach/components";
import { extractDailyPlan } from "@/features/coach/utils/plan";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import type { UserBest } from "@/shared/api/bests"; // ak si typ presunul do services, uprav cestu
import SportsBestsAccordion from "@/features/coach/components/SportsBestsAccordion";

import useInfoMessage from "@/shared/hooks/useInfoMessage";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

function mergePrefs(prev: CoachPrefs | null, patch: Partial<CoachPrefs>): CoachPrefs {
  return { ...(prev ?? ({} as CoachPrefs)), ...patch };
}

export default function ClientPage() {
  const { userId } = useUserId();
  const { success, error } = useInfoMessage();   // ✅ jeden hook, žiadne duplicitné volania

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [bests, setBests] = useState<UserBest[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const updatePrefs = useCallback(
    (patch: Partial<CoachPrefs>) => setPrefs((p) => mergePrefs(p, patch)),
    []
  );

  const canAnalyze =
    !!userId &&
    !!prefs &&
    !!(prefs.primary_sports ?? prefs.sports)?.length &&
    !!prefs.weeks &&
    !loading;

  async function handleAnalyze() {
    if (!canAnalyze || !userId || !prefs) return;
    setLoading(true);
    setResult(null);

    try {
      const goalText =
        prefs.goal_text_override ??
        (prefs.goal_kind === "race_time"
          ? `Zlepšiť čas na ${prefs.distance} (aktuálne ${prefs.current_pace || "?"}/km → cieľ ${prefs.target_pace || "?"}/km`
          : prefs.goal_kind === "improve_speed"
          ? "Zlepšiť rýchlosť"
          : prefs.goal_kind === "improve_endurance"
          ? "Zlepšiť vytrvalosť"
          : prefs.goal_kind === "improve_overall"
          ? "Zlepšiť celkovo"
          : "Udržať kondíciu");

      const payload = {
        weeks: prefs.weeks,
        goal: goalText,
        primary_sports: prefs.primary_sports ?? prefs.sports,
        goal_structured: prefs,
        bests,
      };

      const res = await fetch(`${API_URL}/coach/analyze/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`);
      }

      const json = await res.json();
      if (!json?.success) throw new Error(json?.detail || "Unknown error");

      setResult(json);
      success(`Analýza hotová (${json.model}${json.analysis?._meta?.plan_source === "fallback_min" ? " • fallback plan" : ""})`);
    } catch (e: any) {
      error(`AI error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const daily = useMemo(() => {
    const plan = result?.analysis?.next_week_plan;
    return plan ? extractDailyPlan(plan) : null;
  }, [result]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">AI Coach</h2>

      <PrefsForm value={prefs ?? undefined} onChange={updatePrefs} />
      <SportsBestsAccordion />
      <GoalPicker value={prefs ?? undefined} onChange={setPrefs} />

      <div className="pt-1">
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
          {loading ? "Analyzujem…" : "Analyze"}
        </button>
      </div>

      {result && (
        <div className="bg-gray-800 p-4 rounded space-y-4">
          {result.analysis?.summary && (
            <div>
              <h3 className="font-semibold">Summary</h3>
              <p>{result.analysis.summary}</p>
            </div>
          )}

          {daily ? (
            <Calendar daily={daily} />
          ) : result.analysis?.next_week_plan ? (
            <details open>
              <summary className="cursor-pointer">Raw plan</summary>
              <pre className="text-xs bg-black/40 p-2 rounded overflow-auto">
                {JSON.stringify(result.analysis.next_week_plan, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}