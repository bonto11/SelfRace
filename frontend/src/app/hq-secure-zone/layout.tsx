import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export default async function SecureZoneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_uid", user.id)
    .single();

  if (profile?.role !== "ADMIN") {
    redirect("/404"); 
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      <header className="bg-red-900 border-b-4 border-black px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🛡️</span>
          <h1 className="font-black text-2xl tracking-tighter text-white uppercase">
            SelfRace Command Center
          </h1>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-bold text-red-300 tracking-widest">Administrator Access</span>
          <span className="text-xs font-mono text-white opacity-70">{user.email}</span>
        </div>
      </header>
      
      <main className="flex-1 p-6 md:p-10 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-gray-900 to-black">
        {children}
      </main>
    </div>
  );
}