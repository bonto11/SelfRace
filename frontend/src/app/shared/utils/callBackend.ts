// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

// Mechanizmus fronty (Queue) pre obnovu tokenu
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onTokenRefreshed(token: string | null) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
  _retryCount = 0
): Promise<T> {
  const supabase = getSupabaseBrowser();
  let token: string | null = null;

  try {
    // getSession v prehliadači si bezpečne vytiahne token z cookies
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token ?? null;
  } catch (e) {
    console.warn("[callBackend] getSession failed");
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
  });

  // AK BACKEND VRÁTI 401: Token vypršal a my sme ešte neskúšali retry
  if (res.status === 401 && _retryCount === 0) {
    console.warn(`[callBackend] 401 na ${path}. Zastavujem a bezpečne obnovujem token...`);

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        // O obnovu požiadame Supabase iba JEDENKÁT
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        onTokenRefreshed(data?.session?.access_token ?? null);
      } catch (err) {
        console.error("[callBackend] Fatálne zlyhanie obnovy tokenu", err);
        onTokenRefreshed(null); // Ak to padne, aspoň odblokujeme čakajúce funkcie
      } finally {
        isRefreshing = false;
      }
    }

    // Tu všetky requesty, ktoré narazili na 401 (aj ten prvý), počkajú na nový token
    const newToken = await new Promise<string | null>((resolve) => {
      refreshSubscribers.push(resolve);
    });

    // Keď získame nový token, zopakujeme request
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(fullUrl, {
        ...init,
        headers,
      });
    } else {
      console.warn(`[callBackend] Retry pre ${path} zrušený, nemáme platný token.`);
    }
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // fallback pre text
  }

  if (!res.ok) {
    console.error(`[callBackend] HTTP ${res.status} na ${path}`);
    throw new Error(`HTTP ${res.status}`);
  }

  return (json ?? {}) as T;
}