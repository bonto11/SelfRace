// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/components/components/Toast";
import ConfirmHost from "@/app/shared/components/components/Confirm";
import AppBackdrop from "@/app/shared/components/components/AppBackdrop";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppBackdrop>
      {children}
      <ToastHost />
      <ConfirmHost />
    </AppBackdrop>
  );
}
