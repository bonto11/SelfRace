import DiagnosticPanel from "./components/DiagnosticPanel";
import ProvidersPanel from "./components/ProvidersPanel";
import ClientMemoryPanel from "./components/ClientMemoryPanel";
import MaintenancePanel from "./components/MaintenancePanel";
import NotificationPanel from "./components/NotificationPanel";
import CronMasterPanel from "./components/CronMasterPanel";

export default function AdminCommandCenterPage() {
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

        {/* 3. DEBUG A PAMÄŤ (Náš nový panel) */}
        <ClientMemoryPanel />

        {/* 4. ÚDRŽBA A NOTIFIKÁCIE (Vedľa seba na veľkých obrazovkách) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Ak mal MaintenancePanel nejaké props (napr. dbStatus={...}), doplň si ich */}
          <MaintenancePanel />
          <NotificationPanel />
        </div>

        {/* 5. CRON & DANGER ZONE (Úplne dole) */}
        <CronMasterPanel />

      </div>
    </div>
  );
}
