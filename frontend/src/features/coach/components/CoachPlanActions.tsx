// src/features/coach/components/CoachPlanActions.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";

import Button from "@/shared/components/ui/Button";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import { apiGetPrefs } from "@/features/coach/api/prefs";
import { buildAnalyzePayloadFromPrefs } from "@/features/coach/utils/coachAnalyzePayload";
import { apiAnalyzeAthleteState } from "@/features/coach/api/coach_athlete_state";

const COACH_DEBUG = true;

/* ───────────────────────── helpers ───────────────────────── */

function readPrefsFromStorage(): CoachPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const rawUP = localStorage.getItem("up:coach.prefs");
    if (rawUP) return JSON.parse(rawUP);
    const raw = localStorage.getItem("coach.prefs");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Mini summary v hornej kartičke */
function PrefsMini({ prefs }: { prefs: CoachPrefs | null }) {
  if (!prefs)
    return <div className="text-sm opacity-75">— preferences nenačítané —</div>;

  const main = (prefs as any).main_sport ?? prefs.primary_sports?.[0] ?? "—";
  const sec =
    (prefs as any).secondary_mix
      ?.filter((x: any) => Number(x?.share_pct) > 0)
      .map((x: any) => x.sport)
      .join(", ") || "—";

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      <div className="opacity-75">Goal</div>
      <div className="font-semibold truncate">{prefs.goal_kind ?? "—"}</div>

      <div className="opacity-75">Weeks</div>
      <div className="font-semibold">{prefs.weeks ?? "—"}</div>

      <div className="opacity-75">Plan start</div>
      <div className="font-semibold">{(prefs as any).start_date ?? "—"}</div>

      <div className="opacity-75">Main</div>
      <div className="font-semibold">{main}</div>

      <div className="opacity-75">Secondary</div>
      <div className="font-semibold truncate">{sec}</div>

      <div className="opacity-75">Strength mode</div>
      <div className="font-semibold">
        {(prefs as any)?.strength_settings?.equipment_mode ?? "—"} ·{" "}
        {(prefs as any)?.strength_settings?.location ?? "—"}
      </div>
    </div>
  );
}

/** Debug JSON blok – v prod móde vypnutý */
function JsonBlock({ title, data }: { title: string; data: any }) {
  if (!COACH_DEBUG) return null;
  if (!data) return null;
  return (
    <details
      className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2"
      open
    >
      <summary className="cursor-pointer select-none text-sm font-semibold py-1">
        {title}
      </summary>
      <pre className="mt-2 max-h-80 overflow-auto text-xs leading-5">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

type AthleteStateResult = {
  analysis: any | null; // CoachAthleteState
  input: any | null;    // CoachAnalyzeInput
  model: string | null;
  state_id: number | null;
};

/* ─────────────────────── hlavný komponent ─────────────────────── */

export default function CoachPlanActions() {
  const { userId } = useUserId();
  const { pbRun } = useCoachData();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [result, setResult] = useState<AthleteStateResult | null>(null);
  const [debugPayload, setDebugPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // načítaj prefs z DB / storage
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const p = await apiGetPrefs(userId).catch(() => null);
        const eff = p ?? readPrefsFromStorage();
        setPrefs(eff);
      } catch {
        setPrefs(readPrefsFromStorage());
      }
    })();
  }, [userId]);

  const handleAnalyze = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    setLoading(true);

    try {
      // čerstvé prefs z DB (fallback storage)
      const fresh = await apiGetPrefs(userId).catch(() => null);
      const effectivePrefs = fresh ?? prefs ?? readPrefsFromStorage();
      if (!effectivePrefs) {
        throw new Error("Preferences not found in DB or storage.");
      }
      setPrefs(effectivePrefs);

      const base = buildAnalyzePayloadFromPrefs(effectivePrefs);
      const payload = {
        ...base,
        bests: { run: pbRun ?? [] },
      };

      setDebugPayload(payload);

      const json = await apiAnalyzeAthleteState(userId, payload, {
        debugRaw: true,
      });

      // POZOR: backend vracia `state`, nie `analysis`
      setResult({
        analysis: json.state ?? null,
        input: json.input ?? null,
        model: json.model ?? null,
        state_id: json.state_id ?? null,
      });

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "coach.athlete_state",
            JSON.stringify(json.state ?? null)
          );
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, prefs, pbRun]);

  const canAnalyze = !!userId && !loading;

  const summary =
    result?.analysis && typeof result.analysis === "object"
      ? {
          generated_at: (result.analysis as any).generated_at ?? null,
          model: result.model ?? null,
          state_id: result.state_id ?? null,
        }
      : null;

  return (
    <div className="space-y-4">
      {/* prefs / basic info */}
      <div className="rounded-xl border border-white/10 p-3 bg-white/5">
        <PrefsMini prefs={prefs} />
        {summary && (
          <div className="mt-2 text-xs text-emerald-300">
            Athlete state:&nbsp;
            <span className="font-semibold">
              {summary.generated_at ?? "—"}
            </span>{" "}
            · model{" "}
            <span className="font-semibold">
              {summary.model ?? "—"}
            </span>
            {summary.state_id != null && (
              <>
                {" "}
                · state_id{" "}
                <span className="font-semibold">{summary.state_id}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* tlačidlo */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          variant="primary"
          size="sm"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              Analyzing…
            </span>
          ) : (
            "Analyze athlete state"
          )}
        </Button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 text-red-100 p-3">
          <div className="font-semibold mb-0.5">Error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}

      {/* debug JSON bloky */}
      <div className="space-y-2">
        <JsonBlock
          title="Prefs (effective: DB → storage fallback)"
          data={prefs}
        />
        <JsonBlock title="Sent payload (FE→BE)" data={debugPayload} />
        <JsonBlock
          title="Athlete state (CoachAthleteState)"
          data={result?.analysis}
        />
        <JsonBlock
          title="Analyze input (CoachAnalyzeInput)"
          data={result?.input}
        />
      </div>
    </div>
  );
}