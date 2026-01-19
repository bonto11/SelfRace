// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/components/ui/Toast";
import ConfirmHost from "@/app/shared/components/ui/Confirm";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--app-bg)] text-[var(--app-text)]">
      {children}
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}