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
   return val;
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: getStoredId(), uuid: null });

  const fetchUser = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem("selfrace_numeric_id");
        setState({ id: null, uuid: null });
        return;
      }

      //ID už máme v pamäti pre tohto usera, skipujem volanie backendu.
      if (state.id && state.uuid === session.user.id) {
         return;
      }

      //Volám POST /users/resolve na zistenie numerického ID z Pythonu...
      const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_uid: session.user.id })
      });

      const numId = res?.success ? res.user_id : null;

      if (numId && typeof window !== "undefined") {
         window.localStorage.setItem("selfrace_numeric_id", numId.toString());
         setState({ id: numId, uuid: session.user.id });
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