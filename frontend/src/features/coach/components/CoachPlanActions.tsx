// src/features/coach/components/CoachPlanActions.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { todayISO } from "@/features/activity/utils/activity";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import PlanPreview from "@/features/coach/components/PlanPreview";
import PlanActive from "@/features/coach/components/PlanActive";

import {
  apiSaveActivePlan,
  apiUpdateActivePlan,
  apiCancelActivePlan,
  apiExtendActivePlan,
  type ExtendPlanResult,
} from "@/features/coach/api/plan";
import { apiGetPrefs } from "@/features/coach/api/prefs";
import {
  apiAnalyzeCoach,
  apiToAnalyzePayloadBE,
} from "@/features/coach/api/coach";

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

// ──────────────────────────── konštanty ────────────────────────────

const API_URL: string = RAW_API_URL ?? "";
const COACH_DEBUG = false;

// ──────────────────────────── typy pre steps ───────────────────────

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

const STEP_NAMES: readonly StepName[] = [
  "Loading preferences",
  "Preparing inputs for AI",
  "Checking cache",
  "Sending request",
  "Generating plan (AI)",
  "Parsing response",
  "Saving to storage",
];

const now = () => new Date().toLocaleTimeString();

const makeSteps = (st: StepState["state"] = "idle"): StepState[] =>
  STEP_NAMES.map((name) => ({ name, state: st }));

// ──────────────────────────── helpers ──────────────────────────────

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

type ActiveMeta = {
  plan_id?: string | null;
  goal?: string | null;
  weeks?: number | null;
  start_iso?: string | null;
  end_iso?: string | null;
};

// z planRows poskladáme next_10_days, ak nemáme analysis v localStorage
function buildNext10FromPlanRows(
  rows: Array<{
    plan_date: string;
    plan_id?: string | null;
    payload?: any;
    sport: string;
    title?: string | null;
    duration_min?: number | null;
    intensity?: string | null;
    session_type?: string | null;
    notes?: string | null;
  }>,
  today: string
) {
  if (!rows.length) return [];

  const future = rows.filter((r) => r.plan_date >= today);
  if (!future.length) return [];

  const uniqueDates = Array.from(
    new Set(future.map((r) => r.plan_date))
  ).sort();

  const dates = uniqueDates.slice(0, 10);

  return dates.map((day) => {
    const dayRows = future.filter((r) => r.plan_date === day);
    const sessions = dayRows.map((r) => {
      if (r.payload && typeof r.payload === "object") {
        return r.payload;
      }
      return {
        sport: r.sport,
        title: r.title ?? null,
        duration_min: r.duration_min ?? null,
        intensity: r.intensity ?? null,
        session_type: r.session_type ?? null,
        notes: r.notes ?? null,
      };
    });
    return { day, sessions };
  });
}

// ──────────────────────────── hlavný komponent ─────────────────────

