// src/app/(protected)/ClientProtectedShell.tsx
"use client";

import type { ReactNode } from "react";

import Sidebar from "@/app/features/Toolbars/components/Sidebar";
import UserMenu from "@/app/features/auth/components/UserMenu";
import { SidebarProvider } from "@/app/features/Toolbars/hooks/useSidebar";
import HeaderToggle from "@/app/features/Toolbars/components/HeaderToggle";
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
      <UserPrefsBootstrapper />

      <SidebarProvider>
        <CoachDataProvider>
          <ActivityDataProvider days={120}>
            <RecoveryDataProvider days={90}>
              {/* ROOT – už nie grid, ale flex-col */}
              <div className="min-h-dvh flex flex-col bg-neutral-950 text-neutral-100">
                {/* TOPBAR – úplne hore, mimo gridu so sidebarom */}
                <header className="sticky top-0 z-30 h-14 border-b border-neutral-800 flex items-center justify-between px-3 lg:px-4 gap-3 bg-neutral-950/90 backdrop-blur [padding-top:env(safe-area-inset-top)]">
                  <div className="flex items-center gap-2">
                    <HeaderToggle />
                    <div className="font-semibold hidden sm:block">
                      SelfRace
                    </div>
                  </div>
                  <UserMenu />
                </header>

                {/* GRID so sidebarom + obsahom, scrolluje sa len toto */}
                <div className="flex-1 grid lg:grid-cols-[280px_1fr]">
                  <Sidebar />

                  <div className="min-h-dvh flex flex-col">
                    <main className="flex-1 p-3 lg:p-4">{children}</main>
                  </div>
                </div>
              </div>
            </RecoveryDataProvider>
          </ActivityDataProvider>
        </CoachDataProvider>
      </SidebarProvider>

      <ToastHost />
      <ConfirmHost />
    </>
  );
}