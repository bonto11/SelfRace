"use client";

// 👇 1. PRIDALI SME useState a useEffect
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

import Sidebar from "@/app/features/Toolbars/components/Sidebar";
import UserMenu from "@/app/features/auth/components/UserMenu";
import { SidebarProvider } from "@/app/features/Toolbars/hooks/useSidebar";
import MobileBottomBar from "@/app/features/Toolbars/components/MobileBottomBar";

import UserPrefsBootstrapper from "@/app/shared/bootstrap/userPrefsBootstrap";
import UserSettingsBootstrapper from "@/app/shared/i18n/UserSettingsBootstrapper";

import ToastHost from "@/app/shared/ui/components/Toast";
import ConfirmHost from "@/app/shared/ui/components/Confirm";

import { CoachDataProvider } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { ActivityDataProvider } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { RecoveryDataProvider } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import { PerformanceDataProvider } from "@/app/shared/components/dataProviders/PerformanceDataProvider";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SHELL_GRID } from "@/app/shared/ui/tokens";
import AppBackdrop from "@/app/shared/ui/components/AppBackdrop";
import AppFooter from "@/app/shared/ui/components/AppFooter";
import LangSelector from "@/app/shared/i18n/LangSelector";
import { useT } from "@/app/shared/i18n/useT";

import OnboardingWizard from "@/app/shared/ui/components/OnboardingWizard";
import PushNotificationPrompt from "@/app/shared/ui/components/PushNotificationPrompt";
import PwaInstallBanner from "@/app/shared/ui/components/PwaInstallBanner";

import { useUserId } from "@/app/shared/hooks/useUserId";

export default function ClientProtectedShell({
  children,
}: {
  children: ReactNode;
}) {
  const t = useT();
  const { userId } = useUserId();

  // 👇 2. LOGIKA NA ZISTENIE ADMIN BYPASSU Z COOKIES PREHLIADAČA
  const [isBypass, setIsBypass] = useState(false);
  useEffect(() => {
    // Ak sa v prehliadači nachádza naša tajná cookie z middlewaru, zapneme pruh
    if (document.cookie.includes("admin_maintenance_bypass=true")) {
      setIsBypass(true);
    }
  }, []);

  return (
    <>
      <UserPrefsBootstrapper />
      <UserSettingsBootstrapper />

      <SidebarProvider>
        <CoachDataProvider>
          <ActivityDataProvider days={120}>
            <RecoveryDataProvider days={90}>
              <PerformanceDataProvider days={90}>
              
              {userId && (
                <>
                  <OnboardingWizard userId={userId} />
                  <PushNotificationPrompt userId={userId} />
                  <PwaInstallBanner userId={userId} />
                </>
              )}

              <div
                className="min-h-dvh flex flex-col relative"
                style={{
                  background: appColors.backgroundMain,
                  color: appColors.textPrimary,
                }}
              >
                <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                  <AppBackdrop />
                </div>

                <div className="relative z-10 flex flex-col min-h-dvh">
                  
                  {/* 👇 3. VÝSTRAŽNÝ ŽLTÝ PRUH PRE ADMINA 🚧 */}
                  {isBypass && (
                    <div 
                      className="w-full bg-yellow-500 text-black text-center px-2 py-1.5 flex justify-center items-center gap-2 z-50 shadow-md"
                      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
                    >
                      <span className="animate-pulse text-[10px] md:text-sm">🚧</span>
                      <span className="text-[9px] md:text-xs font-black uppercase tracking-widest truncate">
                        System is in Maintenance Mode - Admin Bypass Active
                      </span>
                      <span className="animate-pulse text-[10px] md:text-sm">🚧</span>
                    </div>
                  )}

                  <header
                    className="sticky top-0 z-30 h-14 flex items-center justify-between px-3 lg:px-4 gap-3 backdrop-blur"
                    style={{
                      background: appColors.backgroundAlt,
                      borderBottom: `1px solid ${appColors.divider}`,
                      // Ak je zapnutý pruh, odstránime safe-area padding z hlavičky, lebo ho už má pruh
                      paddingTop: isBypass ? "0" : ("env(safe-area-inset-top)" as any),
                    }}
                  >
                    <Link
                      href="/activities"
                      className="flex items-center gap-2 min-w-0 rounded-lg px-1 py-1 transition-colors"
                      style={{ color: appColors.textPrimary }}
                      aria-label={t("activities.goTo")}
                    >
                      <Image
                        src="/logo/actual/selfrace_logo.svg"
                        alt="SelfRace"
                        width={135}
                        height={35}
                        priority
                        className="h-6 w-auto opacity-95"
                      />
                    </Link>

                    <div className="flex items-center gap-2">
                      <LangSelector variant="editable" size="xs" />
                      <UserMenu />
                    </div>
                  </header>

                  <div className="flex-1 flex flex-col relative">
                    <div
                      className={["hidden lg:grid h-full", SHELL_GRID].join(" ")}
                    >
                      <Sidebar />
                      <div className="min-h-dvh flex flex-col">
                        <main className="flex-1 p-3 lg:p-4 pb-4">
                          {children}
                        </main>
                        <AppFooter />
                      </div>
                    </div>

                    <div className="lg:hidden flex-1 flex flex-col">
                      <main className="flex-1 p-3 pb-24">{children}</main>
                      <div className="pb-28">
                        <AppFooter />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <MobileBottomBar />

              </PerformanceDataProvider>
            </RecoveryDataProvider>
          </ActivityDataProvider>
        </CoachDataProvider>
      </SidebarProvider>

      <ToastHost />
      <ConfirmHost />
    </>
  );
}
