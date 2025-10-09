// src/features/auth/components/AuthSync.tsx
'use client';
import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/shared/utils/supabaseBrowser';

export default function AuthSync() {
  useEffect(() => {
    const sb = getSupabaseBrowser();

    // úvodný sync – len ak máme refresh_token
    console.log("[AuthSync] mount");
    sb.auth.getSession().then(({ data }) => {
      console.log("[AuthSync] initial session?", !!data.session);
      const s = data.session;
      if (s?.access_token && s?.refresh_token) {
        console.log('SIGNED_IN session' + s)
        fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_IN', session: s }),
        });
      }
    });

    // live zmeny – SIGNED_IN / SIGNED_OUT
    const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthSync] event:", event, "has tokens?", !!session?.access_token, !!session?.refresh_token);
    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event, session }),
      });
    } else if (event === "SIGNED_OUT") {
      await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event }),
      });
    }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}