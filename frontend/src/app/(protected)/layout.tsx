// src/app/(protected)/layout.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/features/Toolbars/components/Sidebar';
import UserMenu from '@/features/auth/components/UserMenu';
import InfoMessageHost from '@/shared/components/InfoMessageHost';
import { SidebarProvider } from '@/features/Toolbars/hooks/useSidebar';
import HeaderToggle from '@/features/Toolbars/components/HeaderToggle';
import AuthWatch from '@/app/_auth-watch';
import { getSupabaseBrowser } from '@/shared/utils/supabaseBrowser';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userInfo, setUserInfo] = useState<{email:string; name:string; avatarUrl:string|null}>({
    email: '', name: '', avatarUrl: null,
  });

  useEffect(() => {
    const sb = getSupabaseBrowser();

    // 1) read current session (sessionStorage, survives refresh in this tab)
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        router.replace('/signin');         // no session → go to signin
        return;
      }
      const md: any = u.user_metadata || {};
      setUserInfo({
        email: u.email ?? '',
        name: md.full_name || md.name || '',
        avatarUrl: md.avatar_url || md.picture || null,
      });
      setReady(true);
    });

    // 2) react to future sign-outs
    const { data: sub } = sb.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') router.replace('/signin');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!ready) {
    // small skeleton while we read session from sessionStorage
    return (
      <div className="min-h-dvh grid place-items-center bg-neutral-950 text-neutral-100">
        <div className="animate-pulse text-sm opacity-70">Loading…</div>
      </div>
    );
  }

  return (
    <>
      <AuthWatch />
      <InfoMessageHost>
        <SidebarProvider>
          <div className="min-h-dvh grid lg:grid-cols-[280px_1fr] bg-neutral-950 text-neutral-100">
            <Sidebar />
            <div className="min-h-dvh flex flex-col">
              <header className="sticky top-0 z-30 h-14 border-b border-neutral-800 flex items-center justify-between px-3 lg:px-4 gap-3 bg-neutral-950/90 backdrop-blur [padding-top:env(safe-area-inset-top)]">
                <div className="flex items-center gap-2">
                  <HeaderToggle />
                  <div className="font-semibold hidden sm:block">SelfRace</div>
                </div>
                <UserMenu user={userInfo} />
              </header>
              <main className="flex-1 p-3 lg:p-4">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </InfoMessageHost>
    </>
  );
}
