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

  // Zázrak č.1: getSession() si automaticky a bezpečne obnoví token v pozadí, ak vypršal.
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token ?? null;

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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
    // fallback
  }

  if (!res.ok) {
    console.error(`[callBackend] HTTP ${res.status} na ${path}`);
    throw new Error(`HTTP ${res.status}`);
  }

  return (json ?? {}) as T;
}