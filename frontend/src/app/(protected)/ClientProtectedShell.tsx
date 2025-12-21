// src/app/(protected)/ClientProtectedShell.tsx
"use client";

import type { ReactNode } from "react";

import Sidebar from "@/features/Toolbars/components/Sidebar";
import UserMenu from "@/features/auth/components/UserMenu";
import { SidebarProvider } from "@/features/Toolbars/hooks/useSidebar";
import HeaderToggle from "@/features/Toolbars/components/HeaderToggle";
import UserPrefsBootstrapper from "@/shared/bootstrap/userPrefsBootstrap";
import ToastHost from "@/shared/components/ui/Toast";
import ConfirmHost from "@/shared/components/ui/Confirm";

// dátové providery (globálne pre protected sekciu)
import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";
import { ActivityDataProvider } from "@/shared/components/dataProviders/ActivityDataProvider";
import { RecoveryDataProvider } from "@/shared/components/dataProviders/RecoveryDataProvider";

export default function ClientProtectedShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* bootstrap preferencií po prihlásení (client) */}
      <UserPrefsBootstrapper />

      {/* UI provider (no-op wrapper kvôli kompatibilite) */}
      <SidebarProvider>
        {/* dátové providery – stable defaults pre dashboard */}
        <CoachDataProvider>
          <ActivityDataProvider days={120}>
              <RecoveryDataProvider days={90}>
                <div className="min-h-dvh grid lg:grid-cols-[280px_1fr] bg-neutral-950 text-neutral-100">
                  {/* SIDEBAR (desktop aj off-canvas kontajner) */}
                  <Sidebar />

                  {/* CONTENT */}
                  <div className="min-h-dvh flex flex-col">
                    {/* TOPBAR */}
                    <header className="sticky top-0 z-30 h-14 border-b border-neutral-800 flex items-center justify-between px-3 lg:px-4 gap-3 bg-neutral-950/90 backdrop-blur [padding-top:env(safe-area-inset-top)]">
                      <div className="flex items-center gap-2">
                        <HeaderToggle />
                        <div className="font-semibold hidden sm:block">SelfRace</div>
                      </div>
                      <UserMenu />
                    </header>

                    <main className="flex-1 p-3 lg:p-4">{children}</main>
                  </div>
                </div>
              </RecoveryDataProvider>
          </ActivityDataProvider>
        </CoachDataProvider>
      </SidebarProvider>

      {/* Globálny toast/confirm pre protected sekciu */}
      <ToastHost />
      <ConfirmHost />
    </>
  );
}