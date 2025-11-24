// src/features/coach/components/CoachPlanActions.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";

import { getPrefs } from "@/features/coach/api/prefs";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

import PlanResult from "@/features/coach/components/PlanResult";

import { saveActivePlan, updateActivePlan } from "@/features/coach/api/plan";
import {
  makeCacheKey,
  saveCachedResult,
  loadCachedResult,
  clearCachedByKey,
} from "@/features/coach/utils/cache";

import Button from "@/shared/components/ui/Button";
import Pill from "@/shared/components/ui/Pill";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { THEME } from "@/shared/theme/tokens";
import { API_URL as RAW_API_URL } from "@/shared/config";

const API_URL: string = RAW_API_URL ?? "";

/**
 * Globálny prepínač:
 * - false  = production mód (žiadne debug bloky, minimum UI)
 * - true   = developer mód (stavový panel, JSON bloky, extra logy)
 */
const COACH_DEBUG = false; // nastav si na false pre „normálny“ režim

/* ────────────── UI helpers ────────────── */
function JsonBlock({ title, data }: { title: string; data: any }) {
  if (!COACH_DEBUG) return null;
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

function PrefsMini({ prefs }: { prefs: CoachPrefs | null }) {
  if (!prefs) return <div className="text-sm opacity-75">— preferences nenačítané —</div>;
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

/* ────────────── Steps (stavový panel) ────────────── */
type StepName =
  | "Loading preferences"
  | "Preparing inputs for AI"
  | "Checking cache"
  | "Sending request"
  | "Generating plan (AI)"
  | "Parsing response"
  | "Saving to storage";

type StepState = {
  name: StepName;
  state: "idle" | "active" | "done" | "error";
  note?: string;
};

const STEP_NAMES = [
  "Loading preferences",
  "Preparing inputs for AI",
  "Checking cache",
  "Sending request",
  "Generating plan (AI)",
  "Parsing response",
  "Saving to storage",
] as const;

const now = () => new Date().toLocaleTimeString();
const makeSteps = (st: StepState["state"] = "idle"): StepState[] =>
  (STEP_NAMES as readonly StepName[]).map((name) => ({ name, state: st }));

/* ────────────── Storage fallback ────────────── */
function readPrefsFromStorage(): CoachPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const rawUP = localStorage.getItem("up:coach.prefs");
    if (rawUP) return JSON.parse(rawUP);
    const raw = localStorage.getItem("coach.prefs");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    if (COACH_DEBUG) {
      console.warn("[CoachPlan] readPrefsFromStorage error", e);
    }
    return null;
  }
}

