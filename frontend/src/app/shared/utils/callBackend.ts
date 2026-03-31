"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

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

  let res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[API Error] HTTP ${res.status} na ${path}: ${text}`);
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
        
        if (jobStatus && jobStatus !== "running" && jobStatus !== "queued") {
          runJson = pollRes;
          needsPolling = false;
          break; 
        }
      } catch (pollErr) {
        console.warn(`[JobRunner] Chyba pri pollingu:`, pollErr);
      }
    }
    
    if (needsPolling) {
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