"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { getUserId } from "./userUtils";

type WhoAmI = { id: number | null; uuid: string | null };

function getStoredIds(): WhoAmI {
  if (typeof document === "undefined") return { id: null, uuid: null };
  const idMatch = document.cookie.match(/(?:^|; )sr_id=([^;]*)/);
  const uuidMatch = document.cookie.match(/(?:^|; )sr_uuid=([^;]*)/);
  const id = idMatch ? Number(idMatch[1]) : null;
  return { id, uuid: uuidMatch ? uuidMatch[1] : null };
}

export function useUserId() {
  // Inicializujeme okamžite z cookies, aby widgety nepreblikli na 401
  const [state, setState] = useState<WhoAmI>(getStoredIds);

  const fetchUser = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        // Iba ak Supabase povie, že session fakt nie je, zmažeme cookies
        if (typeof document !== "undefined") {
          document.cookie = "sr_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie = "sr_uuid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
        setState({ id: null, uuid: null });
        return;
      }

      // Ak máme session, ale chýba nám numerické ID, dotiahneme ho
      if (!state.id) {
        const numId = await getUserId();
        if (numId) {
          const maxAge = 60 * 60 * 24 * 30;
          document.cookie = `sr_uuid=${session.user.id}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `sr_id=${numId}; path=/; max-age=${maxAge}; SameSite=Lax`;
          setState({ id: numId, uuid: session.user.id });
        }
      }
    } catch (e) {
      console.warn("[useUserId] Sync failed", e);
    }
  }, [state.id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  return useMemo(() => ({ 
    userId: state.id, 
    userUuid: state.uuid, 
    refresh: fetchUser 
  }), [state, fetchUser]);
}