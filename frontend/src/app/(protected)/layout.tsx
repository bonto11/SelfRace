// app/(protected)/layout.tsx

import { redirect } from "next/navigation";
import ClientProtectedShell from "./ClientProtectedShell";
import { getAuthUser } from "@/app/shared/utils/auth.server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/");
  return <ClientProtectedShell>{children}</ClientProtectedShell>;
}