// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";

import { THEME_VARS, toCssVars } from "@/shared/theme/themeCssVars";

export const metadata: Metadata = {
  title: "SelfRace",
  description: "Training and recovery insights with help of AI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk">
      <body
        style={{ cssText: toCssVars(THEME_VARS) } as any}
        className="min-h-dvh bg-[var(--app-bg)] text-[var(--app-text)]"
      >
        {children}
      </body>
    </html>
  );
}