"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

export function useUserId() {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<WhoAmI>({
    id: typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null,
    uuid: typeof window !== "undefined" ? window.localStorage.getItem("selfrace_uuid") : null
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const resolveUser = async () => {
      try {
        let { data: { session }, error } = await supabase.auth.getSession();

        // 🔥 PARTIZÁNSKY HACK: Ak session neexistuje, ideme resuscitovať!
        if (!session) {
          const backupAccess = window.localStorage.getItem("sr_backup_access");
          const backupRefresh = window.localStorage.getItem("sr_backup_refresh");

          if (backupAccess && backupRefresh) {
            console.log("🧟 [AUTH] PWA zmazala session! Oživujem token zo zálohy...");
            const res = await supabase.auth.setSession({
              access_token: backupAccess,
              refresh_token: backupRefresh
            });
            session = res.data?.session;
            
            if (session) {
                console.log("✅ [AUTH] Oživenie úspešné!");
            } else {
                console.warn("❌ [AUTH] Oživenie zlyhalo, token už asi úplne expiroval.");
            }
          }
        }

        const user = session?.user;

        if (!user) {
          // Ak zlyhalo všetko, až teraz reálne odhlasujeme
          window.localStorage.removeItem("selfrace_numeric_id");
          window.localStorage.removeItem("selfrace_uuid");
          window.localStorage.removeItem("sr_backup_access");
          window.localStorage.removeItem("sr_backup_refresh");
          
          if (isMounted) {
            setState({ id: null, uuid: null });
            setIsChecking(false);
          }

          const isPublicPage = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");
          if (!isPublicPage) {
              router.replace("/signin");
          }
          return;
        }

        // 💾 Robíme zálohu pre prípad, že nás apka zasa vyswajpne
        window.localStorage.setItem("sr_backup_access", session.access_token);
        window.localStorage.setItem("sr_backup_refresh", session.refresh_token);

        let numId = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        if (!numId) {
          try {
            const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ auth_uid: user.id })
            });

            if (res?.success && res.user_id) {
                numId = res.user_id;
                window.localStorage.setItem("selfrace_numeric_id", String(numId));
                window.localStorage.setItem("selfrace_uuid", user.id);
            }
          } catch (e) {
            console.error("[AUTH] Zlyhal request na resolve:", e);
          }
        } else {
           window.localStorage.setItem("selfrace_uuid", user.id);
        }

        if (isMounted) {
          setState({ id: numId, uuid: user.id });
          setIsChecking(false);
        }

      } catch (e) {
         if (isMounted) setIsChecking(false);
      }
    };

    resolveUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
            resolveUser();
        }
    });

    return () => {
        isMounted = false;
        subscription.unsubscribe();
    };
  }, [pathname, router]);

  return useMemo(() => ({
    userId: state.id,
    userUuid: state.uuid,
    isChecking,
    refresh: () => {
        setIsChecking(true);
        getSupabaseBrowser().auth.getSession().then(() => setIsChecking(false));
    }
  }), [state.id, state.uuid, isChecking]);
}
