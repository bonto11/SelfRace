// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/ui/components/Toast";
import ConfirmHost from "@/app/shared/ui/components/Confirm";
import AppBackdrop from "@/app/shared/ui/components/AppBackdrop";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppBackdrop>
      {children}
      <ToastHost />
      <ConfirmHost />
    </AppBackdrop>
  );
}
