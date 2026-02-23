// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

async function getAuthToken(): Promise<string | null> {
  const supabase = getSupabaseBrowser();

  try {
    // V SSR architektúre si tento klient vytiahne token sám z Cookies (pretože sme ho tak nastavili)
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.warn("[callBackend] getSession error:", error.message);
      return null;
    }

    return data?.session?.access_token ?? null;
  } catch (e: any) {
    console.warn("[callBackend] getSession threw:", e?.message ?? e);
    return null;
  }
}

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
): Promise<T> {
  const token = await getAuthToken();

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    // Keď nie je token, je lepšie backendu aspoň povedať, že sa to snažíme
    console.warn(`[callBackend] volanie ${path} beží bez tokenu`);
  }

  const fullUrl = `${API_URL}${path}`;

  const res = await fetch(fullUrl, {
    ...init,
    headers,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // necháme json = null
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