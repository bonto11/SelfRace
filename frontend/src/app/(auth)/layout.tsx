// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/app/shared/components/ui/Toast";
import ConfirmHost from "@/app/shared/components/ui/Confirm";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk">
      <body>
        {children}
        {/* Globálny toast pre auth sekciu */}
        <ToastHost />
        <ConfirmHost />
      </body>
    </html>
  );
}
