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
import AuthWatch from "@/app/_auth-watch";

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
    <>
      {/* klientsky watcher – drží auto-refresh a reaguje na SIGNED_OUT */}
      <AuthWatch />

      <InfoMessageHost>
        <SidebarProvider>
          {/* GRID: na ≥lg sú 2 stĺpce (280px sidebar + 1fr obsah).
              Na mobile Sidebar rieši off-canvas sám (fixed + overlay). */}
          <div className="min-h-dvh grid lg:grid-cols-[280px_1fr] bg-neutral-950 text-neutral-100">
            {/* Sidebar: na mobile je off-canvas (vo vnútri komponentu),
                na ≥lg je statický v ľavom stĺpci vďaka lg:static v ňom */}
            <Sidebar />

            {/* Obsahový stĺpec */}
            <div className="min-h-dvh flex flex-col">
              {/* Topbar: sticky na mobile, normálny na desktop */}
              <header className="sticky top-0 z-30 h-14 border-b border-neutral-800 flex items-center justify-between px-3 lg:px-4 gap-3 bg-neutral-950/90 backdrop-blur [padding-top:env(safe-area-inset-top)]">
                <div className="flex items-center gap-2">
                  <HeaderToggle />
                  <div className="font-semibold hidden sm:block">SelfRace</div>
                </div>
                <UserMenu user={userInfo} />
              </header>

              {/* Page obsah */}
              <main className="flex-1 p-3 lg:p-4">{children}</main>
            </div>
          </div>

          {/* AuthSync presne raz, mimo headeru */}
          <AuthSync />
        </SidebarProvider>
      </InfoMessageHost>
    </>
  );
}
