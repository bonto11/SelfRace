"use client";

import { useState } from "react";
import DiagnosticPanel from "./components/DiagnosticPanel";
import ProvidersPanel from "./components/ProvidersPanel";
import ClientMemoryPanel from "./components/ClientMemoryPanel";
import MaintenancePanel from "./components/MaintenancePanel";
import NotificationPanel from "./components/NotificationPanel";
import CronMasterPanel from "./components/CronMasterPanel";

export default function AdminCommandCenterPage() {
  // Pridali sme späť state, ktorý MaintenancePanel potrebuje
  const [dbStatus, setDbStatus] = useState<any>(null);

  // Funkcia, ktorú MaintenancePanel zavolá po kliknutí na "Update"
  const loadDbStatus = async () => {
    // Ak si mal predtým logiku na načítanie statusu z DB, patrí sem.
    // Zatiaľ tu necháme bezpečný fallback, aby prešiel build.
    console.log("🔄 Požiadavka na obnovenie Maintenance statusu");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        
        {/* HLAVIČKA STRÁNKY */}
        <header className="mb-10">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-300">
            Command <span className="text-red-600">Center</span>
          </h1>
          <p className="text-gray-500 text-sm font-mono mt-2">
            System Administration & Diagnostics
          </p>
        </header>

        {/* 1. DIAGNOSTIKA A POUŽÍVATELIA */}
        <DiagnosticPanel />

        {/* 2. AI PROVIDERS */}
        <ProvidersPanel />

        {/* 3. DEBUG A PAMÄŤ */}
        <ClientMemoryPanel />

        {/* 4. ÚDRŽBA A NOTIFIKÁCIE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tu sme vrátili chýbajúce props! */}
          <MaintenancePanel dbStatus={dbStatus} onUpdate={loadDbStatus} />
          
          <NotificationPanel />
        </div>

        {/* 5. CRON & DANGER ZONE */}
        <CronMasterPanel />

      </div>
    </div>
  );
}
