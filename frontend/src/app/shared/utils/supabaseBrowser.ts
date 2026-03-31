"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // 🕵️ TVOJ ŠPIÓN ÚLOŽISKA ZOSTÁVA V PLNEJ SILE
    const storage = _client.auth.storage;
    const originalRemove = storage.removeItem.bind(storage);
    const originalGet = storage.getItem.bind(storage);

    storage.getItem = async (key: string) => {
        const value = await originalGet(key);
        if (!value) {
            console.log(`[SPY] ⚠️ Nenašiel som cookie: ${key} (Ak je to verifier, ignoruj to, je to normálne)`);
        } else {
            if (key.includes('auth-token') && !key.includes('verifier')) {
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
        // 🛑 TOTO JE KĽÚČOVÉ: Ak sa pokúsi zmazať HLAVNÝ token, zablokujeme ho!
        if (key.includes('auth-token') && !key.includes('verifier')) {
            console.error(`[SPY] 🛡️ ZABRÁNIL SOM SMRTEĽNÉMU ÚDERU NA HLAVNÝ TOKEN: ${key}`);
            console.trace("[SPY] Kto sa o to pokúsil?");
            
            // Predstierame, že sme ho zmazali, aby Supabase pokračoval,
            // ale v skutočnosti ho NEVYMAŽEME (nezavoláme originalRemove).
            return; 
        }

        // Ak maže niečo iné (napr. verifier), necháme ho tak
        console.warn(`[SPY] Supabase úspešne zmazal nepotrebnú cookie: ${key}`);
        return originalRemove(key);
    };

    _client.auth.onAuthStateChange((event: string) => {
      console.log(`[KLIENT DETEKTÍV] Udalosť: ${event}`);
    });
  }
  return _client;
}