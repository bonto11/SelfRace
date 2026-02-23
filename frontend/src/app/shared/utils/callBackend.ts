// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
  _isRetry = false
): Promise<T> {
  const supabase = getSupabaseBrowser();
  let token: string | null = null;

  try {
    // Toto bezpečne vytiahne token. Ak je expirovaný, Supabase klient ho tu
    // v pozadí (a bezpečne bez race-condition) obnoví predtým, než pôjdeme ďalej.
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

  // Pridané credentials: "include" pre istotu, ak tvoje API číta aj cookies
  let res = await fetch(fullUrl, {
    ...init,
    headers,
    credentials: "same-origin", // Zabráni strate session pri same-origin API calls
  });

  // Ak napriek všetkému backend vráti 401 a ešte sme neskúsili retry...
  if (res.status === 401 && !_isRetry) {
    console.warn(`[callBackend] 401 z backendu na ${path}, vynucujem obnovu...`);
    
    const { data } = await supabase.auth.refreshSession();
    
    if (data?.session?.access_token) {
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
      res = await fetch(fullUrl, {
        ...init,
        headers,
        credentials: "same-origin",
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

  // Ak to stále padá, vyhodíme chybu, nech ju ošetrí daný widget
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