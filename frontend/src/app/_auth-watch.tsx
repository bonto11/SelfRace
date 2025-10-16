// src/app/_auth-watch.tsx
'use client';

import { useEffect } from 'react';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/shared/utils/supabaseBrowser';

export default function AuthWatch() {
  useEffect(() => {
    const supabase: SupabaseClient = getSupabaseBrowser();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        // tu vieš spraviť UX reakciu
        // napr. ak sa access token neobnovil a user odpadol:
        if (event === 'SIGNED_OUT') {
          // TODO: toast('Boli ste odhlásený'); prípadne router.push('/signin')
          // (nechávam na teba)
        }
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return null;
}
