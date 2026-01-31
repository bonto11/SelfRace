// src/app/layout.tsx
import type { Metadata, Viewport } from "next"; // Pridaný Viewport typ
import "./globals.css";
import type { ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import AppFooter from "@/app/shared/ui/components/AppFooter";

export const metadata: Metadata = {
  title: "SelfRace",
  description: "Training and recovery insights with help of AI",
  manifest: "/manifest.json", // Prepojenie na tvoj súbor v public
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SelfRace",
    startupImage: "/logo/Selfrace_noname.png",
  },
  icons: {
    apple: "/logo/Selfrace_noname.png", // Toto je kľúčové pre iOS
  },
};

// Toto zabezpečí, že sa web nebude na mobiloch hýbať do strán a zoomovať
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
      </body>
    </html>
  );
}