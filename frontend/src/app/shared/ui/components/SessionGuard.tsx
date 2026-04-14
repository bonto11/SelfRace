"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { forceServerSignOut } from "@/app/hq-secure-zone/actions";

// Definujeme si štruktúru dát v app_settings, aby TS vedel, čo hľadať
interface AppSettings {
  force_logout_at?: string;
  active?: boolean;
  message?: { sk: string; en: string };
}

export default function SessionGuard() {
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    let isMounted = true;

    // 1. KONTROLA PRE OFFLINE POUŽÍVATEĽOV (Spustí sa hneď po načítaní)
    const checkInitialStatus = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();
          
        const forceLogoutAt = data?.value?.force_logout_at;
        if (forceLogoutAt && isMounted) {
          const lastLogout = localStorage.getItem('last_force_logout');
          if (lastLogout !== forceLogoutAt) {
            console.log("🚨 [InitialCheck] Found unhandled force logout signal!");
            handleGlobalLogout(forceLogoutAt);
          }
        }
      } catch (e) {
        console.warn("[SessionGuard] Initial check failed:", e);
      }
    };
    
    checkInitialStatus();

    // 2. KONTROLA PRE ONLINE POUŽÍVATEĽOV (Realtime Listener)
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
          const forceLogoutAt = payload.new.value?.force_logout_at;
          
          if (forceLogoutAt) {
            // Zamedzíme zacykleniu – ak sme už tento konkrétny signál spracovali, ignorujeme ho
            const lastLogout = localStorage.getItem('last_force_logout');
            if (lastLogout !== forceLogoutAt) {
              console.log("🚨 [Realtime] Received global force logout signal.");
              handleGlobalLogout(forceLogoutAt);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

 const handleGlobalLogout = async (logoutTimestamp: string) => {
    // 1. Štandardný pokus o odhlásenie zo Supabase session
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[SessionGuard] Error during client signOut:", e);
    }

    // 2. Zavoláme Server Action, aby zmazal bezpečné HttpOnly cookies
    try {
      await forceServerSignOut();
    } catch (e) {
      console.warn("[SessionGuard] Serverové odhlásenie zlyhalo:", e);
    }

    // 3. Nukleárny úder na lokálny stav klienta
    if (typeof window !== "undefined") {
      // NAJPRV VŠETKO VYČISTÍME
      window.localStorage.clear(); 
      window.sessionStorage.clear();

      // 🚨 AŽ POTOM ULOŽÍME ČAS ODHLÁSENIA AKO POISTKU! (Oprava slučky)
      localStorage.setItem('last_force_logout', logoutTimestamp);

      // Natvrdo vymažeme všetky Supabase cookies z klientskej strany
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0].trim();
        if (cookieName.startsWith("sb-")) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });

      // Hard reload na úvodnú obrazovku
      window.location.replace("/");
    }
  };

  return null; // Komponent nič nerenderuje
}