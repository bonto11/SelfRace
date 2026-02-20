// src/app/shared/utils/callBackend.ts
"use client";

// Uisti sa, že táto cesta je správna! (Niekedy si mal /lib/config)
import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

// ŽELEZNÁ POISTKA: Ak zlyhá Vercel env, použijeme natvrdo tvoj produkčný backend,
// aby aplikácia nezostala rozbitá s "undefined" v URL.
const FINAL_BASE_URL =
  API_URL && !API_URL.includes("undefined")
    ? API_URL
    : "https://api.selfrace.com";
// ==========================================

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
        await supabase.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
      } catch (e: any) {
        console.warn(
          "[callBackend] supabase.auth.setSession failed:",
          e?.message ?? e,
        );
      }
      return { token: access, refreshed: true };
    }

    return { token: null, refreshed: false };
  } catch (e: any) {
    console.warn(
      "[callBackend] /api/auth/session-token error:",
      e?.message ?? e,
    );
    return { token: null, refreshed: false };
  }
}

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
): Promise<T> {
  const { token } = await getAuthToken();

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    console.warn("[callBackend] no token available");
  }

  // Použijeme našu bezpečnú premennú namiesto API_URL
  const fullUrl = `${FINAL_BASE_URL}${path}`;
  console.log(`[callBackend] Vykonavam fetch na: ${fullUrl}`);

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
