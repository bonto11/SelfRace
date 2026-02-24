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

  const token = session?.access_token;

  if (!token) {
    throw new Error("User not authenticated");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  // 401 → pokus o refresh
  if (res.status === 401 && !_retry) {

    if (!refreshPromise) {
      refreshPromise = supabase.auth
        .refreshSession()
        .then((response: AuthResponse) => {
          return response.data?.session?.access_token ?? null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newToken = await refreshPromise;

    if (!newToken) {
      throw new Error("Session expired");
    }

    return callBackend<T>(path, init, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) as T : ({} as T);
}