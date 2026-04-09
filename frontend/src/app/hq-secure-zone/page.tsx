"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { updateMaintenanceMode, sendGlobalNotification } from "./actions";

export default function AdminDashboard() {
  // --- State pre Údržbu ---
  const [isActive, setIsActive] = useState(false);
  const [msgSk, setMsgSk] = useState("");
  const [msgEn, setMsgEn] = useState("");
  
  // --- State pre Notifikácie ---
  const [notifTitleSk, setNotifTitleSk] = useState("");
  const [notifBodySk, setNotifBodySk] = useState("");
  const [notifTitleEn, setNotifTitleEn] = useState("");
  const [notifBodyEn, setNotifBodyEn] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      const sb = getSupabaseBrowser();
      const { data } = await sb.from("app_settings").select("value").eq("key", "maintenance_mode").single();
      if (data?.value) {
        setIsActive(data.value.active);
        setMsgSk(data.value.message?.sk || "");
        setMsgEn(data.value.message?.en || "");
      }
      setLoading(false);
    }
    loadStatus();
  }, []);

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMaintenanceMode(isActive, msgSk, msgEn);
      alert("✅ Nastavenia údržby uložené!");
    } catch (err: any) { alert("❌ Chyba: " + err.message); }
    finally { setSaving(false); }
  };

  const handleSendNotification = async (type: 'custom' | 'maintenance') => {
    if (!confirm("Naozaj chcete odoslať PUSH notifikáciu všetkým používateľom?")) return;
    
    setSending(true);
    try {
      const payload = type === 'maintenance' ? {
        messages: {
          sk: { title: "Prebieha údržba ⚙️", body: msgSk, url: "/maintenance" },
          en: { title: "Maintenance in progress ⚙️", body: msgEn, url: "/maintenance" }
        }
      } : {
        messages: {
          sk: { title: notifTitleSk, body: notifBodySk, url: "/activities" },
          en: { title: notifTitleEn, body: notifBodyEn, url: "/activities" }
        }
      };

      await sendGlobalNotification(payload);
      alert("🚀 Notifikácia úspešne odoslaná!");
    } catch (err: any) { alert("❌ Chyba: " + err.message); }
    finally { setSending(false); }
  };

  if (loading) return <div className="p-8 text-gray-400">Načítavam riadiace centrum...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      
      {/* NAVIGÁCIA SPÄŤ */}
      <div className="flex justify-between items-center">
        <Link href="/activities" className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-all">
          ← Späť do aplikácie
        </Link>
        <span className="text-xs text-gray-600 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
          Environment: Production
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* SEKCIÁ 1: ÚDRŽBA */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-500">⚙️</span> Režim Údržby
          </h2>
          
          <form onSubmit={handleSaveMaintenance} className="space-y-4">
            <label className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
              <input 
                type="checkbox" 
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 accent-red-600"
              />
              <span className="text-gray-200 font-medium">Aktívny režim údržby</span>
            </label>

            <div className="space-y-3">
              <textarea 
                value={msgSk} onChange={(e) => setMsgSk(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white"
                placeholder="Správa SK..." rows={2}
              />
              <textarea 
                value={msgEn} onChange={(e) => setMsgEn(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white"
                placeholder="Správa EN..." rows={2}
              />
            </div>

            <button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-all disabled:opacity-50">
              {saving ? "Ukladám..." : "Uložiť a aktivovať"}
            </button>
          </form>

          <button 
            onClick={() => handleSendNotification('maintenance')}
            className="w-full border border-red-900/50 text-red-400 hover:bg-red-950/30 py-2 rounded-lg text-sm transition-all"
          >
            ⚠️ Poslať info o údržbe (Push)
          </button>
        </div>

        {/* SEKCIA 2: NOTIFIKÁCIE */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-blue-500">📢</span> Globálna Notifikácia
          </h2>

          <div className="space-y-4">
            <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg">
              <p className="text-[10px] uppercase tracking-widest text-blue-400 mb-2 font-bold">Slovenčina</p>
              <input value={notifTitleSk} onChange={e => setNotifTitleSk(e.target.value)} className="w-full bg-transparent border-b border-gray-700 mb-2 p-1 text-white outline-none focus:border-blue-500" placeholder="Nadpis správy..." />
              <textarea value={notifBodySk} onChange={e => setNotifBodySk(e.target.value)} className="w-full bg-transparent text-sm text-gray-400 outline-none" placeholder="Telo správy..." rows={2} />
            </div>

            <div className="p-3 bg-purple-900/10 border border-purple-900/30 rounded-lg">
              <p className="text-[10px] uppercase tracking-widest text-purple-400 mb-2 font-bold">English</p>
              <input value={notifTitleEn} onChange={e => setNotifTitleEn(e.target.value)} className="w-full bg-transparent border-b border-gray-700 mb-2 p-1 text-white outline-none focus:border-purple-500" placeholder="Message title..." />
              <textarea value={notifBodyEn} onChange={e => setNotifBodyEn(e.target.value)} className="w-full bg-transparent text-sm text-gray-400 outline-none" placeholder="Message body..." rows={2} />
            </div>

            <button 
              onClick={() => handleSendNotification('custom')}
              disabled={sending || !notifTitleSk}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-30"
            >
              {sending ? "Odosielam..." : "Odoslať všetkým používateľom"}
            </button>
          </div>
        </div>

      </div>

      {/* DANGER ZONE */}
      <div className="p-6 border border-red-900/30 bg-red-950/10 rounded-2xl">
        <h3 className="text-red-500 font-bold mb-3 flex items-center gap-2">
          <span>⚠️</span> Systémová zóna
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button className="bg-gray-800 hover:bg-gray-700 p-3 rounded-lg text-xs text-gray-300 border border-gray-700 transition-colors">
            Logy Systému
          </button>
          <button className="bg-gray-800 hover:bg-gray-700 p-3 rounded-lg text-xs text-gray-300 border border-gray-700 transition-colors">
            DB Health
          </button>
          <button className="bg-gray-800 hover:bg-gray-700 p-3 rounded-lg text-xs text-gray-300 border border-gray-700 transition-colors">
            Clear Cache
          </button>
          <button className="bg-red-900/20 hover:bg-red-900/40 p-3 rounded-lg text-xs text-red-400 border border-red-900/50 transition-colors">
            Force Logout All
          </button>
        </div>
      </div>
    </div>
  );
}