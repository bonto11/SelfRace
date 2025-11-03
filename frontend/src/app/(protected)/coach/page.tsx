"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";
// (voliteľné – ak máš súbor existujúci; ak nie, netreba import)
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";
import WidgetPB from "@/features/widgets/WidgetPB";
import WidgetActivitiesCalendar from "@/features/widgets/WidgetActivitiesCalendar";

type PrefsFromDB = CoachPrefs | null;

export default function Page() {
  const router = useRouter();
  const { userId } = useUserId();

  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<PrefsFromDB>(null);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // 1) Skús načítať prefs z DB (key: "coach.prefs")
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        setErr(null);
        // Preferuj oficiálny endpoint ak ho máš:
        //  - /coach/prefs/:userId  (náš BE návrh)
        //  - alebo /userprefs?key=coach.prefs (ak máš starší)
        let js: any = null;

        // pokus 1: nový návrh
        try {
          const r = await fetch(`${API_URL}/coach/prefs/${userId}`, {
            cache: "no-store",
          });
          js = await r.json().catch(() => ({}));
          if (js?.prefs) {
            if (alive) setPrefs(js.prefs as CoachPrefs);
            return;
          }
        } catch {
          /* prepadni na ďalší pokus */
        }

        // pokus 2: starší generický endpoint (upravený podľa tvojho BE)
        try {
          const r = await fetch(
            `${API_URL}/userprefs/${userId}?key=coach.prefs`,
            { cache: "no-store" }
          );
          js = await r.json().catch(() => ({}));
          if (js?.value) {
            if (alive) setPrefs(js.value as CoachPrefs);
            return;
          }
        } catch {
          /* nič */
        }

        // fallback – nech máme aspoň niečo použiteľné
        if (alive) {
          setPrefs({
            goal_kind: "improve_overall",
            weeks: 8,
            primary_sports: ["run", "ride", "strength"],
            preferences: {
              days_off: [],
              avoid_back_to_back_hard: true,
              use_zones: true,
              wu_cd_detail: true,
              long_run_days: [],
            },
            targets: {
              run: {
                race_goal: null,
                current_best_time: null,
                target_time: null,
                longest_recent_distance_km: null,
              },
              ride: { focus: "endurance", weekly_time_target_min: null },
              strength: { focus: "general", sessions_per_week: 2 },
            },
          });
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || String(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const canAnalyze = useMemo(
    () => Boolean(userId && !loading),
    [userId, loading]
  );

  async function handleAnalyze() {
    if (!userId || !canAnalyze) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      // Vytvor payload z prefs (bez ohľadu na to, či sú z DB alebo fallback)
      const payload = toAnalyzePayloadBE(
        (prefs ?? {
          goal_kind: "improve_overall",
          weeks: 8,
          primary_sports: ["run", "ride", "strength"],
        }) as any
      );

      const json = await analyzeCoach(userId, payload);
      setResult(json);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 grid gap-4 md:grid-cols-2">
      <div className="p-4 grid gap-4 md:grid-cols-2">
        <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
        <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
        <WidgetActivitiesCalendar />
      </div>

      {/* Quick Analyze blok */}
      <div className="md:col-span-2 bg-gray-900/40 border border-gray-700 rounded p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI Coach – Analyze</h2>
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

        {/* krátky prehľad, čo ide do analýzy */}
        <div className="text-xs opacity-80">
          <div>
            <b>Prefs:</b> {prefs ? "OK" : "fallback"}
          </div>
          <div>
            <b>Weeks:</b> {prefs?.weeks ?? 8} · <b>Sports:</b>{" "}
            {(prefs?.primary_sports ?? ["run", "ride", "strength"]).join(", ")}{" "}
            · <b>Goal:</b> {prefs?.goal_kind ?? "improve_overall"}
          </div>
        </div>

        {err && (
          <div className="bg-red-900/30 border border-red-600 text-red-200 p-3 rounded">
            <div className="font-semibold mb-0.5">AI error</div>
            <p className="text-sm opacity-90">{err}</p>
          </div>
        )}

        {result && (
          <details open className="bg-black/30 rounded">
            <summary className="cursor-pointer px-2 py-1">Raw output</summary>
            <pre className="text-xs p-2 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
