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

    // Vytiahneme ID priamo cez tvoju utilitu, už žiadne volanie /api/auth/whoami
    const numId = await getUserId();

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