// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { appColors } from "@/shared/theme/app_colors";

export const metadata: Metadata = {
  title: "SelfRace",
  description: "Training and recovery insights with help of AI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk">
      <body
        style={{
          background: appColors.backgroundMain,
          color: appColors.textPrimary,
        }}
      >
        {children}
      </body>
    </html>
  );
}