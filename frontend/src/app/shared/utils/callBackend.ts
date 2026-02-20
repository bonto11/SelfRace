// src/app/shared/utils/callBackend.ts
"use client";

// Uisti sa, že táto cesta smeruje do SPRÁVNEHO config súboru!
import { API_URL } from "@/app/shared/config"; 
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

// ==========================================
// 🚨 DEBUG BLOK - Vypíše sa pri načítaní súboru
// ==========================================
console.log("=== DEBUG ENVIRONMENT PREMENNÝCH ===");
console.log("1. Importované API_URL z configu:", API_URL);
console.log("2. Priamo z process.env.NEXT_PUBLIC_BACKEND_URL:", process.env.NEXT_PUBLIC_BACKEND_URL);
console.log("======================================");

async function getAuthToken(): Promise<{
  token: string | null;
  refreshed: boolean;
}> {
  const supabase = getSupabaseBrowser();

  // 1) pokus z browser Supabase klienta (localStorage)
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.warn("[callBackend] getSession error:", error.message);
    }

    const token = data?.session?.access_token ?? null;
    if (token) {
      return { token, refreshed: false };
    }
  } catch (e: any) {
    console.warn("[callBackend] getSession threw:", e?.message ?? e);
  }

  // 2) fallback → zober session z httpOnly cookies cez server route
  try {
    const res = await fetch("/api/auth/session-token", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[callBackend] /api/auth/session-token status:", res.status);
      return { token: null, refreshed: false };
    }

    const json = (await res.json()) as {
      access_token?: string | null;
      refresh_token?: string | null;
    };

    const access = json?.access_token ?? null;
    const refresh = json?.refresh_token ?? null;

    if (access && refresh) {
      try {
        // re-hydration do Supabase JS klienta,
        // aby ďalšie getSession() vracali platnú session
        await supabase.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
      } catch (e: any) {
        console.warn(
          "[callBackend] supabase.auth.setSession failed:",
          e?.message ?? e
        );
      }
      return { token: access, refreshed: true };
    }

    return { token: null, refreshed: false };
  } catch (e: any) {
    console.warn(
      "[callBackend] /api/auth/session-token error:",
      e?.message ?? e
    );
    return { token: null, refreshed: false };
  }
}

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {}
): Promise<T> {
  const { token } = await getAuthToken();

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    console.warn("[callBackend] no token available");
  }

  // ==========================================
  // 🚨 BEZPEČNOSTNÁ POISTKA A DEBUG REQUESTU
  // ==========================================
  // Ak je API_URL z importu undefined, skúsime to ťahať priamo z process.env.
  // Ak ani to nepôjde, necháme prázdny string namiesto slova "undefined".
  const baseUrl = API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const fullUrl = `${baseUrl}${path}`;

  console.log(`[callBackend] Vykonávam request na: ${fullUrl}`);

  if (fullUrl.includes("undefined")) {
    console.error("🚨 KRITICKÁ CHYBA: URL stále obsahuje slovo 'undefined'. Skontroluj Vercel build logs a cesty k premenným!");
  }
  // ==========================================

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