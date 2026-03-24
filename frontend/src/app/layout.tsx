// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import AppFooter from "@/app/shared/ui/components/AppFooter";
import { SettingsProvider } from "@/app/shared/i18n/SettingsProvider";
import { TooltipProvider } from "@/app/shared/ui/components/Tooltip";

if (typeof window !== "undefined") {
  const originalRemove = window.localStorage.removeItem;
  window.localStorage.removeItem = function (key) {
    if (key.includes("selfrace")) {
      console.error(`🚨 CHYTIL SOM HO! Niekto práve zmazal: ${key}`);
      console.trace(); // TOTO TI V KONZOLE UKÁŽE PRESNÝ SÚBOR A RIADOK!
    }
    originalRemove.apply(this, arguments as any);
  };

  const originalClear = window.localStorage.clear;
  window.localStorage.clear = function () {
    console.error("🚨 CHYTIL SOM HO! Niekto práve zmazal CELÝ LocalStorage!");
    console.trace();
    originalClear.apply(this, arguments as any);
  };
}

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