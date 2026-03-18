// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import type { AuthResponse } from "@supabase/supabase-js";

let refreshPromise: Promise<string | null> | null = null;

export async function callBackend<T = any>(
  path: string,
  init: RequestInit = {},
  _retry = false
): Promise<T> {

  const supabase = getSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  let token = session?.access_token ?? null;

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !_retry) {
    if (!refreshPromise) {
      refreshPromise = supabase.auth.refreshSession().then((response: AuthResponse) => {
        const newToken = response.data?.session?.access_token ?? null;
        return newToken;
      }).finally(() => { refreshPromise = null; });
    }

    const newToken = await refreshPromise;
    
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      const retryRes = await fetch(`${API_URL}${path}`, { ...init, headers });
      
      if (!retryRes.ok) {
        const errText = await retryRes.text();
        console.error(`[AUTH: callBackend] ❌ Retry failed with status ${retryRes.status}: ${errText}`);
        throw new Error(`HTTP ${retryRes.status}: ${errText}`);
      }
      
      const retryText = await retryRes.text();
      return retryText ? (JSON.parse(retryText) as T) : ({} as T);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[AUTH: callBackend] ❌ HTTP Error ${res.status} on ${path}. Detail: ${text}`);
    throw new Error(`HTTP ${res.status}: ${text}`);
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
  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;
  let runJson: any;
  let needsPolling = false;

  try {
    runJson = await callBackend(runPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.warn(`[JobRunner] HTTP Timeout na /jobs/run. Spúšťam Polling pre job ${jobId}...`);
    needsPolling = true;
  }

  // Ak to padlo na sieti, alebo server priamo vrátil že ešte pracuje (nepodarilo sa to na prvýkrát synchrónne)
  if (needsPolling || !runJson?.success) {
    for (let i = 0; i < maxPollAttempts; i++) {
      await new Promise((res) => setTimeout(res, pollIntervalMs));
      
      try {
        const statusPath = `/jobs/status/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;
        const pollRes = await callBackend(statusPath, {
          method: "GET",
          headers: { "content-type": "application/json" },
          cache: "no-store",
        });
        
        const jobStatus = pollRes?.job?.status || pollRes?.data?.status;
        
        // Ak už nie je 'running' ani 'queued', vrátime výsledok
        if (jobStatus && jobStatus !== "running" && jobStatus !== "queued") {
          runJson = pollRes;
          needsPolling = false;
          break; // Vyskakujeme z loopu
        }
      } catch (pollErr) {
        console.warn(`[JobRunner] Chyba pri pollingu:`, pollErr);
      }
    }
    
    // Ak to prejde celý loop a stále nič (stále je to needsPolling)
    if (needsPolling) {
      return { 
        success: false, 
        error_code: "REQUEST_TIMEOUT", 
        message: "Úloha trvá príliš dlho, prosím obnovte stránku neskôr a skontrolujte históriu." 
      };
    }
  }

  // Extrakcia a zjednotenie výsledkov z úspešne dobehnutého Jobu
  const innerResult = runJson?.job?.result || runJson?.data?.result || runJson?.result;
  
  if (innerResult && innerResult.ok === false) {
    return {
      success: false,
      error_code: innerResult.code || "ai_generation_failed",
      message: innerResult.message
    };
  }

  const jobStatus = runJson?.job?.status || runJson?.data?.status || runJson?.status;
  if (jobStatus === "failed" || jobStatus === "error") {
    return {
      success: false,
      error_code: "ai_generation_failed",
      message: "Úloha na pozadí zlyhala."
    };
  }

  return { 
    success: true, 
    status: "SUCCESS", 
    data: innerResult 
  };
}