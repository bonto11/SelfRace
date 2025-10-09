// src/app/(protected)/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";
import InfoMessageHost from "@/shared/components/InfoMessageHost";
import ClientShell from "@/shared/components/ClientShell";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const sb = getSupabaseServer();
  const { data } = await sb.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/signin");

  const userInfo = {
    email: user.email ?? "",
    name:
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name ||
      "",
    avatarUrl:
      (user.user_metadata as any)?.avatar_url ||
      (user.user_metadata as any)?.picture ||
      null,
  };

  return (
    <InfoMessageHost>
      <ClientShell user={userInfo}>
        {children}
      </ClientShell>
    </InfoMessageHost>
  );
}
