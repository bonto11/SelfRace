import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export default async function MaintenancePage() {
  // POUŽÍVAME SERVEROVÝ KLIENT S AWAIT
  const supabase = await getSupabaseServer();
  
  // Načítame aktuálny stav priamo na serveri
  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .single();

  const msgSk = settings?.value?.message?.sk || "Aplikácia je momentálne v režime údržby. Hneď sme späť!";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8">
        
        {/* Ikonka ozubeného kolesa */}
        <div className="flex justify-center animate-pulse">
            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center border border-gray-800">
                <span className="text-3xl">⚙️</span>
            </div>
        </div>

        <h1 className="text-3xl font-bold text-white tracking-tight">
          Sme čoskoro späť
        </h1>
        
        <p className="text-lg text-gray-400 leading-relaxed bg-gray-900 p-6 rounded-xl border border-gray-800">
          {msgSk}
        </p>

        <p className="text-sm text-gray-600 pt-8">
          SelfRace Team
        </p>
      </div>
    </div>
  );
}