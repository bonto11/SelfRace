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
  const uuid = uuidMatch ? uuidMatch[1] : null;
  
  console.log(`[AUTH_DEBUG: useUserId] Načítané cookies pri štarte: sr_id=${id}, sr_uuid=${uuid}`);
  return { id, uuid };
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>(getStoredIds);

  const fetchUser = useCallback(async () => {
    console.log("[AUTH_DEBUG: useUserId] Spúšťam fetchUser() na zistenie identity...");
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AUTH_DEBUG: useUserId] Chyba pri getSession():", error.message);
      }

      if (!session?.user) {
        console.warn("[AUTH_DEBUG: useUserId] 🔴 Žiadny user v session! Mažem cookies a stav.");
        if (typeof document !== "undefined") {
          document.cookie = "sr_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie = "sr_uuid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
        setState({ id: null, uuid: null });
        return;
      }

      console.log(`[AUTH_DEBUG: useUserId] Supabase session existuje pre UUID: ${session.user.id}`);

      // Ak už ID máme a sedí s UUID, nebudeme zbytočne volať backend
      if (state.id && state.uuid === session.user.id) {
        console.log("[AUTH_DEBUG: useUserId] ID už máme v stave, skipujem volanie backendu.");
        return;
      }

      console.log("[AUTH_DEBUG: useUserId] Volám POST /users/resolve na zistenie numerického ID...");
      const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_uid: session.user.id })
      });

      console.log("[AUTH_DEBUG: useUserId] Odpoveď z /users/resolve:", res);
      const numId = res?.success ? res.user_id : null;

      if (numId) {
        console.log(`[AUTH_DEBUG: useUserId] ✅ Ukladám do cookies sr_id=${numId} a sr_uuid=${session.user.id}`);
        const maxAge = 60 * 60 * 24 * 30; // 30 dní
        document.cookie = `sr_uuid=${session.user.id}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `sr_id=${numId}; path=/; max-age=${maxAge}; SameSite=Lax`;
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
  }), [state, fetchUser]);
}