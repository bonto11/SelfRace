"use client";

import { supabase } from "@/shared/hooks/supabaseClient";
import { useRouter } from "next/navigation";

export default function Topbar({ user }: { user: any }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <h1 className="text-lg font-bold">Trainalyze</h1>
      <div className="flex items-center gap-4">
        {user && <span className="text-sm">👤 {user.email}</span>}
        {user && (
          <button
            onClick={handleLogout}
            className="text-sm bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
}
