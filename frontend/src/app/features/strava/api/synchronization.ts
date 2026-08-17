// src/features/strava/api/synchronization.ts
import { callBackend } from "@/app/shared/utils/callBackend";

import {
  SyncActivitiesOptions,
  SyncActivitiesStats,
} from "@/app/features/activities/types/synchronization";

type AsyncJobRow = {
  id: number;
  user_id: number;
  job_type: string;
  status: string;
  progress: number;
  error: string | null;
  result: any | null;
  progress_cursor?: {
    total_fetched?: number;
    plan_max_activities?: number;
    plan_days_back?: number;
    days_covered?: number;
    plan_kind?: string;
    phase?: string;
  } | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type EnqueueJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
  note?: string | null;
  detail?: string | null;
  error?: string | null;
};

type RunJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
  error?: string | null;
};

type JobStatusResponse = {
  success: boolean;
  job: AsyncJobRow | null;
};

export type SyncProgress = {
  progress: number; // 0-100
  status: string; // "queued" | "running" | "succeeded" | "failed"
  error?: string | null;
  daysCovered?: number | null;
  planDaysBack?: number | null;
  phase?: string | null;
};

export type SyncActivitiesStatsExt = SyncActivitiesStats & {
  resumed?: boolean;
  plan_kind?: string | null;
};

const POLL_INTERVAL_MS = 1200;
// Poistka proti nekonečnému čakaniu, ak by job zostal trvalo zaseknutý
// (napr. worker proces spadol) - 45 minút by malo pokryť aj veľmi veľké
// importy (tisíce aktivít + enrichment).
const MAX_POLL_MS = 45 * 60 * 1000;

export async function apiSyncActivities(
  userId: number,
  opts: SyncActivitiesOptions = {},
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncActivitiesStatsExt> {
  if (!userId) throw new Error("Missing userId for apiSyncActivities");

  // 1) ENQUEUE
  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "sync",
    payload: {
      trigger: "manual",
      force_last_days:
        typeof opts.forceLastDays === "number" ? opts.forceLastDays : null,
      fetch_details: opts.fetchDetails ?? true,
    },
    priority: 90,
    max_attempts: 1,
    dedupe_key: "sync_manual_latest",
  };

  let enqueueJson: EnqueueJobResponse;
  try {
    enqueueJson = await callBackend<EnqueueJobResponse>(enqueuePath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enqueueBody),
    });
  } catch (e: any) {
    console.error("[Activities][apiSyncActivities] enqueue ERROR", e);
    throw e instanceof Error ? e : new Error(String(e));
  }

  if (!enqueueJson?.success || !enqueueJson.job) {
    const msg =
      enqueueJson.detail ||
      enqueueJson.error ||
      enqueueJson.note ||
      "Failed to enqueue sync job";
    throw new Error(msg);
  }

  const jobId = enqueueJson.job.id;

  function reportFromJob(job: AsyncJobRow) {
    if (!onProgress) return;
    onProgress({
      progress: typeof job.progress === "number" ? job.progress : 0,
      status: job.status,
      error: job.error ?? null,
      daysCovered:
        typeof job.progress_cursor?.days_covered === "number"
          ? job.progress_cursor.days_covered
          : null,
      planDaysBack:
        typeof job.progress_cursor?.plan_days_back === "number"
          ? job.progress_cursor.plan_days_back
          : null,
      phase: job.progress_cursor?.phase ?? null,
    });
  }

  // 2) TRIGGER RUN — server teraz spustí job na pozadí (BackgroundTasks) a
  // vráti sa OKAMŽITE, nečaká na dokončenie. Toto je zámerné: dlho bežiace
  // joby (bulk import stoviek/tisícok aktivít + enrichment) predtým
  // prekračovali proxy timeout, čo prehliadač nahlásil ako zavádzajúcu
  // "CORS blocked" chybu namiesto skutočného network/timeout problému.
  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(
    String(jobId)
  )}`;

  try {
    await callBackend<RunJobResponse>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[Activities][apiSyncActivities] run trigger ERROR", e);
    throw e instanceof Error ? e : new Error(String(e));
  }

  // 3) POLL až do dokončenia — toto je teraz JEDINÝ spôsob, ako zistíme
  // finálny výsledok (progress aj status aj result/error).
  const startedAt = Date.now();
  let finalJob: AsyncJobRow | null = null;

  while (Date.now() - startedAt < MAX_POLL_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let statusJson: JobStatusResponse;
    try {
      statusJson = await callBackend<JobStatusResponse>(
        `/jobs/status/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`,
        { method: "GET", cache: "no-store" },
      );
    } catch (e) {
      // sieťová chyba pri pollingu - skús znova o sekundu, nezhadzuj celý import
      continue;
    }

    const job = statusJson?.job;
    if (!job) continue;

    reportFromJob(job);

    if (job.status === "succeeded" || job.status === "failed") {
      finalJob = job;
      break;
    }
  }

  if (!finalJob) {
    onProgress?.({ progress: 0, status: "failed", error: "timeout" });
    throw new Error("Sync job did not finish in time");
  }

  if (finalJob.status === "failed") {
    const errMsg = finalJob.error || "Sync job run failed";
    throw new Error(errMsg);
  }

  const result = finalJob.result;

  if (!result || typeof result !== "object") {
    onProgress?.({ progress: 0, status: "failed", error: "empty_result" });
    throw new Error("Sync job finished but result payload is empty/invalid");
  }

  const stats = (result as any).stats;

  if (!stats || typeof stats !== "object") {
    onProgress?.({ progress: 0, status: "failed", error: "missing_stats" });
    throw new Error("Sync job finished but stats are missing");
  }

  onProgress?.({
    progress: 100,
    status: "succeeded",
    error: null,
    daysCovered: (result as any).plan?.days_back ?? null,
    planDaysBack: (result as any).plan?.days_back ?? null,
    phase: "done",
  });

  return {
    imported: stats.imported ?? 0,
    updated: stats.updated ?? 0,
    skipped: stats.skipped ?? 0,
    fetched: stats.fetched ?? 0,
    resumed: !!(result as any).resumed,
    plan_kind: (result as any).plan?.kind ?? null,
  };
}

export function formatSyncProgressLabel(p: SyncProgress | null, prefix?: string): string {
  const pre = prefix ? `${prefix} ` : "";
  if (!p) return "Čaká sa na spustenie...";
  if (p.status === "queued") return "Čaká sa na spustenie...";
  if (p.phase === "enriching") return `${pre}${p.progress}% • spracúvam stiahnuté aktivity...`;
  if (p.phase === "finalizing") return `${pre}${p.progress}% • dokončujem...`;
  if (typeof p.daysCovered === "number" && typeof p.planDaysBack === "number" && p.planDaysBack > 0) {
    return `${pre}${p.progress}% • ${p.daysCovered}/${p.planDaysBack} dní`;
  }
  return `${pre}${p.progress}%`;
}