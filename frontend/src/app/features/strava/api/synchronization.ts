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
    plan_kind?: string;
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
  fetchedCount?: number | null;
  maxActivities?: number | null;
};

export type SyncActivitiesStatsExt = SyncActivitiesStats & {
  resumed?: boolean;
  plan_kind?: string | null;
};

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
      fetchedCount:
        typeof job.progress_cursor?.total_fetched === "number"
          ? job.progress_cursor.total_fetched
          : null,
      maxActivities:
        typeof job.progress_cursor?.plan_max_activities === "number"
          ? job.progress_cursor.plan_max_activities
          : null,
    });
  }

  // 2) Súbežný polling na progress, kým beží /jobs/run (ten request samotný
  // je na backende blokujúci až do dokončenia jobu, takže progress vidíme
  // len cez samostatné /jobs/status requesty počas jeho behu).
  let polling = true;

  const pollLoop = async () => {
    while (polling) {
      await new Promise((r) => setTimeout(r, 1200));
      if (!polling) break;
      try {
        const statusJson = await callBackend<JobStatusResponse>(
          `/jobs/status/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`,
          { method: "GET", cache: "no-store" },
        );
        const job = statusJson?.job;
        if (job) reportFromJob(job);
      } catch {
        // chyby pri pollingu ignorujeme, skúsime znova o sekundu
      }
    }
  };
  void pollLoop();

  // 3) RUN NOW (blokujúci request, dobehne až keď je job hotový)
  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(
    String(jobId)
  )}`;

  let runJson: RunJobResponse;
  try {
    runJson = await callBackend<RunJobResponse>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    polling = false;
    console.error("[Activities][apiSyncActivities] run ERROR", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
  polling = false;

  if (!runJson?.success || !runJson.job) {
    const errMsg = runJson?.error || runJson?.job?.error || "Sync job run failed";
    if (runJson?.job) reportFromJob(runJson.job);
    throw new Error(errMsg);
  }

  const result = runJson.job.result;

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
    fetchedCount: stats.fetched ?? null,
    maxActivities: (result as any).plan?.max_activities ?? null,
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