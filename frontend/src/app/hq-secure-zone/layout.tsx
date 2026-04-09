import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export default async function SecureZoneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TU JE ZMENA: Pridaný 'await'
  const supabase = await getSupabaseServer();

  // 1. Zistenie používateľa
  const { data: { user } } = await supabase.auth.getUser();

  // Ak nie je vôbec prihlásený, pošleme ho na bežný login
  if (!user) {
    redirect("/signin");
  }

  // 2. Overenie ROLY v databáze (Kľúčový bezpečnostný krok)
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_uid", user.id)
    .single();

  if (profile?.role !== "ADMIN") {
    // Ak bežný používateľ uhádne URL, ukážeme mu 404 (tvárime sa, že stránka neexistuje)
    redirect("/404"); 
  }

  // Ak prešiel všetkými kontrolami, vyrendrujeme mu Admin rozhranie
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="bg-red-900 border-b border-red-700 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <h1 className="font-bold tracking-widest text-red-100">
            SELFRACE COMMAND CENTER
          </h1>
        </div>
        <div className="text-xs text-red-300">
          Admin ID: {user.id.substring(0, 8)}...
        </div>
      </header>
      
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}