'use client';

import { ReactNode } from 'react';
import Sidebar from '@/features/Toolbars/components/Sidebar';
import UserMenu from '@/features/auth/components/UserMenu';
import AuthSync from '@/features/auth/components/AuthSync';
import { SidebarProvider, useSidebar } from '@/features/Toolbars/hooks/useSidebar';

type UserInfo = { email: string; name: string; avatarUrl: string | null };

function ShellBody({ children, user }: { children: ReactNode; user: UserInfo }) {
  const { open, toggle, setOpen } = useSidebar();

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      {/* TOPBAR (mobile) */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 bg-neutral-950/90 backdrop-blur px-3 py-2 border-b border-neutral-800">
        <button
          onClick={toggle}
          aria-label="Menu"
          className="rounded-lg p-2 border border-neutral-700 hover:bg-neutral-800"
        >
          ☰
        </button>
        <div className="font-semibold">Trainalyze</div>
        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr]">
        {/* SIDEBAR (desktop) */}
        <aside className="hidden lg:block border-r border-neutral-800 sticky top-0 h-dvh">
          <Sidebar />
        </aside>

        {/* CONTENT */}
        <section className="min-h-dvh flex flex-col">
          {/* TOPBAR (desktop) */}
          <header className="hidden lg:flex h-14 items-center justify-between px-4 border-b border-neutral-800 bg-neutral-950">
            <div className="font-semibold">Trainalyze</div>
            <UserMenu user={user} />
            <AuthSync />
          </header>

          <main className="flex-1">{children}</main>
        </section>
      </div>

      {/* Overlay (mobile) */}
      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />}

      {/* Off-canvas sidebar (mobile) */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-neutral-900 border-r border-neutral-800 shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>

      <AuthSync />
    </div>
  );
}

export default function ClientShell({ children, user }: { children: ReactNode; user: UserInfo }) {
  return (
    <SidebarProvider>
      <ShellBody user={user}>{children}</ShellBody>
    </SidebarProvider>
  );
}
