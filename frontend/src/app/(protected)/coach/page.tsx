"use client";

import { useMemo, useState, useCallback } from "react";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";
import Calendar, { extractDailyPlan } from "@/components/Coach/Calendar";
import BestsEditor from "@/components/Coach/BestsEditor";
import GoalPicker from "@/components/Coach/GoalPicker";
import PrefsForm from "@/components/Coach/PrefsForm";
import type { CoachPrefs } from "@/components/Coach/prefsTypes";

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg">
      <div className="mb-1">{msg}</div>
      <button className="underline text-xs opacity-80" onClick={onClose}>OK</button>
    </div>
  );
}

function mergePrefs(prev: CoachPrefs | null, patch: Partial<CoachPrefs>): CoachPrefs {
  return { ...(prev ?? ({} as CoachPrefs)), ...patch };
}

export default function CoachPage() {
  const { userId } = useUserId();
  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [bests, setBests] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const updatePrefs = useCallback(
    (patch: Partial<CoachPrefs>) => setPrefs(p => mergePrefs(p, patch)),
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
          ? `Zlepšiť čas na ${prefs.distance} (aktuálne ${prefs.current_pace || "?"}/km → cieľ ${prefs.target_pace || "?"}/km)`
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
        bests, // ak chceš posielať PB aj do backendu
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
      setToast(
        `✅ Analýza hotová (${json.model}${json.analysis?._meta?.plan_source === "fallback_min" ? " • fallback plan" : ""})`
      );
    } catch (e: any) {
      setToast(`❌ AI error: ${e?.message || String(e)}`);
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

      {/* Preferences POD AI Coach */}
      <PrefsForm value={prefs ?? undefined} onChange={updatePrefs} />

      {/* Personal Bests – read-only + ⚙️ */}
      <BestsEditor value={bests} onChange={setBests} />

      {/* Goal picker (znovu distance/current/target pri race_time) */}
      <GoalPicker value={prefs ?? undefined} onChange={setPrefs} />

      {/* Analyze tlačidlo úplne pod tým */}
      <div className="pt-1">
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

      {/* Výstup */}
      {result && (
        <div className="bg-gray-800 p-4 rounded space-y-4">
          <p className="opacity-80 text-sm">
            model: {result.model}
            {result.analysis?._meta?.plan_source === "fallback_min" && (
              <span className="ml-2 rounded bg-yellow-700/40 px-1.5 py-0.5 text-xs">fallback plan</span>
            )}
          </p>

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

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}