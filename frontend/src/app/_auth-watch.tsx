'use client';
import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/shared/utils/supabaseBrowser';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function AuthWatch() {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        // optional: toast on token refresh or sign-out
        if (event === 'TOKEN_REFRESHED') console.log('[Auth] token refreshed');
        if (event === 'SIGNED_OUT') console.log('[Auth] signed out');
      }
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
