// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/components/ui/Toast";
import ConfirmHost from "@/app/shared/components/ui/Confirm";
import AppBackdrop from "@/app/shared/components/ui/AppBackdrop";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <AppBackdrop>{children}</AppBackdrop>

        <ToastHost />
        <ConfirmHost />
      </body>
    </html>
  );
}