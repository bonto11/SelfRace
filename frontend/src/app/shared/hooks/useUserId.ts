// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

// Okamžité synchrónne prečítanie z cookies
function getStoredId(): number | null {
   if (typeof document === "undefined") return null;
   const match = document.cookie.match(/(?:^|;\s*)selfrace_numeric_id=([^;]*)/);
   return match ? Number(match[1]) : null;
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: getStoredId(), uuid: null });

  const fetchUser = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (typeof document !== "undefined") {
           document.cookie = "selfrace_numeric_id=; path=/; max-age=0; SameSite=Lax; Secure";
        }
        setState({ id: null, uuid: null });
        return;
      }

      if (state.id && state.uuid === session.user.id) return;

      const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_uid: session.user.id })
      });

      const numId = res?.success ? res.user_id : null;

      if (numId && typeof document !== "undefined") {
         document.cookie = `selfrace_numeric_id=${numId}; path=/; max-age=31536000; SameSite=Lax; Secure`;
         setState({ id: numId, uuid: session.user.id });
      }
    } catch (e) {
      console.warn("[useUserId] Sync failed", e);
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
