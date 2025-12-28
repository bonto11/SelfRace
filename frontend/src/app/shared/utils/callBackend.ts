// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {}
): Promise<T> {
  const supabase = getSupabaseBrowser();

  // zoberieme aktuálnu session (access_token je v localStorage)
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[callBackend] getSession error:", error.message);
  }

  const token = data?.session?.access_token ?? null;
  console.log("[callBackend] session", { token, error });

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  // ak máme token → pridáme Authorization
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