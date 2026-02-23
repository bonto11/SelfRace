// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { getUserId } from "./userUtils";

type WhoAmI = { id: number | null; uuid: string | null };

// Pomocná funkcia na bleskové prečítanie cookies bez čakania na sieť
function getStoredIds(): WhoAmI {
  if (typeof document === "undefined") return { id: null, uuid: null };
  const idMatch = document.cookie.match(/(?:^|; )sr_id=([^;]*)/);
  const uuidMatch = document.cookie.match(/(?:^|; )sr_uuid=([^;]*)/);
  return {
    id: idMatch ? Number(idMatch[1]) : null,
    uuid: uuidMatch ? uuidMatch[1] : null,
  };
}

export function useUserId() {
  // 1. Apka okamžite štartuje s IDčkom, ktoré si pamätá z cookies (žiadne prázdne widgety)
  const [state, setState] = useState<WhoAmI>(getStoredIds);

  const fetchUser = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      // 2. Použijeme getSession namiesto getUser (číta z LocalStorage, takže nezlyhá na sieti)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setState({ id: null, uuid: null });
        return;
      }

      // Ak už cookies máme a sedia s aktuálnym tokenom, nemusíme volať Python backend
      const current = getStoredIds();
      if (current.id && current.uuid === session.user.id) {
        setState(current);
        return;
      }

      // 3. Ak cookies náhodou nemáme, zavoláme backend a uložíme ich pre ďalší refresh
      const numId = await getUserId();

      if (typeof document !== "undefined" && numId) {
        const maxAge = 60 * 60 * 24 * 30; // 30 dní
        document.cookie = `sr_uuid=${session.user.id}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `sr_id=${numId}; path=/; max-age=${maxAge}; SameSite=Lax`;
      }

      setState({ id: numId, uuid: session.user.id });
    } catch (e) {
      // V prípade chyby potichu failneme, ale nezmažeme existujúci state
      console.warn("[useUserId] Background sync zlyhal", e);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return useMemo(
    () => ({ userId: state.id, userUuid: state.uuid, refresh: fetchUser }),
    [state.id, state.uuid, fetchUser]
  );
}