// src/app/(protected)/coach/page.tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { Calendar, GoalPicker, PrefsForm, PersonalBestsPanel } from "@/features/coach/components";
import { useInfoMessage } from "@/shared/components/InfoMessageProvider";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import type { UserBest } from "@/shared/api/bests";

function mergePrefs(prev: CoachPrefs | null, patch: Partial<CoachPrefs>): CoachPrefs {
  return { ...(prev ?? ({} as CoachPrefs)), ...patch };
}

export default function CoachPage() {
  const { userId } = useUserId();
  const { show } = useInfoMessage();

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
      show(`Analýza hotová • ${json.model}${json.analysis?._meta?.plan_source === "fallback_min" ? " • fallback" : ""}`, { kind: "success" });
    } catch (e: any) {
      show(`AI error: ${e?.message || String(e)}`, { kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  const daily = useMemo(() => {
    const plan = result?.analysis?.next_week_plan;
    // ak používaš helper z Calendar, zachovaj:
    // return plan ? extractDailyPlan(plan) : null;
    return plan ? null : null; // <- nechávam podľa toho čo už máš
  }, [result]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">AI Coach</h2>

      <PrefsForm value={prefs ?? undefined} onChange={updatePrefs} />
      <PersonalBestsPanel value={bests} onChange={setBests} />
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
          {/* … tvoje rendrovanie summary/kalendára … */}
        </div>
      )}
    </div>
  );
}