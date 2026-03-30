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
      
      // 1. Supabase (s DB zálohou)
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user ?? null;

      // 2. 🧟 NUKLEÁRNE ČÍTANIE z IndexedDB na predbiehanie
      if (!currentUser && typeof window !== "undefined") {
         try {
            const idbKeyval = await import('idb-keyval');
            const stored = await idbKeyval.get("sr_vault_stable");
            if (stored) {
               const parsed = JSON.parse(stored);
               if (parsed?.user) currentUser = parsed.user;
            }
         } catch (e) {}
      }

      if (!currentUser) {
        // Skutočné odhlásenie iba cez explicitný flag
        if (typeof window !== "undefined" && window.sessionStorage.getItem("explicit_logout") === "true") {
            window.localStorage.removeItem("selfrace_numeric_id");
            window.localStorage.removeItem("selfrace_uuid");
            if (isMounted) {
              setState({ id: null, uuid: null });
              setIsChecking(false);
            }
        } else {
            // Nič nerobíme, čakáme, Supabase ho možno požiada o refresh z IndexedDB
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
    
    // ✅ TYPESCRIPT FIX pre buid (z image_2.png)
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