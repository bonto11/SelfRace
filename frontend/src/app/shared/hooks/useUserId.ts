"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { getUserId } from "./userUtils";

export function useUserId() {
  const [userId, setUserId] = useState<number | null>(null);
  const [userUuid, setUserUuid] = useState<string | null>(null);

  const syncUser = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      setUserId(null);
      setUserUuid(null);
      return;
    }

    setUserUuid(session.user.id);

    const numericId = await getUserId();
    if (numericId) {
      setUserId(numericId);
    }
  }, []);

  useEffect(() => {
    syncUser();

    const supabase = getSupabaseBrowser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          setUserId(null);
          setUserUuid(null);
        } else {
          syncUser();
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [syncUser]);

  return { userId, userUuid, refresh: syncUser };
}