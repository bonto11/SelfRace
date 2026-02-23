// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { getUserId } from "./userUtils";

type WhoAmI = { id: number | null; uuid: string | null };

let cached: WhoAmI | null = null;
let inflight: Promise<WhoAmI> | null = null;

async function fetchWhoAmI(): Promise<WhoAmI> {
  try {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { id: null, uuid: null };

    // Vytiahneme číselné ID cez tvoju utilitu
    const numId = await getUserId();

    // ✅ TOTO JE NOVÉ: Zapíšeme sr_id a sr_uuid do cookies manuálne, presne ako predtým server!
    if (typeof document !== "undefined") {
      const maxAge = 60 * 60 * 24 * 30; // 30 dní
      
      // Zápis sr_uuid
      document.cookie = `sr_uuid=${user.id}; path=/; max-age=${maxAge}; SameSite=Lax`;
      
      // Zápis sr_id (ak existuje)
      if (numId) {
        document.cookie = `sr_id=${numId}; path=/; max-age=${maxAge}; SameSite=Lax`;
      }
    }

    return {
      id: numId,
      uuid: user.id,
    };
  } catch (e) {
    return { id: null, uuid: null };
  }
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>(() => cached ?? { id: null, uuid: null });

  useEffect(() => {
    if (cached) return;

    if (!inflight) {
      inflight = fetchWhoAmI()
        .then((v) => {
          cached = v;
          return v;
        })
        .finally(() => {
          inflight = null;
        });
    }

    inflight
      .then((v) => setState(v))
      .catch(() => setState({ id: null, uuid: null }));
  }, []);

  const refresh = useCallback(async () => {
    cached = null;
    setState({ id: null, uuid: null });
    try {
      const v = await fetchWhoAmI();
      cached = v;
      setState(v);
    } catch (e) {
      setState({ id: null, uuid: null });
    }
  }, []);

  return useMemo(
    () => ({ userId: state.id, userUuid: state.uuid, refresh }),
    [state.id, state.uuid, refresh]
  );
}