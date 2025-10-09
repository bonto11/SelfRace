'use client';
import { ReactNode, useState } from 'react';
import Sidebar from '@/features/Toolbars/components/Sidebar';
import UserMenu from '@/features/auth/components/UserMenu';
import AuthSync from '@/features/auth/components/AuthSync';

type UserInfo = { email: string; name: string; avatarUrl: string | null };

export default function ClientShell({
  children,
  user,
}: { children: ReactNode; user: UserInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      {/* topbar – mobile */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 bg-neutral-950/90 backdrop-blur px-3 py-2 border-b border-neutral-800">
        <button
          onClick={() => setOpen(v => !v)}
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

      {/* layout grid */}
      <div className="grid lg:grid-cols-[280px_1fr]">
        {/* desktop sidebar */}
        <aside className="hidden lg:block border-r border-neutral-800 sticky top-0 h-dvh">
          <Sidebar />
        </aside>

        {/* content */}
        <section className="min-h-dvh flex flex-col">
          {/* desktop topbar */}
          <header className="hidden lg:flex h-14 items-center justify-between px-4 border-b border-neutral-800 bg-neutral-950">
            <div className="font-semibold">Trainalyze</div>
            <UserMenu user={user} />
            <AuthSync />
          </header>

          <main className="flex-1">
            <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4">
              {children}
            </div>
          </main>
        </section>
      </div>

      {/* mobile off-canvas + overlay */}
      {/* overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}
      {/* drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-neutral-900 border-r border-neutral-800 shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={() => setOpen(false)} // zatvor po kliku
      >
        <Sidebar />
      </div>

      {/* AuthSync nech beží aj na mobile */}
      <AuthSync />
    </div>
  );
}
