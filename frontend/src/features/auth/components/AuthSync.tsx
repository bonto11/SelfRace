// src/features/auth/components/AuthSync.tsx
"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

/** Mounted klienták, ktorý syncuje auth eventy -> /api/set-session */
export default function AuthSync() {
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    const sb = getSupabaseBrowser();

    const listener = sb.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        try {
          await fetch("/api/auth/set-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, session }),
          });
        } catch {
          // ticho ignorujeme (UI sa aj tak rehydratuje)
        }
      }
    );

    return () => listener.data.subscription.unsubscribe();
  }, []);

  return null;
}