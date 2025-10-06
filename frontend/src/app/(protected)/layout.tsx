// src/app/(protected)/layout.tsx
//zmena2
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";
import Sidebar from "@/features/Toolbars/Sidebar";
import UserMenu from "@/features/auth/components/UserMenu";
import AuthSync from "@/features/auth/components/AuthSync";
import InfoMessageHost from "@/shared/components/InfoMessageHost";

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
      <div className="min-h-dvh flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center justify-between px-4">
            <div className="font-semibold">Trainalyze</div>
            <UserMenu user={userInfo} />
          </header>
          <main className="flex-1 p-4">{children}</main>
        </div>
        <AuthSync />
      </div>
    </InfoMessageHost>
  );
}