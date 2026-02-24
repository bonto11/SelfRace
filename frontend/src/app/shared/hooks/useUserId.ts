// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

function getStoredId(): number | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("selfrace_numeric_id");
  return stored ? Number(stored) : null;
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({
    id: getStoredId(),
    uuid: null,
  });

  const fetchUser = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      window.localStorage.removeItem("selfrace_numeric_id");
      setState({ id: null, uuid: null });
      return;
    }

    const currentUuid = session.user.id;

    // ak už máme správny user cached → nič nerob
    if (state.id && state.uuid === currentUuid) {
      return;
    }

    try {
      const res = await callBackend<{ success: boolean; user_id?: number }>(
        "/users/resolve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth_uid: currentUuid }),
        }
      );

      const numId = res?.success ? res.user_id ?? null : null;

      if (numId) {
        window.localStorage.setItem(
          "selfrace_numeric_id",
          numId.toString()
        );

        setState({
          id: numId,
          uuid: currentUuid,
        });
      }
    } catch (e) {
      console.error("[useUserId] resolve failed", e);
    }
  }, [state.id, state.uuid]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    userId: state.id,
    userUuid: state.uuid,
    refresh: fetchUser,
  };
}