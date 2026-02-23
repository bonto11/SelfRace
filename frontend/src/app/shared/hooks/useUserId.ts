// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

function getStoredIds(): WhoAmI {
  if (typeof document === "undefined") return { id: null, uuid: null };
  const idMatch = document.cookie.match(/(?:^|; )sr_id=([^;]*)/);
  const uuidMatch = document.cookie.match(/(?:^|; )sr_uuid=([^;]*)/);
  const id = idMatch ? Number(idMatch[1]) : null;
  return { id, uuid: uuidMatch ? uuidMatch[1] : null };
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>(getStoredIds);

  const fetchUser = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (typeof document !== "undefined") {
          document.cookie = "sr_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie = "sr_uuid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
        setState({ id: null, uuid: null });
        return;
      }

      // Ak už máme ID v pamäti, nebudeme spamovať backend
      if (state.id && state.uuid === session.user.id) return;

      // Voláme tvoj REÁLNY python backend
      const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_uid: session.user.id })
      });

      const numId = res?.success ? res.user_id : null;

      if (numId) {
        const maxAge = 60 * 60 * 24 * 30; // 30 dní
        document.cookie = `sr_uuid=${session.user.id}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `sr_id=${numId}; path=/; max-age=${maxAge}; SameSite=Lax`;
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
  }), [state, fetchUser]);
}
