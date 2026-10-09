// src/app/(protected)/ClientProtectedShell.tsx
"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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

import ProfileSetup from "@/app/shared/widgets/ProfileSetup";
import { useWidgetPrefs } from "@/app/shared/state/widgetPrefsStore";
import AppSplash from "@/app/shared/ui/components/AppSplash";
import PushNotificationPrompt from "@/app/shared/ui/components/PushNotificationPrompt";
import PwaInstallBanner from "@/app/shared/ui/components/PwaInstallBanner";
import AiUsageWarningBadge from "@/app/features/billing/components/AiUsageWarningBadge";
import { useUserId } from "@/app/shared/hooks/useUserId";
import TrainerViewBar from "@/app/features/trainer/components/TrainerViewBar";
import {
  AppHeaderOffsetProvider,
  PROTECTED_GLOBAL_HEADER_HEIGHT_PX,
} from "@/app/shared/ui/components/AppHeaderOffsetContext";

/** Je práve fokusnuté pole, pri ktorom môže byť otvorená klávesnica? */
function isEditableFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    // tieto typy klávesnicu neotvárajú
    return !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image", "hidden"].includes(type);
  }
  return false;
}

export default function ClientProtectedShell({
  children,
}: {
  children: ReactNode;
}) {
  const t = useT();
  // výzvy (onboarding, push, PWA) patria vlastnému účtu, nie prezeranému zverencovi
  const { ownUserId: userId, trainerView } = useUserId();
  const pathname = usePathname();
  // úvodný výber profilu (widgety) – kým nie je vybraný, ďalšie výzvy čakajú
  const { needsSetup, ready: widgetPrefsReady } = useWidgetPrefs(userId);
  // Kto práve prešiel úvodným výberom, nedostane hneď ďalší popup
  // (notifikácie, inštalácia) – tie prídu pri ďalšom štarte appky.
  const [setupShown, setSetupShown] = useState(false);
  useEffect(() => {
    if (needsSetup) setSetupShown(true);
  }, [needsSetup]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const setSidebarOpen = useSidebar((s) => s.setOpen);

  // Uzamknutý overflow na <html> — pozri predošlý fix (window-level scroll).
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevOverflow;
    };
  }, []);

  /**
   * Výška appky podľa visualViewport (kvôli klávesnici na iOS).
   *
   * 🔧 FIX "polovica obrazovky zelená": predtým sa --app-vh nastavovalo
   * VŽDY na visualViewport.height a spoliehali sme sa, že pri zatvorení
   * klávesnice príde ďalší resize event. Na iOS (hlavne v PWA) ten event
   * niekedy nepríde - klávesnica sa zavrie prechodom na inú stránku,
   * prepnutím appky alebo zamknutím telefónu. --app-vh potom ostalo na
   * výške s klávesnicou (~polovica) a spodok ukazoval len pozadie body,
   * kým sa appka nereštartovala.
   *
   * Teraz:
   *  1) zmenšenú výšku použijeme LEN keď je fokusnuté textové pole
   *     (bez fokusu klávesnica otvorená byť nemôže) - inak premennú
   *     zmažeme a platí fallback 100dvh,
   *  2) prepočítavame pri viacerých udalostiach, nie len pri jednom
   *     resize evente, ktorý iOS občas vynechá.
   */
  const syncAppVh = useCallback(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    if (vv && isEditableFocused()) {
      root.style.setProperty("--app-vh", `${vv.height}px`);
    } else {
      root.style.removeProperty("--app-vh");
    }
    // poistka: ak by OS niečo posunul na document úrovni, vráť to na 0
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    const timers: number[] = [];

    // Klávesnica sa animuje ~300 ms - prepočítame hneď aj po jej doanimovaní.
    const syncSoonAndLater = () => {
      syncAppVh();
      timers.push(window.setTimeout(syncAppVh, 350));
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") syncSoonAndLater();
    };

    syncAppVh();

    vv?.addEventListener("resize", syncAppVh);
    vv?.addEventListener("scroll", syncAppVh);
    window.addEventListener("resize", syncAppVh);
    window.addEventListener("orientationchange", syncSoonAndLater);
    window.addEventListener("pageshow", syncSoonAndLater);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("focusin", syncSoonAndLater);
    document.addEventListener("focusout", syncSoonAndLater);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      vv?.removeEventListener("resize", syncAppVh);
      vv?.removeEventListener("scroll", syncAppVh);
      window.removeEventListener("resize", syncAppVh);
      window.removeEventListener("orientationchange", syncSoonAndLater);
      window.removeEventListener("pageshow", syncSoonAndLater);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("focusin", syncSoonAndLater);
      document.removeEventListener("focusout", syncSoonAndLater);
    };
  }, [syncAppVh]);

  // Jemné prelínanie obsahu pri zmene stránky. Len opacity - transform by
  // z <main> spravil containing block a fixed hlavička (AppHeader) by počas
  // animácie skákala. Bez remountu stránky (žiadny key), len Web Animations.
  const mainRef = useRef<HTMLElement>(null);
  const firstPathRef = useRef(true);
  useEffect(() => {
    if (firstPathRef.current) {
      firstPathRef.current = false;
      return;
    }
    const el = mainRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
  }, [pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    window.scrollTo(0, 0);
    setSidebarOpen(false);
    // 🔧 prechod na inú stránku často zavrie klávesnicu bez resize eventu
    syncAppVh();
  }, [pathname, setSidebarOpen, syncAppVh]);

  return (
    <AppHeaderOffsetProvider value={PROTECTED_GLOBAL_HEADER_HEIGHT_PX}>
      <UserPrefsBootstrapper />
      <UserSettingsBootstrapper />

      {/* Úvodný splash - obsah sa pod ním už načítava */}
      <AppSplash />

      <SidebarProvider>
        <CoachDataProvider>
          <ActivityDataProvider days={120}>
            <RecoveryDataProvider days={90}>
              <PerformanceDataProvider days={90}>

                {userId && !trainerView && needsSetup ? <ProfileSetup userId={userId} /> : null}
                {userId && !trainerView && widgetPrefsReady && !needsSetup && !setupShown && (
                  <>
                    <PushNotificationPrompt userId={userId} />
                    <PwaInstallBanner userId={userId} />
                  </>
                )}

                <div
                  className="flex flex-col relative"
                  style={{
                    height: "var(--app-vh, 100dvh)",
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
                      {/* Živý tréner: počas prezerania zverenca je namiesto loga
                          pruh s jeho menom - režim musí byť stále na očiach. */}
                      {trainerView ? (
                        <TrainerViewBar view={trainerView} ownUserId={userId} />
                      ) : (
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-2 min-w-0 rounded-lg px-1 py-1 transition-colors"
                          style={{ color: appColors.textPrimary }}
                          aria-label={t("home.goTo")}
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
                      )}

                      <div className="flex items-center gap-2">
                        <LangSelector variant="editable" size="xs" />
                        <AiUsageWarningBadge />
                        <UserMenu />
                      </div>
                    </header>

                    <div className="flex-1 flex flex-col relative min-h-0">
                      {/* Stránka sa vykresľuje LEN RAZ. Predtým bol {children}
                          zvlášť v desktop a mobil kontajneri (jeden skrytý cez
                          CSS) - každý widget sa pripojil 2× a poslal 2 requesty. */}
                      <div className={["h-full min-h-0", SHELL_GRID].join(" ")}>
                        <div className="hidden lg:block min-h-0">
                          <Sidebar />
                        </div>
                        <div
                          ref={scrollRef}
                          id="app-scroll"
                          className="flex flex-col h-full min-h-0 overflow-y-auto overscroll-contain lg:overscroll-auto"
                        >
                          <main ref={mainRef} className="flex-1 p-3 pb-24 lg:p-4 lg:pb-4">
                            {children}
                          </main>
                          <div className="pb-28 lg:pb-0">
                            <AppFooter />
                          </div>
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
    </AppHeaderOffsetProvider>
  );
}
