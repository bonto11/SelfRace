"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

// Používame čistý JS klient s vlastným storage kľúčom
export const supabaseBrowser = createClient(
  SUPABASE_URL!,
  SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      storageKey: 'selfrace-auth-session', // Vlastný kľúč v LocalStorage
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    }
  }
);

export function getSupabaseBrowser() {
  return supabaseBrowser;
}