// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

function tryReadTokenFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;

  try {
    // Supabase si štandardne ukladá key v tvare "sb-...-auth-token"
    const keys = Object.keys(window.localStorage);
    const key = keys.find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    if (!key) return null;

    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {}
): Promise<T> {
  const supabase = getSupabaseBrowser();

  let token: string | null = null;

  // 1) pokus cez Supabase API
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[callBackend] getSession error:", error.message);
    }
    token = data?.session?.access_token ?? null;
  } catch (e) {
    console.warn("[callBackend] getSession threw:", e);
  }

  // 2) fallback – ak Supabase vrátilo null, skús priamo Local Storage
  if (!token) {
    const lsToken = tryReadTokenFromLocalStorage();
    if (lsToken) {
      console.debug("[callBackend] using token from localStorage fallback");
      token = lsToken;
    } else {
      console.debug("[callBackend] no token available");
    }
  }

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
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