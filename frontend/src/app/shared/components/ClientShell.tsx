"use client";

import { ReactNode } from "react";
import Sidebar from "@/app/features/Toolbars/components/Sidebar";
import UserMenu from "@/app/features/auth/components/UserMenu";
import {
  SidebarProvider,
  useSidebar,
} from "@/app/features/Toolbars/hooks/useSidebar";
import {
  SHELL_BG,
  TOPBAR_MOBILE,
  ICON_BUTTON,
  BRAND_TEXT,
  SHELL_GRID,
  SIDEBAR_DESKTOP,
  TOPBAR_DESKTOP,
  SIDEBAR_OVERLAY,
  SIDEBAR_MOBILE_PANEL,
} from "@/app/shared/theme/uiTokens";

function ShellBody({ children }: { children: ReactNode }) {
  const { open, toggle, setOpen } = useSidebar();

  return (
    <div className={SHELL_BG}>
      {/* TOPBAR (mobile) */}
      <div className={TOPBAR_MOBILE}>
        <button onClick={toggle} aria-label="Menu" className={ICON_BUTTON}>
          ☰
        </button>
        <div className={BRAND_TEXT}>Trainalyze</div>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>

      <div className={SHELL_GRID}>
        {/* SIDEBAR (desktop) */}
        <aside className={SIDEBAR_DESKTOP}>
          <Sidebar />
        </aside>

        {/* CONTENT */}
        <section className="min-h-dvh flex flex-col">
          {/* TOPBAR (desktop) */}
          <header className={TOPBAR_DESKTOP}>
            <div className={BRAND_TEXT}>SelfRace</div>
            <UserMenu />
          </header>

          <main className="flex-1">{children}</main>
        </section>
      </div>

      {/* Overlay (mobile) */}
      {open && (
        <div className={SIDEBAR_OVERLAY} onClick={() => setOpen(false)} />
      )}

      {/* Off-canvas sidebar (mobile) */}
      <div
        className={`${SIDEBAR_MOBILE_PANEL} ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar />
      </div>
    </div>
  );
}

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ShellBody>{children}</ShellBody>
    </SidebarProvider>
  );
}
