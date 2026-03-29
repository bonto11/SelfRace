"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function callBackend<T = any>(
  path: string,
  init: RequestInit = {},
  _retry = false
): Promise<T> {
  let token: string | null = null;

  // 🚀 TOTO NIKDY NEZLYHÁ: Ťaháme token priamo z permanentného LocalStorage
  if (typeof window !== "undefined") {
    try {
      const storedStr = window.localStorage.getItem("selfrace-auth-stable");
      if (storedStr) {
        const parsed = JSON.parse(storedStr);
        token = parsed.access_token || null;
      }
    } catch (e) {
      console.warn("[callBackend] LS read error", e);
    }
  }

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(`${API_URL}${path}`, { ...init, headers });

  // Ak token expiroval (401), prinútime Supabase k obnove a skúsime znova
  if (res.status === 401 && !_retry) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.refreshSession();
    
    if (data?.session?.access_token) {
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
      const retryRes = await fetch(`${API_URL}${path}`, { ...init, headers });
      if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status}`);
      const retryText = await retryRes.text();
      return retryText ? (JSON.parse(retryText) as T) : ({} as T);
    }
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function runAsyncJobWithPolling(
  userId: number | string,
  jobId: number | string,
  maxPollAttempts = 12, 
  pollIntervalMs = 5000
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string; data?: any }> {
  // ... Zvyšok runAsyncJobWithPolling zostáva presne taký, aký si mal (nič v ňom nemeň!)
  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;
  let runJson: any;
  let needsPolling = false;

  try {
    runJson = await callBackend(runPath, { method: "POST" });
  } catch (err) {
    needsPolling = true;
  }

  if (needsPolling || !runJson?.success) {
    for (let i = 0; i < maxPollAttempts; i++) {
      await new Promise((res) => setTimeout(res, pollIntervalMs));
      try {
        const pollRes = await callBackend(`/jobs/status/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`);
        if (pollRes?.job?.status && pollRes.job.status !== "running" && pollRes.job.status !== "queued") {
          runJson = pollRes;
          needsPolling = false;
          break; 
        }
      } catch (e) {}
    }
  }

  return { success: !needsPolling, data: runJson?.job?.result || runJson?.result };
}
