// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

type WhoAmI = { id: number | null; uuid: string | null };

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: null, uuid: null });

  const fetchUser = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Keďže už nemáme vlastnú API routu, používame priamo UUID od Supabase
        setState({ id: null, uuid: user.id });
      } else {
        setState({ id: null, uuid: null });
      }
    } catch (e) {
      setState({ id: null, uuid: null });
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