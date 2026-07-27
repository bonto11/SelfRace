// src/app/(protected)/ClientProtectedShell.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import Sidebar from "@/app/features/Toolbars/components/Sidebar";
import UserMenu from "@/app/features/auth/components/UserMenu";
import { SidebarProvider, useSidebar } from "@/app/features/Toolbars/hooks/useSidebar";
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
  const pathname = usePathname();

  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  const setSidebarOpen = useSidebar((s) => s.setOpen);

  // 🔧 ROOT FIX: <html>/<body> nemajú vlastný overflow:hidden — len jeden
  // vnútorný div ho má (cez inline style nižšie). Ich min-height:100dvh
  // dovolí obsahu vyrásť nad výšku viewportu (napr. pri fokuse na input /
  // natívny picker), čím sa CELÝ DOKUMENT stane scrollovateľný. Keď sa to
  // raz stane, appka to nikdy nerestne (reset sa doteraz robil len na
  // #app-scroll-mobile / #app-scroll-desktop, nikdy na window), takže to
  // zostane "zaseknuté" presne o výšku headeru, kým nenavigueš preč
  // (Next.js reset) alebo nespravíš hard refresh.
  //
  // Potvrdené priamo nameraním: window.scrollY = 56 (presne výška headeru),
  // pričom oba named scroll containery boli na 0.
  //
  // Fix: kým je tento shell zmountovaný (čiže si prihlásený), <html> je
  // explicitne uzamknuté na overflow:hidden — scroll smie ísť LEN cez
  // #app-scroll-mobile / #app-scroll-desktop, tak ako to appka aj zamýšľa.
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    desktopScrollRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    mobileScrollRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    // Poistka navyše: aj keby sa okno napriek hornému fixu niekedy posunulo,
    // pri každej zmene routy sa vynúti späť na 0.
    window.scrollTo(0, 0);
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

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
                  className="flex flex-col relative"
                  style={{
                    height: "100dvh",
                    overflow: "hidden",
                    background: appColors.backgroundMain,
                    color: appColors.textPrimary,
                  }}
                >
                  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                    <AppBackdrop />
                  </div>

                  <div className="relative z-10 flex flex-col h-full">
                    <header
                      data-app-header
                      className="shrink-0 z-30 h-14 flex items-center justify-between px-3 lg:px-4 gap-3 backdrop-blur"
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

                    <div className="flex-1 flex flex-col relative min-h-0">
                      <div
                        className={["hidden lg:grid h-full min-h-0", SHELL_GRID].join(" ")}
                      >
                        <Sidebar />
                        <div
                          ref={desktopScrollRef}
                          id="app-scroll-desktop"
                          className="flex flex-col h-full min-h-0 overflow-y-auto"
                        >
                          <main className="flex-1 p-3 lg:p-4 pb-4">
                            {children}
                          </main>
                          <AppFooter />
                        </div>
                      </div>

                      <div
                        ref={mobileScrollRef}
                        id="app-scroll-mobile"
                        className="lg:hidden flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
                      >
                        <main className="flex-1 p-3 pb-24">
                          {children}
                        </main>
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