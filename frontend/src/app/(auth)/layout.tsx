// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/components/ui/Toast";
import ConfirmHost from "@/app/shared/components/ui/Confirm";
import { appColors } from "@/shared/theme/app_colors";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: appColors.backgroundMain,
        color: appColors.textPrimary,
      }}
    >
      {children}
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}