/* ────────────── Main component ────────────── */
export default function CoachPlanActions() {
  const { userId } = useUserId();
  const { pbRun } = useCoachData();

  const [prefs, setPrefs] = useState<CoachPrefs | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const [steps, setSteps] = useState<StepState[]>(makeSteps());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [diag, setDiag] = useState<{
    source: "cache" | "ai" | null;
    model?: string | null;
  } | null>(null);
  const [debugPayload, setDebugPayload] = useState<any>(null);

  // AI raw debug polia z BE
  const [aiAttempts, setAiAttempts] = useState<any>(null);
  const [aiSystem, setAiSystem] = useState<any>(null);
  const [aiUser, setAiUser] = useState<any>(null);
  const [aiLastRaw, setAiLastRaw] = useState<any>(null);

  const cacheKey = useMemo(
    () => (userId && prefs ? makeCacheKey(String(userId), prefs) : undefined),
    [userId, prefs],
  );
  const canRun = !!userId && !loading;

  const resetSteps = useCallback(() => setSteps(makeSteps("idle")), []);
  const markOnly = useCallback(
    (active: StepName | null, note?: string) => {
      if (!COACH_DEBUG) return; // v prod režime kroky necháme, ale neprepisujeme stav
      setSteps((prev) =>
        prev.map((s) => {
          if (active === null)
            return s.state === "active"
              ? { ...s, state: "done", note: s.note }
              : s;
          if (s.name === active)
            return {
              ...s,
              state: "active",
              note: [s.note, `[${now()}] ${note ?? ""}`]
                .filter(Boolean)
                .join(" · "),
            };
          if (s.state === "active")
            return { ...s, state: "done", note: s.note };
          return s;
        }),
      );
    },
    [],
  );
  const markError = useCallback((at: StepName, note?: string) => {
    if (!COACH_DEBUG) return;
    setSteps((prev) =>
      prev.map((s) =>
        s.name === at
          ? {
              ...s,
              state: "error",
              note: [s.note, `[${now()}] ${note ?? ""}`]
                .filter(Boolean)
                .join(" · "),
            }
          : s,
      ),
    );
  }, []);

  /* Načítanie prefs (DB → storage) */
  useEffect(() => {
    if (!userId) return;
    (async () => {
      if (COACH_DEBUG) {
        console.group("[CoachPlan] useEffect load prefs");
        console.log("userId", userId);
      }
      try {
        markOnly("Loading preferences", "initial");
        const p = await getPrefs(userId).catch((e) => {
          if (COACH_DEBUG) {
            console.warn("[CoachPlan] getPrefs error, will fallback", e);
          }
          return null;
        });
        const effective = p ?? readPrefsFromStorage();
        setPrefs(effective);
        if (COACH_DEBUG) {
          console.log("prefs from DB", p);
          console.log("effective prefs", effective);
        }
        markOnly(null);
      } catch (e) {
        if (COACH_DEBUG) {
          console.error("[CoachPlan] load prefs failed", e);
        }
        setPrefs(readPrefsFromStorage());
        markOnly(null);
      } finally {
        if (COACH_DEBUG) console.groupEnd();
      }
    })();
  }, [userId, markOnly]);

  /* Generate plan — RAW DEBUG režim */
  const handleGenerate = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    setAiAttempts(null);
    setAiSystem(null);
    setAiUser(null);
    setAiLastRaw(null);
    resetSteps();
    setLoading(true);

    if (COACH_DEBUG) {
      console.group("[CoachPlan] handleGenerate");
      console.log("userId", userId);
    }

    try {
      // 1) prefs
      markOnly("Loading preferences", "fetch from DB");
      const fresh = await getPrefs(userId).catch((e) => {
        if (COACH_DEBUG) {
          console.warn("[CoachPlan] getPrefs in handleGenerate failed", e);
        }
        return null;
      });
      const effectivePrefs = fresh ?? readPrefsFromStorage();
      if (!effectivePrefs) {
        markError("Loading preferences", "none in DB nor storage");
        throw new Error("Preferences not found in DB or storage.");
      }
      setPrefs(effectivePrefs);
      if (COACH_DEBUG) {
        console.log("effectivePrefs", effectivePrefs);
      }
      markOnly(null);

      // 2) inputs
      markOnly("Preparing inputs for AI", "build payload");
      const base = toAnalyzePayloadBE(effectivePrefs);
      const payload = { ...base, bests: { run: pbRun ?? [] } };
      setDebugPayload(base);
      if (COACH_DEBUG) {
        console.log("AI base payload", base);
        console.log("AI full payload", payload);
      }

      // 3) cache
      markOnly("Checking cache");
      const ck = makeCacheKey(String(userId), effectivePrefs);
      const cached = loadCachedResult(ck);
      if (COACH_DEBUG) {
        console.log("cacheKey", ck);
        console.log("cached", cached);
      }
      if (cached?.result) {
        markOnly("Saving to storage", "from cache");
        setAnalysis(cached.result.analysis);
        setDiag({ source: "cache", model: cached.result.model });
        localStorage.setItem(
          "coach.generated",
          JSON.stringify(cached.result.analysis),
        );
        markOnly(null);
        setLoading(false);
        if (COACH_DEBUG) {
          console.log("[CoachPlan] using cached result");
          console.groupEnd();
        }
        return;
      }

      // 4) BE call – RAW debug ON, loose ON
      markOnly("Sending request", "debug_raw=1, loose=1");
      markOnly("Generating plan (AI)");
      if (COACH_DEBUG) {
        console.log(
          "[CoachPlan] calling analyzeCoach",
          `${API_URL}/coach/analyze/${userId}`,
        );
      }
      const json = await analyzeCoach(userId, payload, {
        debugRaw: true,
        loose: true,
      });

      if (COACH_DEBUG) {
        console.log("analyzeCoach response", json);
      }

      if (!json?.success) {
        const detail =
          json?.detail ||
          json?.error ||
          "Analyze failed (json.success is false)";
        markError("Generating plan (AI)", detail);
        throw new Error(detail);
      }

      // AI raw debug polia (ak BE pošle)
      setAiAttempts(json?.ai_debug?.attempts ?? null);
      setAiSystem(json?.ai_debug?.system_prompt ?? null);
      setAiUser(json?.ai_debug?.user_prompt ?? null);
      setAiLastRaw(json?.ai_debug?.last_raw ?? null);

      // 5) parse/save
      markOnly("Parsing response", "ok");
      setAnalysis(json.analysis);
      setDiag({ source: "ai", model: json.model });
      saveCachedResult(ck, json, json?.model);

      markOnly("Saving to storage");
      localStorage.setItem("coach.generated", JSON.stringify(json.analysis));
      markOnly(null);

      if (COACH_DEBUG) {
        console.log("[CoachPlan] plan generated and stored to localStorage");
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/Failed to fetch/i.test(msg)) {
        setErr(`Failed to fetch (network/CORS/timeout). API_URL=${API_URL}`);
      } else {
        setErr(msg);
      }
      if (COACH_DEBUG) {
        console.error("[CoachPlan] handleGenerate error", e);
      }
    } finally {
      setLoading(false);
      if (COACH_DEBUG) console.groupEnd();
    }
  }, [userId, pbRun, resetSteps, markOnly, markError]);

  /* Start plan */
  const handleStart = useCallback(async () => {
    if (COACH_DEBUG) {
      console.group("[CoachPlan] handleStart");
      console.log("userId", userId);
    }
    try {
      const raw = localStorage.getItem("coach.generated");
      if (!raw) throw new Error("Najprv vygeneruj plán (Generate).");
      const analysisFromStorage = JSON.parse(raw);
      if (!analysisFromStorage?.next_10_days) {
        throw new Error("Generated plan nemá next_10_days.");
      }
      if (!userId) throw new Error("Chýba userId.");

      const meta = {
        started_at_iso: new Date().toISOString(),
        plan_start_date:
          (prefs as any)?.plan_start_date ??
          (prefs as any)?.start_date ??
          null,
        weeks: (prefs as any)?.weeks ?? null,
        overwrite: true,
      };

      if (COACH_DEBUG) {
        console.log("plan (analysis)", analysisFromStorage);
        console.log("meta", meta);
      }

      const res = await saveActivePlan(userId, analysisFromStorage, meta);
      if (COACH_DEBUG) {
        console.log("saveActivePlan result", res);
      }
      if (!res?.success) {
        throw new Error("Uloženie plánu zlyhalo.");
      }
    } catch (e: any) {
      setErr(e?.message || "Start failed");
      if (COACH_DEBUG) {
        console.error("[CoachPlan] handleStart error", e);
      }
    } finally {
      if (COACH_DEBUG) console.groupEnd();
    }
  }, [prefs, userId]);

  /* Update plan */
  const handleUpdate = useCallback(async () => {
    if (COACH_DEBUG) {
      console.group("[CoachPlan] handleUpdate");
      console.log("userId", userId);
    }
    try {
      if (!userId) throw new Error("Chýba userId.");
      const updated = await updateActivePlan(userId);
      if (COACH_DEBUG) {
        console.log("updateActivePlan response", updated);
      }
      if (updated)
        localStorage.setItem("coach.active", JSON.stringify(updated));
    } catch (e: any) {
      setErr(e?.message || "Update failed");
      if (COACH_DEBUG) {
        console.error("[CoachPlan] handleUpdate error", e);
      }
    } finally {
      if (COACH_DEBUG) console.groupEnd();
    }
  }, [userId]);

  /* Clear cache */
  const handleClearCache = useCallback(() => {
    if (COACH_DEBUG) {
      console.log("[CoachPlan] handleClearCache", { cacheKey });
    }
    if (cacheKey) clearCachedByKey(cacheKey);
  }, [cacheKey]);

  /* Render krokového panelu */
  const StepsStrip = () => {
    if (!COACH_DEBUG) return null;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {steps.map((s) => {
            const base = "px-2 py-1 rounded-md text-xs border";
            const stateCls =
              s.state === "idle"
                ? "bg-slate-700/40 border-slate-600"
                : s.state === "active"
                ? "bg-cyan-700/50 border-cyan-500"
                : s.state === "done"
                ? "bg-emerald-700/50 border-emerald-500"
                : "bg-rose-800/60 border-rose-500";
            return (
              <span
                key={s.name}
                className={`${base} ${stateCls} inline-flex items-center gap-1`}
              >
                {s.state === "active" && (
                  <LoadingSpinner size="widget" />
                )}
                {s.name}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* mini sumár prefs */}
      <div className="rounded-xl border border-white/10 p-3 bg-white/5">
        <PrefsMini prefs={prefs} />
      </div>

      {/* ovládanie */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleGenerate}
          disabled={!canRun}
          variant="primary"
          size="sm"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              Generating…
            </span>
          ) : (
            "Generate plan"
          )}
        </Button>
        <Button
          onClick={handleStart}
          disabled={loading}
          variant="success"
          size="sm"
        >
          Start plan
        </Button>
        <Button
          onClick={handleUpdate}
          disabled={loading}
          variant="secondary"
          size="sm"
        >
          Update plan
        </Button>
        <Button
          onClick={handleClearCache}
          disabled={loading}
          variant="danger"
          size="sm"
        >
          Clear cache
        </Button>

        {COACH_DEBUG && diag && (
          <div className="ml-auto flex flex-wrap gap-2 text-xs">
            <Pill
              label={`source: ${diag.source ?? "—"}`}
              color={THEME.chart.neutral}
            />
            <Pill
              label={`model: ${diag.model ?? "—"}`}
              color={THEME.chart.neutral}
            />
          </div>
        )}
      </div>

      {/* stavový panel (len v debug móde) */}
      <StepsStrip />

      {/* error */}
      {err && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 text-red-100 p-3">
          <div className="font-semibold mb-0.5">Error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}

      {/* výsledok */}
      {analysis && (
        <div className="mt-2">
          <PlanResult
            result={{ analysis, narrative: null, model: diag?.model }}
          />
        </div>
      )}

      {/* debug bloky – len v COACH_DEBUG */}
      <div className="space-y-2">
        <JsonBlock
          title="Prefs (effective: DB → storage fallback)"
          data={prefs}
        />
        <JsonBlock title="Sent payload (FE→BE, base)" data={debugPayload} />
        <JsonBlock title="Generated (analysis)" data={analysis} />
        <JsonBlock title="AI debug — attempts" data={aiAttempts} />
        <JsonBlock title="AI debug — system prompt" data={aiSystem} />
        <JsonBlock title="AI debug — user prompt" data={aiUser} />
        <JsonBlock title="AI debug — last_raw (model output)" data={aiLastRaw} />
      </div>
    </div>
  );
}