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
  console.log(`[AUTH_DEBUG: callBackend] Štartujem request na: ${path}`);
  
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  let token = data?.session?.access_token ?? null;

  if (token) {
    console.log(`[AUTH_DEBUG: callBackend] Mám token pre ${path} (končí na ...${token.slice(-5)})`);
  } else {
    console.warn(`[AUTH_DEBUG: callBackend] POZOR! Nemám token pre request na ${path}`);
  }

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  // Zachytenie vypršaného tokenu (401)
  if (res.status === 401 && !_retry) {
    console.warn(`[AUTH_DEBUG: callBackend] 🔴 Dostal som 401 Unauthorized z ${path}. Skúšam obnoviť token...`);
    
    if (!refreshPromise) {
      console.log(`[AUTH_DEBUG: callBackend] Volám supabase.auth.refreshSession()...`);
      refreshPromise = supabase.auth
        .refreshSession()
        .then(({ data, error }) => {
          if (error) console.error(`[AUTH_DEBUG: callBackend] Chyba pri refreshi:`, error.message);
          if (data?.session) console.log(`[AUTH_DEBUG: callBackend] ✅ Token úspešne obnovený!`);
          return data?.session?.access_token ?? null;
        })
        .finally(() => { refreshPromise = null; });
    }

    const newToken = await refreshPromise;
    
    if (newToken) {
      console.log(`[AUTH_DEBUG: callBackend] Opakujem request na ${path} s novým tokenom.`);
      headers.set("Authorization", `Bearer ${newToken}`);
      const retryRes = await fetch(`${API_URL}${path}`, { ...init, headers });
      
      if (!retryRes.ok) {
        console.error(`[AUTH_DEBUG: callBackend] ❌ Retry request zlyhal so statusom ${retryRes.status}`);
        throw new Error(`HTTP ${retryRes.status}`);
      }
      
      const retryText = await retryRes.text();
      return retryText ? JSON.parse(retryText) : ({} as T);
    } else {
      console.error(`[AUTH_DEBUG: callBackend] ❌ Nepodarilo sa získať nový token, retry sa nekoná.`);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[AUTH_DEBUG: callBackend] ❌ HTTP Error ${res.status} na ${path}. Detail: ${text}`);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  console.log(`[AUTH_DEBUG: callBackend] ✅ Request na ${path} úspešný (Status 200)`);
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}