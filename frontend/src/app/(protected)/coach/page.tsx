// src/app/coach/page.tsx
"use client";

import { useState } from "react";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";

export default function CoachPage() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState(6);
  const [goal, setGoal] = useState("Zlepšiť 10 km čas o 2-3% v 6-8 týždňoch");
  const [sports, setSports] = useState<string[]>(["run","bike","strength"]);
  const [loading, setLoading] = useState(false);

  const [contextDbg, setContextDbg] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const toggleSport = (s:string) =>
    setSports(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);

  async function handleAnalyze() {
    if (!userId) return;
    setLoading(true); setError(null); setResult(null); setContextDbg(null);
    try {
      // 1) context (debug)
      const ctxRes = await fetch(`${API_URL}/coach/context/${userId}?weeks=${weeks}`);
      const ctxJson = await ctxRes.json();
      setContextDbg(ctxJson);

      // 2) analysis
      const res = await fetch(`${API_URL}/coach/analyze/${userId}`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ weeks, goal, primary_sports: sports })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.detail || "Unknown error");
      setResult(json);
      console.log("[Coach] analysis", json);
    } catch (e:any) {
      console.error(e);
      setError(e.message || "Analyze error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">AI Coach (MVP)</h1>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
        <div className="flex gap-3 items-center">
          <label className="text-sm opacity-80">Weeks:</label>
          {[4,6,8,12].map(w => (
            <button key={w}
              onClick={()=>setWeeks(w)}
              className={`px-3 py-1 rounded text-sm ${weeks===w ? "bg-blue-600 text-white":"bg-gray-700"}`}
            >{w}</button>
          ))}
        </div>

        <div>
          <label className="block text-sm opacity-80 mb-1">Goal</label>
          <input
            className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-600 rounded p-2"
            value={goal}
            onChange={e=>setGoal(e.target.value)}
            placeholder="Napíš cieľ (preteky, výkon...)"
          />
        </div>

        <div className="flex gap-3 items-center">
          <span className="text-sm opacity-80">Sports:</span>
          {["run","bike","strength"].map(s => (
            <label key={s} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={sports.includes(s)} onChange={()=>toggleSport(s)} />
              {s}
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={!userId || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? "Analyzujem…" : "Analyze last weeks"}
          </button>
        </div>
      </div>

      {/* Result */}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-200 p-3 rounded">{error}</div>}

      {result && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-4">
          <h2 className="text-lg font-semibold">Výstup</h2>
          <p className="opacity-80">model: {result.model}</p>

          <div>
            <h3 className="font-bold mb-1">Summary</h3>
            <p>{result.analysis?.summary}</p>
          </div>

          {Array.isArray(result.analysis?.insights) && (
            <div>
              <h3 className="font-bold mb-1">Insights</h3>
              <ul className="list-disc pl-5">
                {result.analysis.insights.map((i:string, idx:number)=> <li key={idx}>{i}</li>)}
              </ul>
            </div>
          )}

          {Array.isArray(result.analysis?.red_flags) && result.analysis.red_flags.length>0 && (
            <div>
              <h3 className="font-bold mb-1">Red flags</h3>
              <ul className="list-disc pl-5">
                {result.analysis.red_flags.map((r:any, idx:number)=>(
                  <li key={idx}><b>{r.type}:</b> {r.details} <span className="opacity-70">({r.evidence})</span></li>
                ))}
              </ul>
            </div>
          )}

          {result.analysis?.next_week_plan && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-900/30 border border-gray-700 rounded p-3">
                <h4 className="font-semibold mb-1">Run</h4>
                <p className="text-sm opacity-80">weekly_km_target: {result.analysis.next_week_plan.run?.weekly_km_target ?? "—"}</p>
                <ul className="list-disc pl-5">
                  {(result.analysis.next_week_plan.run?.sessions ?? []).map((s:any, i:number)=>(
                    <li key={i}><b>{s.title}</b> — {s.duration_min} min {s.intensity ? `(${s.intensity})`:""} {s.notes?`– ${s.notes}`:""}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-gray-900/30 border border-gray-700 rounded p-3">
                <h4 className="font-semibold mb-1">Bike</h4>
                <p className="text-sm opacity-80">weekly_time_target: {result.analysis.next_week_plan.bike?.weekly_time_target_min ?? "—"} min</p>
                <ul className="list-disc pl-5">
                  {(result.analysis.next_week_plan.bike?.sessions ?? []).map((s:any, i:number)=>(
                    <li key={i}><b>{s.title}</b> — {s.duration_min} min</li>
                  ))}
                </ul>
              </div>
              <div className="bg-gray-900/30 border border-gray-700 rounded p-3 md:col-span-2">
                <h4 className="font-semibold mb-1">Strength</h4>
                <ul className="list-disc pl-5">
                  {(result.analysis.next_week_plan.strength?.sessions ?? []).map((s:any, i:number)=>(
                    <li key={i}><b>{s.title}</b> — {s.duration_min} min</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm opacity-80"><b>Rest days:</b> {(result.analysis.next_week_plan.rest_days ?? []).join(", ")}</p>
              </div>
            </div>
          )}

          <details className="mt-2">
            <summary className="cursor-pointer">Debug – raw JSON</summary>
            <pre className="text-xs mt-2 bg-black/40 p-2 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          </details>

          {contextDbg && (
            <details className="mt-2">
              <summary className="cursor-pointer">Debug – context</summary>
              <pre className="text-xs mt-2 bg-black/40 p-2 rounded overflow-auto">{JSON.stringify(contextDbg, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}