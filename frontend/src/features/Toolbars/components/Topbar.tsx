// src/features/Toolbars/Topbar.tsx
'use client';

import UserMenu from "@/features/auth/components/UserMenu";
import { TOPBAR_DESKTOP, BRAND_TEXT } from "@/shared/ui/classes";

type TopbarUser = { email?: string | null } | null;

export default function Topbar({ user }: { user?: TopbarUser }) {
  return (
    <div className={TOPBAR_DESKTOP}>
      {/* brand / názov */}
      <h1 className={BRAND_TEXT}>SelfRace</h1>

      {/* voliteľný email (vľavo, tichý) */}
      {user?.email && (
        <span className="text-sm opacity-70 hidden sm:inline">
          {user.email}
        </span>
      )}

      {/* avatar + menu doprava */}
      <div className="ml-auto">
        <UserMenu />
      </div>
    </div>
  );
}