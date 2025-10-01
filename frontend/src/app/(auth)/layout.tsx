// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";
import InfoMessageHost from "@/shared/components/InfoMessageHost";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <InfoMessageHost>{children}</InfoMessageHost>
      </body>
    </html>
  );
}