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
import UserSettingsBootstrapper from "@/app/shared/i18n/UserSettingsBootstrapper";

import ToastHost from "@/app/shared/ui/components/Toast";
import ConfirmHost from "@/app/shared/ui/components/Confirm";
import ErrorBoundary from "@/app/shared/ui/components/ErrorBoundary";

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

// Vyska headeru - pouzita aj na padding-top scrollovatelnych oblasti,
// aby obsah nezacinal POD fixed headerom.
const HEADER_HEIGHT_PX = 56; // zodpoveda h-14 (14 * 4px = 56px)

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

                {/* 🌟 PEVNY LAYOUT: Header je teraz position:fixed, UPLNE ODPOJENY
                    od flex/scroll stromu ktory obsahuje {children}. Presne tak,
                    ako uz bol MobileBottomBar (portal do document.body, fixed) -
                    ten NIKDY nezmizol, aj ked header ano. Dovod: ak nieco vo
                    vnutri {children} sposobi neocakavany layout/overflow/scroll
                    chaos (aj bez JS chyby, cisto CSS), fixed elementy VZDY
                    zostavaju viditelne relativne k VIEWPORTU, nezavisle od
                    akehokolvek chaosu v rodicovskom/súrodeneckom flex kontexte.
                    Cena: kazda page potrebuje padding-top rovny vyske headeru,
                    aby obsah nezacinal schovany pod nim. */}

                <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                  <AppBackdrop />
                </div>

                {/* FIXNY HEADER - vzdy navrchu, nezavisle od scroll/layout stavu stranky */}
                <header
                  className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-3 lg:px-4 gap-3 backdrop-blur"
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

                {/* Obsah pod fixnym headerom - vlastny scroll kontext, padding-top
                    kompenzuje vysku headeru (+ safe area), aby nic nezacinalo
                    schovane pod nim. */}
                <div
                  className="relative z-10"
                  style={{
                    paddingTop: `calc(${HEADER_HEIGHT_PX}px + env(safe-area-inset-top))`,
                    height: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    color: appColors.textPrimary,
                  }}
                >
                  <div className="flex-1 flex flex-col relative min-h-0">
                    <div
                      className={["hidden lg:grid h-full min-h-0", SHELL_GRID].join(" ")}
                    >
                      <Sidebar />
                      {/* Scrollovateľná oblasť (desktop) */}
                      <div className="flex flex-col h-full min-h-0 overflow-y-auto">
                        <main className="flex-1 p-3 lg:p-4 pb-4">
                          <ErrorBoundary>{children}</ErrorBoundary>
                        </main>
                        <AppFooter />
                      </div>
                    </div>

                    {/* Scrollovateľná oblasť (mobile) - MobileBottomBar (fixed,
                        portál do body) je mimo tohto stromu, nekríži sa so
                        scrollom tu. */}
                    <div className="lg:hidden flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain">
                      <main className="flex-1 p-3 pb-24">
                        <ErrorBoundary>{children}</ErrorBoundary>
                      </main>
                      <div className="pb-28">
                        <AppFooter />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar - uz bol fixed/portal, ziadna zmena */}
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
