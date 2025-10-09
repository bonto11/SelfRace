// src/features/auth/components/AuthSync.tsx
'use client';
import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/shared/utils/supabaseBrowser';

export default function AuthSync() {
  // posledný access_token, ktorý sme už poslali – aby sme neposielali duplicitne
  const lastSentToken = useRef<string | null>(null);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    console.log('[AuthSync] mount');

    // helper na bezpečné poslanie session na server
    const pushSession = async (event: 'INITIAL_SESSION' | 'SIGNED_IN' | 'TOKEN_REFRESHED') => {
      const { data } = await sb.auth.getSession();
      const s = data.session;
      const at = s?.access_token;
      const rt = s?.refresh_token;

      console.log(`[AuthSync] event: ${event} has tokens?`, !!at, !!rt);

      if (at && rt) {
        // vyhni sa duplicitám s rovnakým tokenom
        if (lastSentToken.current === at) return;
        lastSentToken.current = at;

        await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // pri rovnakom hoste netreba, ale je to neškodné:
          credentials: 'include',
          body: JSON.stringify({ event, session: s }),
        });
      }
    };

    // 1) úvodný sync (ak máme session v LS)
    sb.auth.getSession().then(({ data }) => {
      console.log('[AuthSync] initial session?', !!data.session);
      if (data.session?.access_token && data.session?.refresh_token) {
        // po SSR prerenderi to berme ako INITIAL_SESSION
        pushSession('INITIAL_SESSION');
      }
    });

    // 2) live zmeny
    const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
      console.log(
        '[AuthSync] event:',
        event,
        'has tokens?',
        !!session?.access_token,
        !!session?.refresh_token
      );

      if (event === 'SIGNED_IN') {
        await pushSession('SIGNED_IN');
      } else if (event === 'TOKEN_REFRESHED') {
        await pushSession('TOKEN_REFRESHED');
      } else if (event === 'SIGNED_OUT') {
        lastSentToken.current = null; // reset
        await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ event: 'SIGNED_OUT' }),
        });
      }
    });

    return () => {
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  return null;
}
