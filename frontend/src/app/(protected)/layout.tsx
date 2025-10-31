// src/app/(protected)/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import Sidebar from "@/features/Toolbars/components/Sidebar";
import UserMenu from "@/features/auth/components/UserMenu";
import InfoMessageHost from "@/shared/components/InfoMessageHost";
import { SidebarProvider } from "@/features/Toolbars/hooks/useSidebar";
import HeaderToggle from "@/features/Toolbars/components/HeaderToggle";
import UsePrefsBootstrapper from "@/shared/bootstrap/usePrefs"

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // SSR kontrola prihlásenia – stačí sr_uuid
  const srUuid = cookies().get("sr_uuid")?.value ?? null;
  if (!srUuid) redirect("/signin");

  return (
    <InfoMessageHost>
      <SidebarProvider>
        <UsePrefsBootstrapper />
        <div className="min-h-dvh grid lg:grid-cols-[280px_1fr] bg-neutral-950 text-neutral-100">
          <Sidebar />
          <div className="min-h-dvh flex flex-col">
            <header className="sticky top-0 z-30 h-14 border-b border-neutral-800 flex items-center justify-between px-3 lg:px-4 gap-3 bg-neutral-950/90 backdrop-blur [padding-top:env(safe-area-inset-top)]">
              <div className="flex items-center gap-2">
                <HeaderToggle />
                <div className="font-semibold hidden sm:block">SelfRace</div>
              </div>
              {/* bez props – UserMenu si profil zistí samo z /api/auth/me */}
              <UserMenu />
            </header>
            <main className="flex-1 p-3 lg:p-4">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </InfoMessageHost>
  );
}