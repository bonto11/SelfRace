"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";

import { getPrefs } from "@/features/coach/api/prefs";
import { analyzeCoach, toAnalyzePayloadBE } from "@/features/coach/api/coach";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

import PlanResult from "@/features/coach/components/PlanResult";

import { saveActivePlan, updateActivePlan } from "@/features/coach/api/plan";
import { makeCacheKey, saveCachedResult, loadCachedResult, clearCachedByKey } from "@/features/coach/utils/cache";

import Button from "@/shared/components/ui/Button";
import Pill from "@/shared/components/ui/Pill";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { THEME } from "@/shared/theme/tokens";
import { API_URL as RAW_API_UTL} from "@/shared/config";
const API_URL : string = RAW_API_UTL?? "";

/* ────────────── UI helpers ────────────── */
function JsonBlock({ title, data }: { title: string; data: any }) {
  if (!data) return null;
  return (
    <details className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2" open>
      <summary className="cursor-pointer select-none text-sm font-semibold py-1">{title}</summary>
      <pre className="mt-2 max-h-72 overflow-auto text-xs leading-5">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

function PrefsMini({ prefs }: { prefs: CoachPrefs | null }) {
  if (!prefs) return <div className="text-sm opacity-75">— preferences nenačítané —</div>;
  const main = (prefs as any).main_sport ?? prefs.primary_sports?.[0] ?? "—";
  const sec = (prefs as any).secondary_mix?.filter((x: any) => Number(x?.share_pct) > 0).map((x: any) => x.sport).join(", ") || "—";
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

/* ────────────── Steps (stavový panel) ────────────── */
type StepName =
  | "Loading preferences"
  | "Preparing inputs for AI"
  | "Checking cache"
  | "Sending request"
  | "Generating plan (AI)"
  | "Parsing response"
  | "Saving to storage";

type StepState = { name: StepName; state: "idle" | "active" | "done" | "error"; note?: string };

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
    const rawUP = localStorage.getItem("up:coach.prefs"); // tvoj pôvodný kľúč
    if (rawUP) return JSON.parse(rawUP);
    const raw = localStorage.getItem("coach.prefs");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ────────────── simple BE ping ────────────── */
async function pingApi(base: string): Promise<{ ok: boolean; status?: number; text?: string; cors?: boolean }> {
  try {
    // použijeme /health, ak ho nemáš, 404 stále znamená že sieť/CORS prešla
    const r = await fetch(`${base}/health`, { method: "GET", cache: "no-store" });
    return { ok: r.ok || r.status === 404, status: r.status, text: r.statusText, cors: false };
  } catch (e: any) {
    // “Failed to fetch” = CORS/offline/DNS/TLS
    return { ok: false, cors: true, text: String(e?.message || e) };
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
  const [diag, setDiag] = useState<{ source: "cache" | "ai" | null; model?: string | null } | null>(null);
  const [debugPayload, setDebugPayload] = useState<any>(null);

  const [apiStatus, setApiStatus] = useState<{ ok: boolean; status?: number; text?: string; cors?: boolean } | null>(null);

  const cacheKey = useMemo(() => (userId && prefs ? makeCacheKey(String(userId), prefs) : undefined), [userId, prefs]);
  const canRun = !!userId && !loading;

  const resetSteps = useCallback(() => setSteps(makeSteps("idle")), []);
  const markOnly = useCallback((active: StepName | null, note?: string) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (active === null) return s.state === "active" ? { ...s, state: "done", note: s.note } : s;
        if (s.name === active) return { ...s, state: "active", note: [s.note, `[${now()}] ${note ?? ""}`].filter(Boolean).join(" · ") };
        if (s.state === "active") return { ...s, state: "done", note: s.note };
        return s;
      })
    );
  }, []);
  const markError = useCallback((at: StepName, note?: string) => {
    setSteps((prev) => prev.map((s) => (s.name === at ? { ...s, state: "error", note: [s.note, `[${now()}] ${note ?? ""}`].filter(Boolean).join(" · ") } : s)));
  }, []);

  /* — Ping API na mount + načítanie prefs (DB → storage) — */
  useEffect(() => {
    (async () => {
      const ping = await pingApi(API_URL);
      setApiStatus(ping);
    })();
  }, []);
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        markOnly("Loading preferences", "initial");
        const p = await getPrefs(userId).catch(() => null);
        setPrefs(p ?? readPrefsFromStorage());
        markOnly(null);
      } catch {
        setPrefs(readPrefsFromStorage());
        markOnly(null);
      }
    })();
  }, [userId, markOnly]);

  /* — Generate plan — */
  const handleGenerate = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    resetSteps();
    setLoading(true);

    try {
      // 0) ping (rýchly feedback)
      const ping = await pingApi(API_URL);
      setApiStatus(ping);
      if (!ping.ok) {
        throw new Error(ping.cors ? `Network/CORS: ${ping.text}` : `API not reachable (${ping.status} ${ping.text})`);
      }

      // 1) prefs (DB → fallback)
      markOnly("Loading preferences", "fetch from DB");
      const fresh = await getPrefs(userId).catch(() => null);
      const effectivePrefs = fresh ?? readPrefsFromStorage();
      if (!effectivePrefs) {
        markError("Loading preferences", "none in DB nor storage");
        throw new Error("Preferences not found in DB or storage.");
      }
      setPrefs(effectivePrefs);
      markOnly(null);

      // 2) inputs
      markOnly("Preparing inputs for AI", "build payload");
      const base = toAnalyzePayloadBE(effectivePrefs);
      const payload = { ...base, goal_structured: effectivePrefs, bests: { run: pbRun ?? [] } };
      setDebugPayload(base);

      // 3) cache
      markOnly("Checking cache");
      const ck = makeCacheKey(String(userId), effectivePrefs);
      const cached = loadCachedResult(ck);
      if (cached?.result) {
        markOnly("Saving to storage", "from cache");
        setAnalysis(cached.result.analysis);
        setDiag({ source: "cache", model: cached.result.model });
        localStorage.setItem("coach.generated", JSON.stringify(cached.result.analysis));
        markOnly(null);
        setLoading(false);
        return;
      }

      // 4) call BE
      // ⬇ tu vieš vynútiť rýchlejší model počas testu (prázdne = server fallbacks)
      const explicitModel = ""; // napr. "gpt-4o-mini"
      markOnly("Sending request", explicitModel ? `model=${explicitModel}` : "model=fallbacks");
      markOnly("Generating plan (AI)");
      const json = await analyzeCoach(userId, { ...payload, explicit_model: explicitModel }).catch((e: any) => {
        // zachyť “Failed to fetch” vs HTTP
        throw e;
      });

      if (!json?.success) {
        const detail = json?.detail || "Analyze failed";
        markError("Generating plan (AI)", detail);
        throw new Error(detail);
      }

      // 5) parse
      markOnly("Parsing response", "ok");
      setAnalysis(json.analysis);
      setDiag({ source: "ai", model: json.model });
      saveCachedResult(ck, json, json?.model);

      // 6) save to storage
      markOnly("Saving to storage");
      localStorage.setItem("coach.generated", JSON.stringify(json.analysis));

      markOnly(null);
    } catch (e: any) {
      // lepšie hlášky pre “Failed to fetch”
      const msg = String(e?.message || e);
      if (/Failed to fetch/i.test(msg)) {
        setErr(`Failed to fetch (network/CORS/timeout). API_URL=${API_URL}`);
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, pbRun, resetSteps, markOnly]);

  /* — Start plan — */
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

  /* — Update plan — */
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

  /* — Clear cache — */
  const handleClearCache = useCallback(() => {
    if (cacheKey) clearCachedByKey(cacheKey);
  }, [cacheKey]);

  /* — Render stavových krokov — */
  const StepsStrip = () => (
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
            <span key={s.name} className={`${base} ${stateCls} inline-flex items-center gap-1`}>
              {s.state === "active" && <LoadingSpinner size="widget" />}
              {s.name}
            </span>
          );
        })}
      </div>
      {/* posledná poznámka z aktívneho kroku alebo erroru */}
      {steps.some((s) => s.note) && (
        <div className="text-xs opacity-80">
          {steps
            .filter((s) => s.note)
            .map((s) => (
              <div key={`${s.name}-note`}>{s.name}: {s.note}</div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* API ping badge */}
      <div className="flex items-center gap-2 text-xs opacity-80">
        <span>API:</span>
        {apiStatus ? (
          apiStatus.ok ? (
            <Pill label={`reachable (${apiStatus.status ?? "OK"})`} color={THEME.chart.good} />
          ) : (
            <Pill label={apiStatus.cors ? "CORS/Network" : `HTTP ${apiStatus.status} ${apiStatus.text ?? ""}`} color={THEME.chart.poor} />
          )
        ) : (
          <Pill label="checking…" color={THEME.chart.neutral} />
        )}
        <span className="ml-2">API_URL: <code className="opacity-90">{API_URL}</code></span>
      </div>

      {/* mini sumár prefs */}
      <div className="rounded-xl border border-white/10 p-3 bg-white/5">
        <PrefsMini prefs={prefs} />
      </div>

      {/* ovládanie */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleGenerate} disabled={!canRun} variant="primary" size="sm">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="widget" />
              Generating…
            </span>
          ) : (
            "Generate plan"
          )}
        </Button>
        <Button onClick={handleStart} disabled={loading} variant="success" size="sm">Start plan</Button>
        <Button onClick={handleUpdate} disabled={loading} variant="secondary" size="sm">Update plan</Button>
        <Button onClick={handleClearCache} disabled={loading} variant="danger" size="sm">Clear cache</Button>

        {diag && (
          <div className="ml-auto flex flex-wrap gap-2 text-xs">
            <Pill label={`source: ${diag.source ?? "—"}`} color={THEME.chart.neutral} />
            <Pill label={`model: ${diag.model ?? "—"}`} color={THEME.chart.neutral} />
          </div>
        )}
      </div>

      {/* stavový panel */}
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
        <div className="rounded-xl border border-white/10 p-3 bg-white/5">
          <PlanResult result={{ analysis, narrative: null, model: diag?.model }} />
        </div>
      )}

      {/* debug */}
      <div className="space-y-2">
        <JsonBlock title="Prefs (effective: DB → storage fallback)" data={prefs} />
        <JsonBlock title="Sent payload (FE→BE, base)" data={debugPayload} />
        <JsonBlock title="Generated (analysis)" data={analysis} />
      </div>
    </div>
  );
}