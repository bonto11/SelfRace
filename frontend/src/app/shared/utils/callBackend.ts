// src/app/shared/utils/callBackend.ts
"use client";

import { API_URL } from "@/app/shared/config";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export type BackendInit = RequestInit;

export async function callBackend<T = any>(
  path: string,
  init: BackendInit = {}
): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  // 1) pokus o Supabase access token (do budúcna, keď prejdeš na full Supabase auth)
  let token: string | null = null;
  try {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[callBackend] getSession error:", error.message);
    }
    token = data?.session?.access_token ?? null;
  } catch (err) {
    console.warn("[callBackend] getSession threw:", err);
  }

  // 2) ak token máme → daj ho do Authorization
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    // DÔLEŽITÉ: pošli aj jwe cookie na api-dev.*
    credentials: "include",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // nechaj json = null
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