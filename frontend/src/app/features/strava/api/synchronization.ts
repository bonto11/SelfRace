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

export async function apiSyncActivities(
  userId: number,
  opts: SyncActivitiesOptions = {}
): Promise<SyncActivitiesStats> {
  if (!userId) throw new Error("Missing userId for apiSyncActivities");

  // 1) ENQUEUE
  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "sync",
    payload: {
      trigger: "manual",
      // voliteľné: nechaj, ak chceš override – inak worker ignoruje / alebo použije ako fallback
      force_last_days:
        typeof opts.forceLastDays === "number" ? opts.forceLastDays : null,
      fetch_details: opts.fetchDetails ?? true,
    },
    priority: 90,
    max_attempts: 1,
    // dedupe: nech sa ti nestackujú kliky pri spamovaní
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

  // 2) RUN NOW
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
    console.error("[Activities][apiSyncActivities] run ERROR", e);
    throw e instanceof Error ? e : new Error(String(e));
  }

  if (!runJson?.success || !runJson.job) {
    throw new Error(runJson?.error || "Sync job run failed");
  }

  const result = runJson.job.result;

  if (!result || typeof result !== "object") {
    throw new Error("Sync job finished but result payload is empty/invalid");
  }

  const stats = (result as any).stats;

  if (!stats || typeof stats !== "object") {
    throw new Error("Sync job finished but stats are missing");
  }

  return {
    imported: stats.imported ?? 0,
    updated: stats.updated ?? 0,
    skipped: stats.skipped ?? 0,
    fetched: stats.fetched ?? 0,
  };
}