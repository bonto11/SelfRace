// src/app/(protected)/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";
import Sidebar from "@/features/Toolbars/components/Sidebar";
import UserMenu from "@/features/auth/components/UserMenu";
import AuthSync from "@/features/auth/components/AuthSync";
import InfoMessageHost from "@/shared/components/InfoMessageHost";
import { SidebarProvider } from "@/features/Toolbars/hooks/useSidebar";
import HeaderToggle from "@/features/Toolbars/components/HeaderToggle";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const sb = getSupabaseServer();
  const { data } = await sb.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/signin");

  const userInfo = {
    email: user.email ?? "",
    name:
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name || "",
    avatarUrl:
      (user.user_metadata as any)?.avatar_url ||
      (user.user_metadata as any)?.picture || null,
  };

  return (
    <InfoMessageHost>
      <SidebarProvider>
        <div className="min-h-dvh flex">
          <Sidebar />
          <div className="flex-1 flex flex-col lg:ml-0">
            <header className="h-14 border-b flex items-center justify-between px-3 lg:px-4 gap-3">
              <div className="flex items-center gap-2">
                <HeaderToggle />
                <div className="font-semibold hidden sm:block">Trainalyze</div>
              </div>
              <UserMenu user={userInfo} />
            </header>

            <main className="flex-1 p-3 lg:p-4">{children}</main>
          </div>
        </div>

        {/* presne raz, mimo headeru */}
        <AuthSync />
      </SidebarProvider>
    </InfoMessageHost>
  );
}
