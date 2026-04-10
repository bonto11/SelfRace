// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import AppFooter from "@/app/shared/ui/components/AppFooter";
import { SettingsProvider } from "@/app/shared/i18n/SettingsProvider";
import { TooltipProvider } from "@/app/shared/ui/components/Tooltip";
import SessionGuard from "@/app/shared/ui/components/SessionGuard";
// 👇 IMPORTUJEME FUNKCIU NA ČÍTANIE COOKIES
import { cookies } from "next/headers"; 

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
  // 👇 SKONTROLUJEME, ČI SME V ADMIN BYPASS REŽIME
  const cookieStore = cookies();
  const isMaintenanceBypass = cookieStore.get("admin_maintenance_bypass")?.value === "true";

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

        {/* 🚧 VÝSTRAŽNÝ ŽLTÝ PRUH PRE ADMINA V MAINTENANCE REŽIME 🚧 */}
        {isMaintenanceBypass && (
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 9999,
              backgroundColor: "#eab308", // Výrazná žltá
              color: "#000", // Čierny text
              textAlign: "center",
              padding: "8px",
              fontWeight: 900,
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.5)",
            }}
          >
            🚧 SYSTEM IS IN MAINTENANCE MODE - ADMIN BYPASS ACTIVE 🚧
          </div>
        )}

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
