// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

// Globálny zámok na ochranu pred paralelným obnovovaním tokenu
let refreshPromise: Promise<string | null> | null = null;

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
  _isRetry = false,
): Promise<T> {
  const supabase = getSupabaseBrowser();
  let token: string | null = null;

  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token ?? null;

    // Fallback po OAuth redirecte
    if (!token) {
      const r = await fetch("/api/auth/session-token", {
        cache: "no-store",
        credentials: "include",
      });

      if (r.ok) {
        const j = await r.json();
        token = j?.access_token ?? null;
      }
    }
  } catch (e) {
    console.warn("[callBackend] session resolve failed");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fullUrl = `${API_URL}${path}`;

  let res = await fetch(fullUrl, {
    ...init,
    headers,
    credentials: "include",
  });

  // Ak backend vráti 401 (token vypršal) a ešte sme neskúsili retry...
  if (res.status === 401 && !_isRetry) {
    console.warn(`[callBackend] 401 z backendu na ${path}, vynucujem obnovu...`);

    // ZÁMOK: Prepísaný na async/await, aby nevznikal ts(7031) error
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) return null;
          return data?.session?.access_token ?? null;
        } catch (err) {
          return null;
        }
      })();

      // Po dokončení (či už úspech alebo fail) uvoľníme zámok
      refreshPromise.finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(fullUrl, {
        ...init,
        headers,
        credentials: "include",
      });
    }
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // fallback
  }

  if (!res.ok) {
    console.error("[callBackend] HTTP error", {
      path,
      status: res.status,
      body: json ?? text,
    });
    throw new Error(`HTTP ${res.status}`);
  }

  return (json ?? {}) as T;
}