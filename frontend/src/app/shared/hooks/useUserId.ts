"use client";

import { useState, useEffect, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({
    id: typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null,
    uuid: typeof window !== "undefined" ? window.localStorage.getItem("selfrace_uuid") : null
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const resolveUser = async () => {
      let currentUser = null;
      
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user ?? null;

      if (!currentUser) {
         const { data } = await supabase.auth.getUser();
         currentUser = data?.user ?? null;
      }

      // 🚀 NUKLEÁRNE ČÍTANIE (LocalStorage + Cookie pre Apple PWA)
      if (!currentUser && typeof window !== "undefined") {
         try {
            let stored = window.localStorage.getItem("sr_vault_session");
            if (!stored) stored = window.localStorage.getItem("sr_vault_session_backup");
            
            // 🍏 Kryptonit na Apple: Ak LS zlyhá, hľadáme v Cookie
            if (!stored) {
               const match = document.cookie.match(new RegExp('(^| )sr_vault_cookie=([^;]+)'));
               if (match) stored = decodeURIComponent(match[2]);
            }

            if (stored) {
               const parsed = JSON.parse(stored);
               if (parsed?.user) currentUser = parsed.user;
            }
         } catch (e) {}
      }

      if (!currentUser) {
        if (typeof window !== "undefined" && window.sessionStorage.getItem("explicit_logout") === "true") {
            window.localStorage.removeItem("selfrace_numeric_id");
            window.localStorage.removeItem("selfrace_uuid");
            if (isMounted) {
              setState({ id: null, uuid: null });
              setIsChecking(false);
            }
        } else {
            if (isMounted) setIsChecking(false);
        }
        return;
      }

      let numId = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

      if (!numId) {
        try {
          const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ auth_uid: currentUser.id })
          });
          if (res?.success && res.user_id) {
              numId = res.user_id;
              window.localStorage.setItem("selfrace_numeric_id", String(numId));
          }
        } catch (e) {
          console.warn("[AUTH] Chyba pri resolvingu user_id", e);
        }
      }

      window.localStorage.setItem("selfrace_uuid", currentUser.id);

      if (isMounted) {
        setState({ id: numId, uuid: currentUser.id });
        setIsChecking(false);
      }
    };

    resolveUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any) => {
       if (_event !== "INITIAL_SESSION") resolveUser();
    });

    return () => {
        isMounted = false;
        subscription.unsubscribe();
    };
  }, []);

  return useMemo(() => ({
    userId: state.id,
    userUuid: state.uuid,
    isChecking,
    refresh: () => setIsChecking(false)
  }), [state.id, state.uuid, isChecking]);
}