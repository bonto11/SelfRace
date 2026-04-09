import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Image from "next/image";

export default async function MaintenancePage() {
  const supabase = getSupabaseBrowser();
  
  // Načítame aktuálny stav priamo na serveri, aby to bolo rýchle
  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .single();

  // Ak by náhodou údržba nebola aktívna (napr. niekto zadal URL manuálne a údržba je už off)
  // môžeme tu teoreticky dať redirect na "/", ale necháme to zatiaľ takto.

  const msgSk = settings?.value?.message?.sk || "Aplikácia je momentálne v režime údržby.";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8">
        
        {/* Pridaj vaše logo */}
        <div className="flex justify-center animate-pulse">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center">
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