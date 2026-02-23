// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

// ✅ Skutočná prehliadačová databáza (Prežije aj okamžité Vyswipeovanie apky)
const idbStorage = {
  async getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SupabaseAuthDB', 1);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('auth', 'readonly');
        const store = tx.objectStore('auth');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('auth', 'readwrite');
        const store = tx.objectStore('auth');
        const request = store.put({ id: key, value });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {}
  },
  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('auth', 'readwrite');
        const store = tx.objectStore('auth');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {}
  }
};

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'selfrace-pwa-session',
          // ✅ Prikážeme Supabase uložiť token do IndexedDB
          storage: typeof window !== 'undefined' ? idbStorage : undefined,
        }
      }
    );
  }
  return _client;
}
