"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { forceServerSignOut } from "@/app/hq-secure-zone/actions";
import { usePathname } from "next/navigation";

interface AppSettings {
  force_logout_at?: string;
  active?: boolean;
  message?: { sk: string; en: string };
}

export default function SessionGuard() {
  const supabase = getSupabaseBrowser();
  const pathname = usePathname();

  // 🛡️ POMOCNÁ FUNKCIA: Má aktuálny používateľ imunitu (Admin)?
  const checkIsAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', user.id)
      .single();
      
    return profile?.role === 'ADMIN';
  };

  // 🧠 HLAVNÝ MOZOG: Spracovanie prijatých dát z databázy
  const processSettings = async (settings?: AppSettings) => {
    if (!settings) return;
    
    const forceLogoutAt = settings.force_logout_at;
    const isMaintenanceActive = settings.active;
    
    const lastLogout = localStorage.getItem('last_force_logout');
    const needsLogout = forceLogoutAt && lastLogout !== forceLogoutAt;

    // 1. NÁVRAT Z ÚDRŽBY: Ak sme na maintenance stránke, ale údržba už nebeží
    if (!isMaintenanceActive && pathname === '/maintenance') {
      console.log("🟢 [SessionGuard] Údržba skončila! Presmerovávam do appky...");
      window.location.assign('/'); // Hodíme ho späť (middleware už ho pustí na activities)
      return;
    }

    // Ak sa nevyžaduje logout, nebeží údržba a nie sme na maintenance stránke, končíme
    if (!needsLogout && !isMaintenanceActive) return;

    // Skontrolujeme Admin Imunitu
    const isAdmin = await checkIsAdmin();

    if (isAdmin) {
      // 👑 ADMIN IMUNITA
      if (needsLogout) {
        localStorage.setItem('last_force_logout', forceLogoutAt);
        console.log("🛡️ [SessionGuard] Force Logout ignorovaný (Admin Imunita)");
      }
      return; 
    }

    // --- LOGIKA PRE BEŽNÝCH POUŽÍVATEĽOV ---

    // 1. Zasiahol nás Nukleárny úder (Force Logout)
    if (needsLogout) {
      console.log("🚨 [SessionGuard] Prijatý signál na odhlásenie.");
      await handleGlobalLogout(forceLogoutAt);
      return; 
    }

    // 2. Bola zapnutá Údržba a používateľ ešte nie je na maintenance obrazovke
    if (isMaintenanceActive && pathname !== '/maintenance') {
      console.log("🚧 [SessionGuard] Údržba je aktívna! Presmerovávam...");
      window.location.assign('/maintenance');
    }
  };

  // 🔍 Agresívna kontrola (Pri zmene URL alebo vytiahnutí appky z pozadia)
  const checkAggressively = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single();
      
      await processSettings(data?.value);
    } catch (e) {
      console.warn("[SessionGuard] Aggressive check failed:", e);
    }
  };

  useEffect(() => {
    checkAggressively();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkAggressively();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pathname]);

  // EFEKT 2: Realtime Listener
  useEffect(() => {
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
          processSettings(payload.new.value);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleGlobalLogout = async (logoutTimestamp: string) => {
    try { await supabase.auth.signOut(); } catch (e) {}
    try { await forceServerSignOut(); } catch (e) {}

    if (typeof window !== "undefined") {
      window.localStorage.clear(); 
      window.sessionStorage.clear();
      
      localStorage.setItem('last_force_logout', logoutTimestamp);

      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0].trim();
        if (cookieName.startsWith("sb-")) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });

      window.location.replace("/");
    }
  };

  return null;
}