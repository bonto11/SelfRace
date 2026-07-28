// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import AppFooter from "@/app/shared/ui/components/AppFooter";
import { SettingsProvider } from "@/app/shared/i18n/SettingsProvider";
import { TooltipProvider } from "@/app/shared/ui/components/Tooltip";
import SessionGuard from "@/app/shared/ui/components/SessionGuard";
import InAppBrowserBanner from "@/app/shared/ui/components/InAppBrowserBanner";

export const metadata: Metadata = {
  title: "SelfRace",
  description: "Training and recovery insights with help of AI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SelfRace",
    startupImage: "/logo/actual/selfrace_icon.svg",
  },
  icons: {
    apple: "/logo/actual/selfrace_icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: appColors.backgroundMain,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // 🌟 FIX (Android/Chrome only — Safari/WebKit toto nemá implementované
  // vôbec, viď https://bugs.webkit.org/show_bug.cgi?id=259770): pri
  // otvorení klávesnice zmenší layout (100dvh) namiesto posúvania
  // viewportu. Pre iOS rieši rovnaký problém JS fix vo
  // ClientProtectedShell.tsx (window.visualViewport + --app-vh),
  // ten dvaja dokopy pokrývajú obe platformy.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      style={{
        background: appColors.backgroundMain,
        color: appColors.textPrimary,
      }}
    >
      <body
        style={{
          minHeight: "100dvh",
          background: appColors.backgroundMain,
          color: appColors.textPrimary,
        }}
      >
        {/* 🛡️ SessionGuard beží na pozadí a počúva na signál k odhláseniu */}
        <SessionGuard />

        <SettingsProvider>
          <TooltipProvider>
            {/* 🌐 Detekuje in-app browser (Instagram/Messenger/FB/...) a ponúkne
                otvorenie v systémovom prehliadači — na Androide priamy redirect,
                na iOS krátky návod. Musí byť POD SettingsProvider, keďže používa useT(). */}
            <InAppBrowserBanner />

            <div
              style={{
                minHeight: "100dvh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
              <AppFooter />
            </div>
          </TooltipProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
