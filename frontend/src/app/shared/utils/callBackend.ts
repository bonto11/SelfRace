// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
  _isRetry = false // Interná vlajka, aby sa to nezacyklilo
): Promise<T> {
  const supabase = getSupabaseBrowser();
  let token: string | null = null;

  try {
    // 1. Priamo si vytiahneme aktuálny token (SSR klient si ho prečíta z cookies)
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

  // 2. Odpálime request na tvoj backend
  let res = await fetch(fullUrl, {
    ...init,
    headers,
  });

  // 3. MAGICKÁ ČASŤ: Backend zahlásil 401 (token expiroval) a ešte sme neskúšali retry
  if (res.status === 401 && !_isRetry) {
    console.warn(`[callBackend] 401 z backendu na ${path}, pokus o obnovu tokenu...`);
    
    // Povieme Supabase, nech nasilu obnoví token
    const { data, error } = await supabase.auth.refreshSession();
    
    if (data?.session?.access_token) {
      console.log(`[callBackend] Token obnovený, opakujem request na ${path}`);
      
      // Nasadíme nový token a skúsime request na backend ešte raz
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
      res = await fetch(fullUrl, {
        ...init,
        headers,
      });
    } else {
      console.error("[callBackend] Nepodarilo sa obnoviť token. Zrejme vypršal aj refresh token.", error);
      // Až v tomto jedinom prípade by ťa malo odhlásiť.
    }
  }

  // 4. Spracovanie odpovede z backendu
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