// src/app/(protected)/layout.tsx
import type { ReactNode } from "react";
import ClientProtectedShell from "./ClientProtectedShell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // Už nepotrebujeme async server check, ClientProtectedShell a useUser() to vyrieši.
  return <ClientProtectedShell>{children}</ClientProtectedShell>;
}