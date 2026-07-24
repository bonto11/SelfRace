// src/app/(protected)/ClientProtectedShell.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
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

/* ============================================================ */
/* HEADER HEALTH CHECK - obchadzkove riesenie: po kazdej zmene   */
/* stranky (nezavisle OD SPOSOBU navigacie - Sidebar, bottom bar, */
/* Link, router.push kdekolvek v appke) skontroluje, ci je header */
/* realne viditelny v DOM. Ak nie je (poskodeny React strom kvoli */
/* neosetrenej chybe niekde vo vnutri stranky), spravi TVRDY      */
/* RELOAD - jediny sposob, ktory garantovane obnovi cisty stav,   */
/* keдze plny browser reload vytvori uplne novy React strom.      */
/* Poistka proti nekonecnemu loopu: max 1 auto-reload za 3s.      */
/* ============================================================ */
function useHeaderHealthCheck() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      const headerEl = document.querySelector("[data-app-header]");
      const isVisible =
        !!headerEl &&
        (headerEl as HTMLElement).offsetHeight > 0 &&
        window.getComputedStyle(headerEl as HTMLElement).display !== "none" &&
        window.getComputedStyle(headerEl as HTMLElement).visibility !== "hidden";

      if (!isVisible) {
        const guardKey = "header_reload_guard";
        const lastReload = sessionStorage.getItem(guardKey);
        const now = Date.now();

        if (lastReload && now - Number(lastReload) < 3000) {
          console.error(
            "[HeaderHealthCheck] Header stale chyba aj po reloade - nerobim dalsi pokus (ochrana proti loopu).",
          );
          return;
        }

        sessionStorage.setItem(guardKey, String(now));
        console.error(
          "[HeaderHealthCheck] Header nie je viditelny po navigacii - robim tvrdy reload.",
        );
        window.location.reload();
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [pathname]);
}

export default function ClientProtectedShell({
  children,
}: {
  children: ReactNode;
}) {
  const t = useT();
  const { userId } = useUserId();

  useHeaderHealthCheck();

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

                {/* 🌟 SCROLL-LOCK FIX (iOS PWA): tento wrapper je LOKÁLNY pre chránenú
                    časť appky (nemení globálny html/body v globals.css/layout.tsx,
                    ktoré ostávajú nedotknuté pre verejné stránky mimo (protected)).
                    height: 100dvh + overflow: hidden tu znamená, že TENTO div sa
                    sám nikdy nescrolluje - scroll prebieha výhradne vo vnútornom
                    <main> nižšie (overflow-y: auto). Keďže telo stránky (body/html)
                    sa vôbec nehýbe, iOS WebKit nemá príležitosť "odlepiť" fixed
                    MobileBottomBar od viewportu pri scrollovaní (známy, dlho
                    neopravený bug v iOS PWA standalone mode s position:fixed). */}
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
                        {/* Scrollovateľná oblasť (desktop): len tento div má overflow-y:auto */}
                        <div className="flex flex-col h-full min-h-0 overflow-y-auto">
                          <main className="flex-1 p-3 lg:p-4 pb-4">
                            <ErrorBoundary>{children}</ErrorBoundary>
                          </main>
                          <AppFooter />
                        </div>
                      </div>

                      {/* Scrollovateľná oblasť (mobile): jediné miesto kde sa reálne
                          scrolluje - MobileBottomBar (portál do body, fixed) je mimo
                          tohto stromu úplne, takže sa s ním scroll tu nijako nekríži. */}
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
                </div>

                {/* Bottom Bar je úplne na root úrovni (cez portál do document.body,
                    viď MobileBottomBar.tsx), mimo akéhokoľvek scrollovateľného
                    alebo transformovaného obalu. */}
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
