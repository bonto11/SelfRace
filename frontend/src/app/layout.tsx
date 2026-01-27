// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export const metadata: Metadata = {
  title: "SelfRace",
  description: "Training and recovery insights with help of AI",
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
        {children}
      </body>
    </html>
  );
}
