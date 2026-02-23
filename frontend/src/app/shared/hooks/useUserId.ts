// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

function getStoredId(): number | null {
   if (typeof window === "undefined") return null;
   const stored = window.localStorage.getItem("selfrace_numeric_id");
   const val = stored ? Number(stored) : null;
   console.log(`[AUTH_DEBUG: useUserId] Prečítané číselné ID z LocalStorage pri štarte: ${val}`);
   return val;
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: getStoredId(), uuid: null });

  const fetchUser = useCallback(async () => {
    console.log("[AUTH_DEBUG: useUserId] Spúšťam fetchUser() na zistenie identity...");
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) console.error("[AUTH_DEBUG: useUserId] Chyba pri getSession():", error.message);

      if (!session?.user) {
        console.warn("[AUTH_DEBUG: useUserId] 🔴 Žiadny user v session! Mažem selfrace_numeric_id z LocalStorage.");
        if (typeof window !== "undefined") window.localStorage.removeItem("selfrace_numeric_id");
        setState({ id: null, uuid: null });
        return;
      }

      console.log(`[AUTH_DEBUG: useUserId] Supabase session POTVRDENÁ pre UUID: ${session.user.id}`);

      if (state.id && state.uuid === session.user.id) {
         console.log("[AUTH_DEBUG: useUserId] ID už máme v pamäti pre tohto usera, skipujem volanie backendu.");
         return;
      }

      console.log("[AUTH_DEBUG: useUserId] Volám POST /users/resolve na zistenie numerického ID z Pythonu...");
      const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_uid: session.user.id })
      });

      console.log("[AUTH_DEBUG: useUserId] Odpoveď z /users/resolve:", res);
      const numId = res?.success ? res.user_id : null;

      if (numId && typeof window !== "undefined") {
         console.log(`[AUTH_DEBUG: useUserId] ✅ Ukladám do LocalStorage selfrace_numeric_id=${numId}`);
         window.localStorage.setItem("selfrace_numeric_id", numId.toString());
         setState({ id: numId, uuid: session.user.id });
      } else {
         console.error("[AUTH_DEBUG: useUserId] ❌ Backend nevrátil user_id! (Alebo success == false)");
      }
    } catch (e) {
      console.error("[AUTH_DEBUG: useUserId] 💥 Fatálna chyba vo fetchUser:", e);
    }
  }, [state.id, state.uuid]);

  useEffect(() => { 
    fetchUser(); 
  }, [fetchUser]);

  return useMemo(() => ({ 
    userId: state.id, 
    userUuid: state.uuid, 
    refresh: fetchUser 
  }), [state.id, state.uuid, fetchUser]);
}