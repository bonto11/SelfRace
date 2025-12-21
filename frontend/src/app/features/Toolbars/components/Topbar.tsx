// src/features/Toolbars/Topbar.tsx
"use client";

import HeaderToggle from "@/app/features/Toolbars/components/HeaderToggle";
import UserMenu from "@/app/features/auth/components/UserMenu";

type TopbarUser = { email?: string | null } | null;

export default function Topbar({ user }: { user?: TopbarUser }) {
  return (
    <div className="flex items-center gap-3 px-3 sm:px-6 py-2.5 border-b border-gray-800 bg-gray-900 sticky top-0 z-[57]">
      {/* mobile menu button */}
      <HeaderToggle />

      {/* brand / názov */}
      <h1 className="text-base sm:text-lg font-bold">SelfRace</h1>

      {/* voliteľne email (menšie, vľavo) */}
      {user?.email && (
        <span className="text-sm opacity-70 hidden sm:inline">
          {user.email}
        </span>
      )}

      {/* avatar menu vpravo */}
      <div className="ml-auto">
        <UserMenu />
      </div>
    </div>
  );
}
