// src/app/(protected)/layout.tsx
import type { ReactNode } from "react";
import ClientProtectedShell from "./ClientProtectedShell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <ClientProtectedShell>{children}</ClientProtectedShell>;
}