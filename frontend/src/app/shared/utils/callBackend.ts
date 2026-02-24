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
        throw new Error(`HTTP ${retryRes.status}: ${errText}`);
      }
      
      const retryText = await retryRes.text();
      return retryText ? (JSON.parse(retryText) as T) : ({} as T);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}