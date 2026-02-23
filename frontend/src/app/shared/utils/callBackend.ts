// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

let refreshPromise: Promise<string | null> | null = null;

export async function callBackend<T = any>(
  path: string,
  init: RequestInit = {},
  _retry = false
): Promise<T> {
  const supabase = getSupabaseBrowser();

  const { data } = await supabase.auth.getSession();
  let token = data?.session?.access_token ?? null;

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  // Zámok na obnovu tokenu z ChatGPT, vložený do tvojho kódu
  if (res.status === 401 && !_retry) {
    if (!refreshPromise) {
      refreshPromise = supabase.auth
        .refreshSession()
        .then(({ data }) => data?.session?.access_token ?? null)
        .finally(() => { refreshPromise = null; });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      const retryRes = await fetch(`${API_URL}${path}`, { ...init, headers });
      
      if (!retryRes.ok) {
        throw new Error(`HTTP ${retryRes.status}`);
      }
      const retryText = await retryRes.text();
      return retryText ? JSON.parse(retryText) : ({} as T);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}
