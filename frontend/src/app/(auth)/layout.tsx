// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import ToastHost from "@/shared/components/ui/Toast";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk">
      <body>
        {children}
        {/* Globálny toast pre auth sekciu */}
        <ToastHost />
      </body>
    </html>
  );
}