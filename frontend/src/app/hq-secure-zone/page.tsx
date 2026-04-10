"use client";

import { useState } from "react";
import Link from "next/link"; // Nezabudni na import Linku
import DiagnosticPanel from "./components/DiagnosticPanel";
import ProvidersPanel from "./components/ProvidersPanel";
import ClientMemoryPanel from "./components/ClientMemoryPanel";
import MaintenancePanel from "./components/MaintenancePanel";
import NotificationPanel from "./components/NotificationPanel";
import CronMasterPanel from "./components/CronMasterPanel";

export default function AdminCommandCenterPage() {
  const [dbStatus, setDbStatus] = useState<any>(null);

  const loadDbStatus = async () => {
    console.log("🔄 Požiadavka na obnovenie Maintenance statusu");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {/* TLAČIDLO SPÄŤ */}
        <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-2xl border border-gray-800/50 w-full md:w-auto">
          <Link
            href="/activities"
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold text-sm px-4 py-2 transition-all active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Exit to App
          </Link>
        </div>
        {/* NAVIGÁCIA A HLAVIČKA */}

        <div className="space-y-6 mb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-300">
                SELFRACE{" "}
                <span className="text-red-600 font-black">COMMAND CENTER</span>
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-gray-900 px-2 py-1 rounded border border-gray-800">
                  ADMINISTRATOR ACCESS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. DIAGNOSTIKA A POUŽÍVATELIA */}
        <DiagnosticPanel />

        {/* 2. AI PROVIDERS */}
        <ProvidersPanel />

        {/* 3. DEBUG A PAMÄŤ */}
        <ClientMemoryPanel />

        {/* 4. ÚDRŽBA A NOTIFIKÁCIE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <MaintenancePanel dbStatus={dbStatus} onUpdate={loadDbStatus} />
          <NotificationPanel />
        </div>

        {/* 5. CRON & DANGER ZONE */}
        <CronMasterPanel />
      </div>
    </div>
  );
}
