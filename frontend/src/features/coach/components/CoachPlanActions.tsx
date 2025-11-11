"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { getPrefs } from "@/features/coach/api/prefs";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import Button from "@/shared/components/ui/Button";
import Pill from "@/shared/components/ui/Pill";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { THEME } from "@/shared/theme/tokens";
import { makeCacheKey, saveCachedResult, loadCachedResult, clearCachedByKey } from "@/features/coach/utils/cache";
import PlanResult from "@/features/coach/components/PlanResult";
import { saveActivePlan, updateActivePlan } from "@/features/coach/api/plan";
import { SURFACE_INLINE } from "@/shared/ui/classes";

/* --- mini debug blok --- */
function JsonBlock({ title, data }: { title: string; data: any }) {
  if (!data) return null;
  return (
    <details className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2" open>
      <summary className="cursor-pointer select-none text-sm font-semibold py-1">{title}</summary>
      <pre className="mt-2 max-h-72 overflow-auto text-xs leading-5">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

/* --- mini sumár prefs hore --- */
function PrefsMini({ prefs }: { prefs: CoachPrefs | null }) {
  if (!prefs) return (
    <div className="text-sm opacity-75">— preferences nenačítané —</div>
  );
  const main = (prefs as any).main_sport ?? prefs.primary_sports?.[0] ?? "—";
  const sec  = (prefs as any).secondary_mix?.filter((x: any)=> Number(x?.share_pct)>0).map((x:any)=>x.sport).join(", ") || "—";
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      <div className="opacity-75">Goal</div><div className="font-semibold truncate">{prefs.goal_kind ?? "—"}</div>
      <div className="opacity-75">Weeks</div><div className="font-semibold">{prefs.weeks ?? "—"}</div>
      <div className="opacity-75">Plan start</div><div className="font-semibold">{(prefs as any).plan_start_date ?? "—"}</div>
      <div className="opacity-75">Main</div><div className="font-semibold">{main}</div>
      <div className="opacity-75">Secondary</div><div className="font-semibold truncate">{sec}</div>
      <div className="opacity-75">Strength mode</div>
      <div className="font-semibold">
        {(prefs as any)?.strength_settings?.mode ?? "—"} · {(prefs as any)?.strength_settings?.location ?? "—"}
      </div>
    </div>
  );
}

/* ===== Stavový automat (jasné mená krokov) ===== */
type StepKey =
  | "loading_prefs"
  | "preparing_inputs"
  | "checking_cache"
  | "sending_request"
  | "ai_generating"
  | "parsing_response"
  | "saving_storage"
  | "ready";

type Step = { key: StepKey; label: string; state: "idle" | "active" | "ok" | "err" };

const STEP_DEFS: Record<StepKey, string> = {
  loading_prefs:   "Loading preferences",
  preparing_inputs:"Preparing inputs for AI",
  checking_cache:  "Checking cache",
  sending_request: "Sending request",
  ai_generating:   "Generating plan (AI)",
  parsing_response:"Parsing response",
  saving_storage:  "Saving to storage",
  ready:           "Ready",
};

function StepsView({ steps }: { steps: Step[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-2 mt-2">
      {steps.map(s => {
        const color =
          s.state === "active" ? THEME.chart.good :
          s.state === "ok"     ? THEME.chart.fitness :
          s.state === "err"    ? THEME.chart.poor :
          THEME.chart.neutral;
        return (
          <div key={s.key} className={[SURFACE_INLINE, "px-3 py-2 text-xs"].join(" ")}>
            <div className="flex items-center gap-2">
              <Pill label={STEP_DEFS[s.key]} color={color} />
              {s.state === "active" && <LoadingSpinner size="button" />}
              {s.state === "ok" && <span>✓</span>}
              {s.state === "err" && <span>✕</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function useSteps() {
  const [steps, set] = useState<Step[]>(
    (Object.keys(STEP_DEFS) as StepKey[]).map(k => ({ key: k, label: STEP_DEFS[k], state: "idle" }))
  );
  const setState = (key: StepKey, state: Step["state"]) =>
    set(prev => prev.map(s => (s.key === key ? { ...s, state } : s)));
  const reset = () => set(prev => prev.map(s => ({ ...s, state: "idle" })));
  return { steps, setState, reset };
}

export default function CoachPlanActions() {
  const { userId } = useUserId();
  const { pbRun } = useCoachData();

  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [diag, setDiag] = useState<{ source: "cache" | "ai" | null; model?: string | null } | null>(null);
  const [debugPayload, setDebugPayload] = useState<any>(null);

  const { steps, setState: step, reset: resetSteps } = useSteps();

  const cacheKey = useMemo(() => (userId && prefs ? makeCacheKey(String(userId), prefs) : undefined), [userId, prefs]);
  const canRun = !!userId && !loading;

  // načítaj prefs na mount
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        step("loading_prefs", "active");
        const p = await getPrefs(userId);
        setPrefs(p);
        step("loading_prefs", "ok");
      } catch {
        step("loading_prefs", "err");
      }
    })();
  }, [userId, step]);

  const handleGenerate = useCallback(async () => {
    if (!userId) return;
    resetSteps();
    setLoading(true);
    setErr(null);
    const t0 = performance.now();

    try {
      // Loading preferences (fresh)
      step("loading_prefs", "active");
      const fresh = await getPrefs(userId);
      if (!fresh) throw new Error("Preferences not found in DB.");
      setPrefs(fresh);
      step("loading_prefs", "ok");

      // Preparing inputs
      step("preparing_inputs", "active");
      const base = toAnalyzePayloadBE(fresh);
      const payload = { ...base, goal_structured: fresh, bests: { run: pbRun ?? [] } };
      setDebugPayload(base);
      step("preparing_inputs", "ok");

      // Checking cache
      step("checking_cache", "active");
      const ck = makeCacheKey(String(userId), fresh);
      const cached = loadCachedResult(ck);
      if (cached?.result) {
        step("checking_cache", "ok");
        step("sending_request", "ok");
        step("ai_generating", "ok");
        step("parsing_response", "ok");
        step("saving_storage", "active");
        setAnalysis(cached.result.analysis);
        setDiag({ source: "cache", model: cached.result.model });
        try { localStorage.setItem("coach.generated", JSON.stringify(cached.result.analysis)); } catch {}
        step("saving_storage", "ok");
        step("ready", "ok");
        return;
      }
      step("checking_cache", "ok");

      // Sending request
      step("sending_request", "active");
      // Generating plan (AI)
      step("ai_generating", "active");
      const json = await analyzeCoach(userId, payload);
      step("sending_request", "ok");
      step("ai_generating", "ok");

      // Parsing response
      step("parsing_response", "active");
      if (!json?.success) throw new Error(json?.detail || "Analyze failed");
      setAnalysis(json.analysis);
      setDiag({ source: "ai", model: json.model });
      saveCachedResult(ck, json, json?.model);
      step("parsing_response", "ok");

      // Saving to storage
      step("saving_storage", "active");
      try { localStorage.setItem("coach.generated", JSON.stringify(json.analysis)); } catch {}
      step("saving_storage", "ok");

      step("ready", "ok");
      const t1 = performance.now();
      // ľahké časovanie do konzoly
      // eslint-disable-next-line no-console
      console.log(`[CoachPlan] done in ${(t1 - t0).toFixed(0)} ms`);
    } catch (e: any) {
      setErr(e?.message || "Generate failed");
      // označ prvý aktívny krok ako err
      const firstActive = steps.find(s => s.state === "active");
      if (firstActive) step(firstActive.key, "err");
    } finally {
      setLoading(false);
    }
  }, [userId, pbRun, steps, step, resetSteps]);

  const handleStart = useCallback(async () => {
    try {
      const raw = localStorage.getItem("coach.generated");
      if (!raw) throw new Error("Najprv vygeneruj plán (Generate).");
      const plan = JSON.parse(raw);
      const meta = {
        started_at_iso: new Date().toISOString(),
        plan_start_date: (prefs as any)?.plan_start_date ?? null,
        weeks: (prefs as any)?.weeks ?? null,
      };
      const payload = { plan, meta };
      if (!userId) throw new Error("Chýba userId.");
      await saveActivePlan(userId, payload);
    } catch (e: any) {
      setErr(e?.message || "Start failed");
    }
  }, [prefs, userId]);

  const handleUpdate = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      const updated = await updateActivePlan(userId);
      if (updated) {
        localStorage.setItem("coach.active", JSON.stringify(updated));
      }
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }, [userId]);

  const handleClearCache = useCallback(() => {
    if (cacheKey) clearCachedByKey(cacheKey);
  }, [cacheKey]);

  return (
    <div className="space-y-4">
      {/* mini sumár prefs */}
      <div className="rounded-xl border border-white/10 p-3 bg-white/5">
        <PrefsMini prefs={prefs} />
      </div>

      {/* ovládanie */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleGenerate} disabled={!canRun} variant="primary" size="sm">
          {loading ? <span className="inline-flex items-center gap-2"><LoadingSpinner size="widget" /> Generating…</span> : "Generate plan"}
        </Button>
        <Button onClick={handleStart} disabled={loading} variant="success" size="sm">Start plan</Button>
        <Button onClick={handleUpdate} disabled={loading} variant="secondary" size="sm">Update plan</Button>
        <Button onClick={handleClearCache} disabled={loading} variant="danger" size="sm">Clear cache</Button>

        {diag && (
          <div className="ml-auto flex flex-wrap gap-2 text-xs">
            <Pill label={`source: ${diag.source ?? "—"}`} color={THEME.chart.neutral} />
            <Pill label={`model: ${diag.model ?? "—"}`}  color={THEME.chart.neutral} />
          </div>
        )}
      </div>

      {/* stavový automat */}
      <StepsView steps={steps} />

      {err && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 text-red-100 p-3">
          <div className="font-semibold mb-0.5">Error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}

      {/* výsledok */}
      {analysis && (
        <div className="rounded-xl border border-white/10 p-3 bg-white/5">
          <PlanResult result={{ analysis, narrative: null, model: diag?.model }} />
        </div>
      )}

      {/* debug */}
      <div className="space-y-2">
        <JsonBlock title="Prefs (fresh DB)" data={prefs} />
        <JsonBlock title="Sent payload (FE→BE)" data={debugPayload} />
        <JsonBlock title="Generated (analysis)" data={analysis} />
      </div>
    </div>
  );
}