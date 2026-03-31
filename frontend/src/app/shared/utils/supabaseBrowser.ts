"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    // Čisté volanie bez akéhokoľvek zasahovania do cookieOptions
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // 🕵️ TVOJ ŠPIÓN ÚLOŽISKA ZOSTÁVA PRESNE AKO SI CHCEL
    const storage = _client.auth.storage;
    const originalRemove = storage.removeItem.bind(storage);
    const originalGet = storage.getItem.bind(storage);

    storage.getItem = async (key: string) => {
        const value = await originalGet(key);
        if (!value) {
            console.log(`[SPY] ⚠️ Nenašiel som cookie: ${key} (Ak je to verifier, ignoruj to, je to normálne)`);
        } else {
            if (key.includes('auth-token')) {
                try {
                    JSON.parse(value);
                    console.log(`[SPY] ✅ Cookie ${key} je platný JSON!`);
                } catch (e) {
                    console.error(`[SPY] 🚨 KATASTROFA! Hodnota v ${key} NIE JE platný JSON!`);
                }
            }
        }
        return value;
    };

    storage.removeItem = async (key: string) => {
        console.error(`[SPY] 🛑 SMRTEĽNÝ ÚDER! Supabase fyzicky maže cookie: ${key}`);
        console.trace("[SPY] Kto vydal tento príkaz?");
        return originalRemove(key);
    };

    _client.auth.onAuthStateChange((event: string) => {
      console.log(`[KLIENT DETEKTÍV] Udalosť: ${event}`);
    });
  }
  return _client;
}