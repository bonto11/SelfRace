"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

// Definujeme si štruktúru dát v app_settings, aby TS vedel, čo hľadať
interface AppSettings {
  force_logout_at?: string;
  active?: boolean;
  message?: { sk: string; en: string };
}

export default function SessionGuard() {
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    // 1. Prihlásime sa na odber zmien v tabuľke app_settings
    const channel = supabase
      .channel('global-session-checks')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'app_settings', 
          filter: 'key=eq.maintenance_mode' 
        },
        (payload: RealtimePostgresUpdatePayload<{ value: AppSettings }>) => {
          // payload.new.value obsahuje naše JSONB pole z databázy
          const forceLogoutAt = payload.new.value?.force_logout_at;
          
          if (forceLogoutAt) {
            // Zamedzíme zacykleniu – ak sme už tento konkrétny signál spracovali, ignorujeme ho
            const lastLogout = localStorage.getItem('last_force_logout');
            if (lastLogout !== forceLogoutAt) {
              console.log("🚨 Received global force logout signal.");
              handleGlobalLogout(forceLogoutAt);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleGlobalLogout = async (logoutTimestamp: string) => {
    // Uložíme si čas odhlásenia ako prevenciu pred loopom
    localStorage.setItem('last_force_logout', logoutTimestamp);

    // 1. Štandardný pokus o odhlásenie zo Supabase session
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[SessionGuard] Error during standard signOut:", e);
    }

    // 2. Nukleárny úder na lokálny stav klienta
    if (typeof window !== "undefined") {
      // Vyčistíme lokálne úložiská (všetky cacheované dáta)
      window.localStorage.clear(); 
      window.sessionStorage.clear();

      // Natvrdo vymažeme všetky Supabase cookies (vymaže JWT token z prehliadača)
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0].trim();
        if (cookieName.startsWith("sb-")) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });

      // 3. Hard reload na úvodnú obrazovku
      // Použijeme window.location.replace namiesto router.push, 
      // aby sme zahodili úplne celú Next.js pamäť klienta a znemožnili krok "Späť"
      window.location.replace("/");
    }
  };

  return null; // Komponent nič nerenderuje
}