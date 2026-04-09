"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useRouter } from "next/navigation";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

// Definujeme si štruktúru dát v app_settings, aby TS vedel, čo hľadať
interface AppSettings {
  force_logout_at?: string;
  active?: boolean;
  message?: { sk: string; en: string };
}

export default function SessionGuard() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();

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
            console.log("🚨 Received global force logout signal.");
            handleGlobalLogout();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const handleGlobalLogout = async () => {
    // Odhlásime používateľa zo Supabase session
    await supabase.auth.signOut();
    // Premažeme klientsku cache a hodíme ho na landing page
    router.push("/");
    router.refresh();
  };

  return null; // Komponent nič nerenderuje
}