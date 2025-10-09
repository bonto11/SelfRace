// src/features/Toolbars/Topbar.tsx
"use client";

import UserMenu from "@/features/auth/components/UserMenu";

type TopbarUser = { email?: string | null } | null;

export default function Topbar({ user }: { user?: TopbarUser }) {
  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 bg-gray-900">
      {/* brand / názov */}
      <h1 className="text-lg font-bold">SelfRace</h1>

      {/* voliteľne zobrazíme email (malé, vľavo) */}
      {user?.email && (
        <span className="text-sm opacity-70 hidden sm:inline">
          {user.email}
        </span>
      )}

      {/* avatar + menu zarovnane doprava */}
      <div className="ml-auto">
        <UserMenu />
      </div>
    </div>
  );
}