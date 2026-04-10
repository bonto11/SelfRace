"use client";

import type { ReactNode } from "react";
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

              {/* OPRAVA 1: Z hlavného obalu sme dali preč overflow-hidden pre istotu kvôli fixed lište */}
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
                  <header
                    className="sticky top-0 z-30 h-14 flex items-center justify-between px-3 lg:px-4 gap-3 backdrop-blur"
                    style={{
                      background: appColors.backgroundAlt,
                      borderBottom: `1px solid ${appColors.divider}`,
                      paddingTop: "env(safe-area-inset-top)" as any,
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

                    {/* OPRAVA 2: Odstránené min-h-dvh z mobilného obalu, pridaný čistý flex-1 */}
                    <div className="lg:hidden flex-1 flex flex-col">
                      <main className="flex-1 p-3 pb-24">{children}</main>
                      <div className="pb-28">
                        <AppFooter />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* OPRAVA 3: Bottom Bar je úplne na root úrovni, mimo akéhokoľvek relative obalu */}
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