export default function CoachPlanActions() {
  const { userId } = useUserId();
  const { pbRun } = useCoachData();
  const { planRows, refresh: refreshPlan } = usePlanData();

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

  const [aiAttempts, setAiAttempts] = useState<any>(null);
  const [aiSystem, setAiSystem] = useState<any>(null);
  const [aiUser, setAiUser] = useState<any>(null);
  const [aiLastRaw, setAiLastRaw] = useState<any>(null);

  const [activeMeta, setActiveMeta] = useState<ActiveMeta | null>(null);

  const [extending, setExtending] = useState(false);
  const [extendInfo, setExtendInfo] = useState<ExtendPlanResult | null>(null);

  const cacheKey = useMemo(
    () => (userId && prefs ? makeCacheKey(String(userId), prefs) : undefined),
    [userId, prefs]
  );

  const today = useMemo(() => todayISO(), []);
  const activeRows = useMemo(
    () => planRows.filter((r) => r.plan_id && r.plan_date >= today),
    [planRows, today]
  );

  const hasGenerated =
    !!analysis &&
    Array.isArray(analysis.next_10_days) &&
    analysis.next_10_days.length > 0;

  const hasActivePlan = activeRows.length > 0;

  const showPreview = !!analysis && !hasActivePlan;
  const showActiveBoard = hasActivePlan;

  const canRunGenerate = !!userId && !loading && !hasActivePlan;
  const canStart = !!userId && !loading && hasGenerated && !hasActivePlan;
  const canUpdate = !!userId && !loading && hasActivePlan;
  const canCancel = !!userId && !loading && hasActivePlan;
  const canExtend = !!userId && !loading && !extending && hasActivePlan;

  // helpers pre steps (Debug only)
  const resetSteps = useCallback(() => setSteps(makeSteps("idle")), []);

  const markOnly = useCallback((active: StepName | null, note?: string) => {
    if (!COACH_DEBUG) return;
    setSteps((prev) =>
      prev.map((s) => {
        if (active === null) {
          return s.state === "active"
            ? { ...s, state: "done", note: s.note }
            : s;
        }
        if (s.name === active) {
          return {
            ...s,
            state: "active",
            note: [s.note, `[${now()}] ${note ?? ""}`]
              .filter(Boolean)
              .join(" · "),
          };
        }
        if (s.state === "active") {
          return { ...s, state: "done", note: s.note };
        }
        return s;
      })
    );
  }, []);

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
          : s
      )
    );
  }, []);

  // Prefs z DB / storage
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        markOnly("Loading preferences", "initial");
        const p = await apiGetPrefs(userId).catch(() => null);
        const eff = p ?? readPrefsFromStorage();
        setPrefs(eff);
        markOnly(null);
      } catch {
        setPrefs(readPrefsFromStorage());
        markOnly(null);
      }
    })();
  }, [userId, markOnly]);

  // Generated plan z localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawGen = localStorage.getItem("coach.generated");
      if (rawGen) {
        const obj = JSON.parse(rawGen);
        setAnalysis(obj);
      } else {
        setAnalysis(null);
      }
    } catch {
      setAnalysis(null);
    }
  }, []);

  // Ak nemáme generated analysis, ale máme aktívny plán v DB → postav fallback next_10_days
  useEffect(() => {
    if (analysis || !activeRows.length) return;
    const next10 = buildNext10FromPlanRows(activeRows, today);
    if (!next10.length) return;
    setAnalysis((prev: any) => prev ?? { next_10_days: next10 });
  }, [analysis, activeRows, today]);

  // Aktívny plán – meta z planRows + prefs
  useEffect(() => {
    if (!activeRows.length) {
      setActiveMeta(null);
      return;
    }
    const dates = activeRows.map((r) => r.plan_date).sort();
    const start_iso = dates[0];
    const end_iso = dates[dates.length - 1];

    const meta: ActiveMeta = {
      plan_id: (activeRows[0] as any).plan_id ?? null,
      goal: (prefs as any)?.goal_kind ?? (prefs as any)?.goal ?? null,
      weeks: (prefs as any)?.weeks ?? (prefs as any)?.plan_weeks ?? null,
      start_iso,
      end_iso,
    };
    setActiveMeta(meta);
  }, [activeRows, prefs]);

  // Generate plan (AI)
  const handleGenerate = useCallback(async () => {
    if (!userId) return;

    setErr(null);
    setAiAttempts(null);
    setAiSystem(null);
    setAiUser(null);
    setAiLastRaw(null);
    resetSteps();
    setLoading(true);

    try {
      markOnly("Loading preferences", "fetch from DB");
      const fresh = await apiGetPrefs(userId).catch(() => null);
      const effectivePrefs = fresh ?? readPrefsFromStorage();
      if (!effectivePrefs) {
        markError("Loading preferences", "none in DB nor storage");
        throw new Error("Preferences not found in DB or storage.");
      }
      setPrefs(effectivePrefs);
      markOnly(null);

      markOnly("Preparing inputs for AI", "build payload");
      const base = apiToAnalyzePayloadBE(effectivePrefs);
      const payload = { ...base, bests: { run: pbRun ?? [] } };
      setDebugPayload(base);

      markOnly("Checking cache");
      const ck = makeCacheKey(String(userId), effectivePrefs);
      const cached = loadCachedResult(ck);
      if (cached?.result) {
        markOnly("Saving to storage", "from cache");
        setAnalysis(cached.result.analysis);
        setDiag({ source: "cache", model: cached.result.model });
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "coach.generated",
            JSON.stringify(cached.result.analysis)
          );
        }
        markOnly(null);
        setLoading(false);
        return;
      }

      markOnly("Sending request", "debug_raw=1, loose=1");
      markOnly("Generating plan (AI)");
      const json = await apiAnalyzeCoach(userId, payload, {
        debugRaw: true,
        loose: true,
      });

      if (!json?.success) {
        const detail = json?.detail || "Analyze failed";
        markError("Generating plan (AI)", detail);
        throw new Error(detail);
      }

      setAiAttempts(json?.ai_debug?.attempts ?? null);
      setAiSystem(json?.ai_debug?.system_prompt ?? null);
      setAiUser(json?.ai_debug?.user_prompt ?? null);
      setAiLastRaw(json?.ai_debug?.last_raw ?? null);

      markOnly("Parsing response", "ok");
      setAnalysis(json.analysis);
      setDiag({ source: "ai", model: json.model });
      saveCachedResult(ck, json, json?.model);

      markOnly("Saving to storage");
      if (typeof window !== "undefined") {
        localStorage.setItem("coach.generated", JSON.stringify(json.analysis));
      }
      markOnly(null);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/Failed to fetch/i.test(msg)) {
        setErr(`Failed to fetch (network/CORS/timeout). API_URL=${API_URL}`);
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, pbRun, resetSteps, markOnly, markError]);

  // Start plan
  const handleStart = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      if (!analysis?.next_10_days) {
        throw new Error("Najprv vygeneruj plán (Generate).");
      }

      const meta = {
        started_at_iso: new Date().toISOString(),
        plan_start_date:
          (prefs as any)?.plan_start_date ?? (prefs as any)?.start_date ?? null,
        weeks: (prefs as any)?.weeks ?? null,
        goal_kind: (prefs as any)?.goal_kind ?? null,
      };

      const res = await apiSaveActivePlan(userId, analysis, meta);
      if (!res?.success) throw new Error("Uloženie plánu zlyhalo.");

      const newMeta: ActiveMeta = {
        plan_id: res.planId ?? null,
        goal: meta.goal_kind,
        weeks: meta.weeks,
      };
      setActiveMeta(newMeta);

      // po starte si refetchni plán (PlanDataProvider)
      await refreshPlan(true);
    } catch (e: any) {
      setErr(e?.message || "Start failed");
    }
  }, [userId, analysis, prefs, refreshPlan]);

  // Update plan (BE reconcile)
  const handleUpdate = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      const updated = await apiUpdateActivePlan(userId);
      if (updated && typeof window !== "undefined") {
        localStorage.setItem("coach.active", JSON.stringify(updated));
      }
      await refreshPlan(true);
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }, [userId, refreshPlan]);

  // Extend plan (AI doplnenie horizon)
  const handleExtend = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      setErr(null);
      setExtending(true);

      const res = await apiExtendActivePlan(userId, 10);
      console.log("[CoachPlanActions] extend result", res);

      if (!res.success) {
        throw new Error(res.note || "Extend failed");
      }

      setExtendInfo(res);
      await refreshPlan(true);
    } catch (e: any) {
      setErr(e?.message || "Extend failed");
    } finally {
      setExtending(false);
    }
  }, [userId, refreshPlan]);

  // Cancel plan
  const handleCancel = useCallback(async () => {
    try {
      if (!userId) throw new Error("Chýba userId.");
      const res = await apiCancelActivePlan(
        userId,
        activeMeta?.plan_id ?? null
      );
      if (!res?.success) throw new Error("Zrušenie plánu zlyhalo.");

      setActiveMeta(null);
      setAnalysis(null);
      setDiag(null);
      setExtendInfo(null);

      if (typeof window !== "undefined") {
        localStorage.removeItem("coach.active");
        localStorage.removeItem("coach.generated");
      }

      await refreshPlan(true);
    } catch (e: any) {
      setErr(e?.message || "Cancel failed");
    }
  }, [userId, activeMeta, refreshPlan]);

  // Clear cache (debug)
  const handleClearCache = useCallback(() => {
    if (cacheKey) clearCachedByKey(cacheKey);
  }, [cacheKey]);

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
                {s.state === "active" && <LoadingSpinner size="widget" />}
                {s.name}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const activeSummary = useMemo(() => {
    if (!hasActivePlan || !activeMeta) return null;
    const goal =
      activeMeta.goal ??
      (prefs as any)?.goal_kind ??
      (prefs as any)?.goal ??
      "—";
    const weeks =
      activeMeta.weeks ??
      (prefs as any)?.weeks ??
      (prefs as any)?.plan_weeks ??
      "—";
    const start = activeMeta.start_iso ?? "—";
    const end = activeMeta.end_iso ?? "—";

    return { goal, weeks, start, end };
  }, [hasActivePlan, activeMeta, prefs]);

  return (
    <div className="space-y-4">
      {/* prefs + active plan info */}
      <div className="rounded-xl border border-white/10 p-3 bg-white/5">
        <PrefsMini prefs={prefs} />
        {activeSummary && (
          <div className="mt-2 text-xs text-emerald-300">
            Active plan:{" "}
            <span className="font-semibold">{activeSummary.goal}</span>,{" "}
            <span className="font-semibold">{activeSummary.weeks}</span> weeks{" "}
            <span className="opacity-80">
              ({activeSummary.start} → {activeSummary.end})
            </span>
          </div>
        )}

        {extendInfo && (
          <div className="mt-1 text-[11px] text-cyan-200">
            Extended:{" "}
            <span className="font-semibold">
              +{extendInfo.extended_days ?? 0} days
            </span>{" "}
            · horizon:{" "}
            <span className="font-semibold">
              {extendInfo.horizon_days ?? "?"} d
            </span>{" "}
            {extendInfo.plan_start && extendInfo.plan_end && (
              <span className="opacity-80">
                ({extendInfo.plan_start} → {extendInfo.plan_end})
              </span>
            )}
          </div>
        )}
      </div>

      {/* tlačidlá */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleGenerate}
          disabled={!canRunGenerate}
          variant="primary"
          size="sm"
        >
          {loading && !hasGenerated ? (
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
          disabled={!canStart}
          variant="primary"
          size="sm"
        >
          Start plan
        </Button>

        <Button
          onClick={handleUpdate}
          disabled={!canUpdate}
          variant="primary"
          size="sm"
        >
          Update plan
        </Button>

        <Button
          onClick={handleExtend}
          disabled={!canExtend}
          variant="secondary"
          size="sm"
        >
          {extending ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="button" />
              Extending…
            </span>
          ) : (
            "Extend plan (10d)"
          )}
        </Button>

        <Button
          onClick={handleCancel}
          disabled={!canCancel}
          variant="danger"
          size="sm"
        >
          Cancel plan
        </Button>

        {COACH_DEBUG && (
          <Button
            onClick={handleClearCache}
            disabled={loading}
            variant="danger"
            size="sm"
          >
            Clear cache
          </Button>
        )}

        {diag && (
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

      <StepsStrip />

      {err && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 text-red-100 p-3">
          <div className="font-semibold mb-0.5">Error</div>
          <p className="text-sm opacity-90">{err}</p>
        </div>
      )}

      {/* PREVIEW – iba ak ešte nemáme aktívny plán */}
      {showPreview && (
        <div className="mt-2">
          <PlanPreview
            result={{ analysis, narrative: null, model: diag?.model }}
          />
        </div>
      )}

      {/* ACTIVE BOARD – len ak existuje aktívny plán v DB */}
      {showActiveBoard && (
        <div className="mt-6">
          <PlanActive />
        </div>
      )}

      {/* debug JSON bloky */}
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
        <JsonBlock
          title="AI debug — last_raw (model output)"
          data={aiLastRaw}
        />
      </div>
    </div>
  );
}