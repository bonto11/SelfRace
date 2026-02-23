// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {},
): Promise<T> {
  const supabase = getSupabaseBrowser();

  // Ak je token starý, toto ho v pozadí (ticho) obnoví predtým, než vráti data.
  const { data, error } = await supabase.auth.getSession();

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  if (data?.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  } else if (error) {
    console.warn("[callBackend] Chýbajúca alebo neplatná session", error.message);
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
    // fallback pre non-json
  }

  if (!res.ok) {
    console.error(`[callBackend] HTTP ${res.status} na ${path}`);
    throw new Error(`HTTP ${res.status} ${text}`);
  }

  return (json ?? {}) as T;
}