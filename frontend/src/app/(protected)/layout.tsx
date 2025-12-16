// app/(protected)/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import ClientProtectedShell from "./ClientProtectedShell";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  // SSR kontrola prihlásenia – stačí sr_uuid
  const cookieStore = await cookies();
  const srUuid = cookieStore.get("sr_uuid")?.value ?? null;
  if (!srUuid) redirect("/signin");

  // Všetko klientské (providery, sidebar, header, toasty) ide do ClientProtectedShell
  return <ClientProtectedShell>{children}</ClientProtectedShell>;
}