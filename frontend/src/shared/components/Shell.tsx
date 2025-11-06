// src/app/_components/Shell.tsx
"use client";

import { ReactNode } from "react";
import { useSidebar, SidebarProvider } from "@/features/Toolbars/hooks/useSidebar";
import Sidebar from "@/features/Toolbars/components/Sidebar";
import MobileTopbar from "@/features/Toolbars/components/MobileTopbar";
import {
  SHELL_BG,
  SHELL_GRID,
  SIDEBAR_DESKTOP,
  SIDEBAR_MOBILE_PANEL,
  CONTENT_CONTAINER,
} from "@/shared/ui/classes";

function Frame({ children }: { children: ReactNode }) {
  const { open } = useSidebar();

  return (
    <div className={SHELL_BG}>
      <MobileTopbar />

      <div className={`${SHELL_GRID} gap-0`}>
        {/* desktop sidebar */}
        <aside className={SIDEBAR_DESKTOP}>
          <Sidebar />
        </aside>

        {/* main content */}
        <main className="min-h-dvh">
          <div className={CONTENT_CONTAINER}>{children}</div>
        </main>
      </div>

      {/* mobile off-canvas slot */}
      <div className={`${SIDEBAR_MOBILE_PANEL} ${open ? "translate-x-0" : "-translate-x-full"}`}>
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