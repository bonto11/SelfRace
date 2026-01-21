// src/app/shared/components/ui/AppBackdrop.tsx
"use client";
import type { ReactNode } from "react";
import { appColors } from "@/app/shared/theme/app_colors";

export default function AppBackdrop({ children }: { children?: ReactNode }) {
  return (
    <div className="absolute inset-0">
      <div
        className="min-h-dvh relative overflow-hidden"
        style={{
          background: `radial-gradient(900px 500px at 50% 20%, rgba(74,222,128,0.10), transparent 60%),
                      radial-gradient(700px 420px at 20% 80%, rgba(45,212,191,0.08), transparent 60%),
                      linear-gradient(180deg, ${appColors.backgroundMain}, ${appColors.backgroundAlt})`,
          color: appColors.textPrimary,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.55))" }}
        />
        <div className="relative">{children}</div>
      </div>
      {children}
    </div>
  );
}
