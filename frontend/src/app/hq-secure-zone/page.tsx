"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

// Import našich modulov
import DiagnosticPanel from "./components/DiagnosticPanel";
import MaintenancePanel from "./components/MaintenancePanel";
import NotificationPanel from "./components/NotificationPanel";
import CronMasterPanel from "./components/CronMasterPanel";

export default function AdminDashboard() {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Zadefinované ako useCallback, aby sme to mohli poslať do MaintenancePanelu
  const loadDbStatus = useCallback(async () => {
    const sb = getSupabaseBrowser();
    const { data } = await sb.from("app_settings").select("value").eq("key", "maintenance_mode").single();
    if (data?.value) {
      setDbStatus(data.value);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDbStatus();
  }, [loadDbStatus]);

  if (loading) return <div className="p-8 text-gray-400 font-mono animate-pulse">Initializing Secure Protocol...</div>;

  const isMaintenanceActive = dbStatus?.active === true;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* HLAVNÁ NAVIGÁCIA A STATUS */}
      <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-white/5">
        <Link href="/activities" className="text-blue-400 hover:text-blue-200 font-bold flex items-center gap-2 transition-all">
          ← Exit to App
        </Link>
        
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-gray-500 border border-gray-800 px-2 py-1 rounded bg-black">ENV: PROD</span>
          {/* Tu je indikátor vedľa seba ako si chcel */}
          {isMaintenanceActive ? (
            <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/30">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase text-yellow-500 tracking-tighter">Maintenance</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              <span className="text-[10px] font-black uppercase text-green-500 tracking-tighter">System Online</span>
            </div>
          )}
        </div>
      </div>

      {/* VAROVNÝ BANNER (Teraz plne naviazaný na DB, nie na checkbox) */}
      {isMaintenanceActive && (
        <div className="bg-yellow-500 text-black p-4 rounded-xl font-black text-center uppercase tracking-widest animate-pulse border-4 border-yellow-600 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
          ⚠️ Pozor: Aplikácia je momentálne v režime údržby! Zákazníci nemajú prístup. ⚠️
        </div>
      )}

      {/* MODULY */}
      <DiagnosticPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MaintenancePanel dbStatus={dbStatus} onUpdate={loadDbStatus} />
        <NotificationPanel />
      </div>

      <CronMasterPanel />
      
    </div>
  );
}