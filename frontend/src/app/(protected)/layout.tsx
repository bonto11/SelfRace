// src/app/(protected)/layout.tsx
"use client";
import Sidebar from "@/features/Toolbars/Sidebar";
import Topbar from "@/features/Toolbars/Topbar";
import { useUser } from "@/shared/hooks/useUser";
import { InfoMessageHost } from "@/shared/components";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser(true);
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;

  return (
    <InfoMessageHost>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <Topbar user={user} />
          <div className="p-6 overflow-y-auto">{children}</div>
        </main>
      </div>
    </InfoMessageHost>
  );
}