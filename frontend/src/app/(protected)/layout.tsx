// src/app/(protected)/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { UserIdProvider } from "@/features/auth/components/UserIdProvider";
import Sidebar from "@/features/Toolbars/components/Sidebar";
import UserMenu from "@/features/auth/components/UserMenu";
import InfoMessageHost from "@/shared/components/InfoMessageHost";
import { SidebarProvider } from "@/features/Toolbars/hooks/useSidebar";
import HeaderToggle from "@/features/Toolbars/components/HeaderToggle";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // server-side kontrola, či máme uložené naše UUID cookie
  const srUuid = cookies().get("sr_uuid")?.value ?? null;
  if (!srUuid) {
    // nie sme prihlásení -> na signin
    redirect("/signin");
  }

  return (
    <InfoMessageHost>
      <SidebarProvider>
        {/* poskytne userId (číslo) / uuid (string) pre klienta z cookies */}
        <UserIdProvider>
          <div className="min-h-dvh grid lg:grid-cols-[280px_1fr] bg-neutral-950 text-neutral-100">
            <Sidebar />

            <div className="min-h-dvh flex flex-col">
              {/* Topbar */}
              <header className="sticky top-0 z-30 h-14 border-b border-neutral-800 flex items-center justify-between px-3 lg:px-4 gap-3 bg-neutral-950/90 backdrop-blur [padding-top:env(safe-area-inset-top)]">
                <div className="flex items-center gap-2">
                  <HeaderToggle />
                  <div className="font-semibold hidden sm:block">SelfRace</div>
                </div>
                {/* bez propov – UserMenu si načíta usera na klientovi */}
                <UserMenu />
              </header>

              {/* Obsah */}
              <main className="flex-1 p-3 lg:p-4">{children}</main>
            </div>
          </div>
        </UserIdProvider>
      </SidebarProvider>
    </InfoMessageHost>
  );
}