// src/shared/utils/callBackend.ts
"use client";

import { getSupabaseBrowser } from "./supabaseBrowser";
import { API_URL } from "@/app/shared/config";

export async function callBackend<TResponse = any>(
  path: string,
  init: RequestInit = {}
): Promise<TResponse> {
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;

  const headers = new Headers(init.headers || {});
  if (jwt) {
    headers.set("Authorization", `Bearer ${jwt}`);
  }
  // ak posielaš JSON
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    // tu si môžeš spraviť jednotnú error logiku
    const text = await res.text().catch(() => "");
    throw new Error(`BE error ${res.status}: ${text || res.statusText}`);
  }

  // ak niekde nemáš JSON, vieš si to rozvetviť podľa init alebo res.headers
  return (await res.json()) as TResponse;
}