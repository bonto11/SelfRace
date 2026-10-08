"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import {
  getTrainerView,
  isAllowedDuringTrainerView,
  trainerViewReadOnlyText,
} from "@/app/shared/state/trainerViewStore";
import { toast } from "@/app/shared/ui/components/Toast";

/*
 * Signál "na BE sa niečo zmenilo". Krátke FE cache (prefs, stav predplatného)
 * sa po každom zapisujúcom requeste zahodia - BE vie pri POST/PUT meniť aj
 * dáta mimo samotného endpointu (napr. štart plánu upraví coach.prefs).
 */
const mutationListeners = new Set<() => void>();

export function onBackendMutation(listener: () => void): () => void {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
}

function notifyBackendMutation() {
  mutationListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export async function callBackend<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  
  const supabase = getSupabaseBrowser();
  
  // getSession() sa automaticky postará o to, aby bol token čerstvý (ak treba, na pozadí ho sám obnoví)
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = String(init.method || "GET").toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD";

  // Živý tréner: počas prezerania zverenca žiadne zápisy nad jeho účtom
  // (AI, ukladanie, mazanie). RLS by väčšinu aj tak odmietla, ale niektoré
  // akcie idú cez service role alebo míňajú AI ešte pred zápisom.
  if (isWrite && getTrainerView(session?.user?.id) && !isAllowedDuringTrainerView(method, path)) {
    toast.error(trainerViewReadOnlyText());
    throw new Error("trainer_view_readonly");
  }

  let res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (isWrite) notifyBackendMutation();

  if (!res.ok) {
    const text = await res.text();
    console.error(`[API Error] HTTP ${res.status} na ${path}: ${text}`);
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const TERMINAL_STATUSES = ["succeeded", "failed", "error"];

function extractJobStatus(json: any): string | undefined {
  return json?.job?.status || json?.data?.status || json?.status;
}

export async function runAsyncJobWithPolling(
  userId: number | string,
  jobId: number | string,
  maxPollAttempts = 24,
  pollIntervalMs = 5000
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string; data?: any }> {
  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;
  let runJson: any;

  try {
    runJson = await callBackend(runPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.warn(`[JobRunner] HTTP chyba na /jobs/run pre job ${jobId}, prechádzam na polling.`, err);
    runJson = null;
  }

  // 🛡️ KĽÚČOVÁ OPRAVA: /jobs/run teraz VŽDY vracia response okamžite
  // (job beží na pozadí cez BackgroundTasks) - HTTP success:true
  // NEZNAMENÁ, že job doletel do cieľa. Musíme sa pozrieť na skutočný
  // status jobu samotného a pollovať, kým nedôjde do terminálneho stavu
  // (predtým sa polling preskočil vždy, keď /run vrátilo success:true,
  // čo bolo prakticky vždy - preto sa výsledok hlásil ako hotový hneď
  // v prvej sekunde, aj keď job ešte len začal bežať).
  let jobStatus = runJson ? extractJobStatus(runJson) : undefined;
  let needsPolling = !runJson?.success || !jobStatus || !TERMINAL_STATUSES.includes(jobStatus);

  if (needsPolling) {
    let reachedTerminal = false;

    for (let i = 0; i < maxPollAttempts; i++) {
      await new Promise((res) => setTimeout(res, pollIntervalMs));

      try {
        const statusPath = `/jobs/status/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;
        const pollRes = await callBackend(statusPath, {
          method: "GET",
          headers: { "content-type": "application/json" },
          cache: "no-store",
        });

        const polledStatus = extractJobStatus(pollRes);

        if (polledStatus && TERMINAL_STATUSES.includes(polledStatus)) {
          runJson = pollRes;
          reachedTerminal = true;
          break;
        }
      } catch (pollErr) {
        console.warn(`[JobRunner] Chyba pri pollingu:`, pollErr);
      }
    }

    if (!reachedTerminal) {
      return {
        success: false,
        error_code: "REQUEST_TIMEOUT",
        message: "Úloha trvá príliš dlho, prosím obnovte stránku neskôr a skontrolujte históriu."
      };
    }
  }

  const innerResult = runJson?.job?.result || runJson?.data?.result || runJson?.result;

  if (innerResult && innerResult.ok === false) {
    return {
      success: false,
      error_code: innerResult.code || "ai_generation_failed",
      message: innerResult.message
    };
  }

  const finalStatus = extractJobStatus(runJson);
  if (finalStatus === "failed" || finalStatus === "error") {
    return {
      success: false,
      error_code: "ai_generation_failed",
      message: runJson?.job?.error || runJson?.error || "Úloha na pozadí zlyhala."
    };
  }

  return {
    success: true,
    status: "SUCCESS",
    data: innerResult
  };
}
