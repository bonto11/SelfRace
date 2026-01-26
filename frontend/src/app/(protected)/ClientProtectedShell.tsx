// src/app/(protected)/ClientProtectedShell.tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

import Sidebar from "@/app/features/Toolbars/components/Sidebar";
import UserMenu from "@/app/features/auth/components/UserMenu";
import { SidebarProvider } from "@/app/features/Toolbars/hooks/useSidebar";
import MobileBottomBar from "@/app/features/Toolbars/components/MobileBottomBar";

import UserPrefsBootstrapper from "@/app/shared/bootstrap/userPrefsBootstrap";
import ToastHost from "@/app/shared/ui/components/Toast";
import ConfirmHost from "@/app/shared/ui/components/Confirm";

import { CoachDataProvider } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { ActivityDataProvider } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { RecoveryDataProvider } from "@/app/shared/components/dataProviders/RecoveryDataProvider";

import { appColors } from "@/app/shared/theme/app_colors";
import { SHELL_GRID } from "@/app/shared/ui/tokens";
import AppBackdrop from "@/app/shared/ui/components/AppBackdrop";

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
              <div
                className="min-h-dvh flex flex-col relative overflow-hidden"
                style={{
                  background: appColors.backgroundMain,
                  color: appColors.textPrimary,
                }}
              >
                {/* BACKDROP cez celý viewport */}
                <div className="fixed inset-0 z-0 pointer-events-none">
                  <AppBackdrop />
                </div>

                {/* obsah nad backdropom */}
                <div className="relative z-10 min-h-dvh flex flex-col">
                  {/* TOPBAR */}
                  <header
                    className="sticky top-0 z-30 h-14 flex items-center justify-between px-3 lg:px-4 gap-3 backdrop-blur"
                    style={{
                      background: appColors.backgroundAlt,
                      borderBottom: `1px solid ${appColors.divider}`,
                      paddingTop: "env(safe-area-inset-top)" as any,
                    }}
                  >
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 min-w-0 rounded-lg px-1 py-1 transition-colors"
                      style={{ color: appColors.textPrimary }}
                      aria-label="Go to dashboard"
                    >
                      <Image
                        src="/logo/Selfrace_noname.png"
                        alt="SelfRace"
                        width={120}
                        height={28}
                        priority
                        className="h-6 w-auto opacity-95"
                      />
                      <div className="font-semibold truncate">SelfRace</div>
                    </Link>

                    <UserMenu />
                  </header>

                  {/* CONTENT */}
                  <div className="flex-1">
                    {/* Desktop */}
                    <div
                      className={["hidden lg:grid h-full", SHELL_GRID].join(
                        " "
                      )}
                    >
                      <Sidebar />
                      <div className="min-h-dvh flex flex-col">
                        <main className="flex-1 p-3 lg:p-4 pb-4">
                          {children}
                        </main>
                      </div>
                    </div>

                    {/* Mobile */}
                    <div className="lg:hidden min-h-dvh flex flex-col">
                      <main className="flex-1 p-3 pb-20">{children}</main>
                    </div>
                  </div>

                  <MobileBottomBar />
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
