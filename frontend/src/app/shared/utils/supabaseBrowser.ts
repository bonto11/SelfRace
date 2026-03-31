"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      // Žiadne sr-token! Necháme ho použiť default, len mu prikážeme 1 rok.
      cookieOptions: {
        maxAge: 31536000,
        path: '/',
        sameSite: 'lax',
      }
    });

    // 🕵️ ULTIMÁTNY ŠPIÓN ÚLOŽISKA ZOSTÁVA!
    const storage = _client.auth.storage;
    const originalRemove = storage.removeItem.bind(storage);
    const originalGet = storage.getItem.bind(storage);

    storage.getItem = async (key: string) => {
        const value = await originalGet(key);
        if (!value) console.log(`[SPY] ⚠️ Supabase chcel prečítať cookie "${key}", ale nenašiel ju!`);
        return value;
    };

    storage.removeItem = async (key: string) => {
        console.error(`[SPY] 🛑 SMRTEĽNÝ ÚDER! Supabase fyzicky maže cookie: ${key}`);
        console.trace("[SPY] Kto vydal tento príkaz?");
        // Alert priamo do tváre!
        alert(`POZOR: Supabase práve zmazal tvoju cookie! Dôvod hľadaj v F12 Konzoli.`);
        return originalRemove(key);
    };

    _client.auth.onAuthStateChange((event: string) => {
      console.log(`[KLIENT DETEKTÍV] Udalosť: ${event}`);
    });
  }
  return _client;
}