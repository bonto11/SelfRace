// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

// --- FRONTEND ZÁMOK (QUEUE MECHANIZMUS) ---
// Tieto dve premenné zabezpečia, že ak 5 widgetov naraz dostane 401, 
// o nový token požiadame Supabase iba JEDENKÁT. Ostatné počkajú.
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onTokenRefreshed(token: string | null) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}
// ------------------------------------------

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
  _retryCount = 0
): Promise<T> {
  const supabase = getSupabaseBrowser();
  let token: string | null = null;

  try {
    // Supabase Browser klient si token vytiahne bezpečne sám priamo z Cookies.
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token ?? null;
  } catch (e) {
    console.warn("[callBackend] nepodarilo sa načítať session");
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

  // AK BACKEND VRÁTI 401 A EŠTE SME NESKÚŠALI RETRY
  if (res.status === 401 && _retryCount === 0) {
    console.warn(`[callBackend] 401 na ${path}. Zastavujem a obnovujem token...`);

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        // Iba JEDEN request spraví túto akciu
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        
        // Máme nový token, odomkneme všetky čakajúce requesty
        onTokenRefreshed(data?.session?.access_token ?? null);
      } catch (err) {
        console.error("[callBackend] Fatálne zlyhanie obnovy tokenu", err);
        onTokenRefreshed(null); // Odblokujeme radu, aby nezamrzla apka
      } finally {
        isRefreshing = false;
      }
    }

    // Každý request, ktorý narazil na 401 (aj ten prvý), sa tu postaví do radu a čaká na nový token
    const newToken = await new Promise<string | null>((resolve) => {
      refreshSubscribers.push(resolve);
    });

    // Keď sa token obnoví, vložíme ho do hlavičky a zopakujeme dotaz
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(fullUrl, {
        ...init,
        headers,
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
    throw new Error(`HTTP ${res.status}`);
  }

  return (json ?? {}) as T;
}