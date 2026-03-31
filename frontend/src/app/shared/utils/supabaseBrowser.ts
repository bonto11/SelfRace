"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // TICHÝ ŠTÍT: Zostáva len nevyhnutná ochrana
    const storage = _client.auth.storage;
    const originalRemove = storage.removeItem.bind(storage);

    storage.removeItem = async (key: string) => {
        // Ak sa Supabase v panike pokúsi zmazať HLAVNÝ token, ticho ho zablokujeme
        if (key.includes('auth-token') && !key.includes('verifier')) {
            return; 
        }

        // Všetok ostatný balast (napr. verifier) necháme normálne zmazať
        return originalRemove(key);
    };
  }
  return _client;
}