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

        {/* 🌐 Detekuje in-app browser (Instagram/Messenger/FB/...) a ponúkne
            otvorenie v systémovom prehliadači — na Androide priamy redirect,
            na iOS krátky návod */}
        <InAppBrowserBanner />

        <SettingsProvider>
          <TooltipProvider>
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
