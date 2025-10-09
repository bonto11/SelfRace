'use client';
import { ReactNode } from 'react';
import { useSidebar, SidebarProvider } from '@/features/Toolbars/hooks/useSidebar';

import Sidebar from '../../features/Toolbars/components/Sidebar';
import MobileTopbar from '../../features/Toolbars/components/MobileTopbar';

function Frame({ children }: { children: ReactNode }) {
  const { open } = useSidebar();

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <MobileTopbar />

      <div
        className="
          grid lg:grid-cols-[280px_1fr] gap-0
        "
      >
        {/* desktop sidebar */}
        <div className="hidden lg:block border-r border-neutral-800 sticky top-0 h-dvh">
          <Sidebar />
        </div>

        {/* main content */}
        <main className="min-h-dvh">
          <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4">
            {children}
          </div>
        </main>
      </div>

      {/* mobile off-canvas slot */}
      <div
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-200
          w-[280px] bg-neutral-900 shadow-xl
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar />
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Frame>{children}</Frame>
    </SidebarProvider>
  );
}
