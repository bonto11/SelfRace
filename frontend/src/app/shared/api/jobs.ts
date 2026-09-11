// src/app/shared/api/jobs.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface JobRecord {
  id: number;
  job_type: string;
  status: JobStatus;
  progress?: number;
  result?: any;
  error?: string | null;
  [key: string]: any;
}

const TERMINAL_STATUSES: JobStatus[] = ["succeeded", "failed"];

export async function apiGetJobStatus(
  userId: number,
  jobId: number,
): Promise<JobRecord | null> {
  const path = `/jobs/status/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;
  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    if (!json?.success) return null;
    return json.job as JobRecord;
  } catch (e) {
    console.error("[jobs] status fetch failed", e);
    return null;
  }
}

/**
 * Spustí job (POST /jobs/run) a POLLUJE /jobs/status, kým nedôjde do
 * terminálneho stavu (succeeded/failed) alebo kým nevyprší timeout.
 *
 * DÔLEŽITÉ: /jobs/run vracia response OKAMŽITE (job beží v
 * BackgroundTasks na serveri) — presne toto polling je jediný
 * spoľahlivý spôsob, ako zistiť skutočný výsledok. Predtým viaceré FE
 * volania (activity review, athlete state, weekly/daily generate...)
 * omylom brali okamžitú odpoveď z /run ako finálny výsledok, čo pri
 * čo i len o pár sekúnd dlhšie bežiacich joboch viedlo k falošnému
 * "hotovo" hneď v prvej sekunde.
 */
export async function runJobAndWait(
  userId: number,
  jobId: number,
  opts: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (job: JobRecord) => void;
  } = {},
): Promise<JobRecord | null> {
  const intervalMs = opts.intervalMs ?? 1500;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;
  try {
    await callBackend<any>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[jobs] run trigger failed", e);
    // pokračujeme na polling aj tak - job mohol byť spustený inak
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await apiGetJobStatus(userId, jobId);
    if (job) {
      opts.onProgress?.(job);
      if (TERMINAL_STATUSES.includes(job.status)) {
        return job;
      }
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }

  return null; // timeout - job stále beží, volajúci má zobraziť "stále prebieha"
}
