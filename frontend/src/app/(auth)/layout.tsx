// src/app/(auth)/layout.tsx
"use client";
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/ui/components/Toast";
import ConfirmHost from "@/app/shared/ui/components/Confirm";
import AppBackdrop from "@/app/shared/ui/components/AppBackdrop";
import AppFooter from "@/app/shared/ui/components/AppFooter";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppBackdrop>
      {children}
      <AppFooter />
      <ToastHost />
      <ConfirmHost />
    </AppBackdrop>
  );
}
