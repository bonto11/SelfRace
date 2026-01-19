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

import {
  SHELL_BG,
  TOPBAR_MOBILE,
  TOPBAR_DESKTOP,
  SHELL_GRID,
} from "@/app/shared/ui/uiTokens";

export default function ClientProtectedShell({ children }: { children: ReactNode }) {
  return (
    <>
      <UserPrefsBootstrapper />

      <SidebarProvider>
        <CoachDataProvider>
          <ActivityDataProvider days={120}>
            <RecoveryDataProvider days={90}>
              <div className={["min-h-dvh flex flex-col", SHELL_BG].join(" ")}>
                {/* TOPBAR – mobile+desktop (display triedy sú v tokenoch) */}
                <header
                  className={[
                    "z-30 h-14 flex items-center justify-between px-3 lg:px-4 gap-3",
                    "backdrop-blur [padding-top:env(safe-area-inset-top)]",
                    TOPBAR_MOBILE,
                    TOPBAR_DESKTOP,
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="font-semibold truncate">SelfRace</div>
                  </div>
                  <UserMenu />
                </header>

                <div className="flex-1">
                  {/* Desktop */}
                  <div className={["hidden lg:grid h-full", SHELL_GRID].join(" ")}>
                    <Sidebar />
                    <div className="min-h-dvh flex flex-col">
                      <main className="flex-1 p-3 lg:p-4 pb-4">{children}</main>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="lg:hidden min-h-dvh flex flex-col">
                    <main className="flex-1 p-3 pb-20">{children}</main>
                  </div>
                </div>

                <MobileBottomBar />
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