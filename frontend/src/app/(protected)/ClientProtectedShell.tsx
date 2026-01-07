// src/app/(protected)/ClientProtectedShell.tsx
"use client";

import type { ReactNode } from "react";

import Sidebar from "@/app/features/Toolbars/components/Sidebar";
import UserMenu from "@/app/features/auth/components/UserMenu";
import { SidebarProvider } from "@/app/features/Toolbars/hooks/useSidebar";
import MobileBottomBar from "@/app/features/Toolbars/components/MobileBottomBar";

import UserPrefsBootstrapper from "@/app/shared/bootstrap/userPrefsBootstrap";
import ToastHost from "@/app/shared/components/ui/Toast";
import ConfirmHost from "@/app/shared/components/ui/Confirm";

import { CoachDataProvider } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { ActivityDataProvider } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { RecoveryDataProvider } from "@/app/shared/components/dataProviders/RecoveryDataProvider";

export default function ClientProtectedShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {/* bootstrap preferencií po prihlásení (client) */}
      <UserPrefsBootstrapper />

      <SidebarProvider>
        <CoachDataProvider>
          <ActivityDataProvider days={120}>
            <RecoveryDataProvider days={90}>
              {/* ROOT – flex kolóna, hore topbar, dole bottom bar (len mobile) */}
              <div className="min-h-dvh flex flex-col bg-neutral-950 text-neutral-100">
                {/* TOPBAR – stále hore, sticky */}
                <header className="sticky top-0 z-30 h-14 border-b border-neutral-800 flex items-center justify-between px-3 lg:px-4 gap-3 bg-neutral-950/90 backdrop-blur [padding-top:env(safe-area-inset-top)]">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">SelfRace</div>
                  </div>
                  <UserMenu />
                </header>

                {/* LAYOUT OBSAHU */}
                <div className="flex-1">
                  {/* Desktop: sidebar + obsah v gride */}
                  <div className="hidden lg:grid lg:grid-cols-[280px_1fr] h-full">
                    <Sidebar />
                    <div className="min-h-dvh flex flex-col">
                      <main className="flex-1 p-3 lg:p-4 pb-4">
                        {children}
                      </main>
                    </div>
                  </div>

                  {/* Mobile: len obsah, bez sidebaru */}
                  <div className="lg:hidden min-h-dvh flex flex-col">
                    {/* padding dole kvôli bottom baru na mobile */}
                    <main className="flex-1 p-3 pb-20">
                      {children}
                    </main>
                  </div>
                </div>

                {/* spodná navigácia – len mobile */}
                <MobileBottomBar />
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