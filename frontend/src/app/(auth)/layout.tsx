// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/components/ui/Toast";
import ConfirmHost from "@/app/shared/components/ui/Confirm";
import { appColors } from "@/app/shared/theme/app_colors";
import AppBackdrop from "@/app/shared/components/ui/AppBackdrop";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        minHeight: "100dvh",
        background: appColors.backgroundMain,
        color: appColors.textPrimary,
      }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AppBackdrop />
      </div>

      <div className="relative z-10">
        {children}
        <ToastHost />
        <ConfirmHost />
      </div>
    </div>
  );
}