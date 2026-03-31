"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // 🕵️ ŠPIÓN ZOSTÁVA
    const storage = _client.auth.storage;
    const originalRemove = storage.removeItem.bind(storage);
    const originalGet = storage.getItem.bind(storage);

    storage.getItem = async (key: string) => {
        const value = await originalGet(key);
        if (!value) console.log(`[SPY] Nenašiel som: ${key}`); // Toto je v poriadku
        return value;
    };

    storage.removeItem = async (key: string) => {
        console.error(`[SPY] 🛑 ZMAZANIE COOKIE: ${key}`);
        console.trace("[SPY] Kto vydal tento príkaz?");
        return originalRemove(key);
    };
  }
  return _client;
}