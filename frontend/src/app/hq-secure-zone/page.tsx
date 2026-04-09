"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { updateMaintenanceMode, sendGlobalNotification, triggerMaintenanceTask } from "./actions";

export default function AdminDashboard() {
  const [isActive, setIsActive] = useState(false);
  const [msgSk, setMsgSk] = useState("");
  const [msgEn, setMsgEn] = useState("");
  
  const [notifTitleSk, setNotifTitleSk] = useState("");
  const [notifBodySk, setNotifBodySk] = useState("");
  const [notifTitleEn, setNotifTitleEn] = useState("");
  const [notifBodyEn, setNotifBodyEn] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [taskRunning, setTaskRunning] = useState<string | null>(null);

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
    if (!confirm("Odoslať PUSH notifikáciu všetkým?")) return;
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
      alert("🚀 Notifikácia odoslaná!");
    } catch (err: any) { alert("❌ Chyba: " + err.message); }
    finally { setSending(false); }
  };

  const runTask = async (taskName: string, label: string) => {
    if (!confirm(`Naozaj spustiť úlohu: ${label}?`)) return;
    setTaskRunning(taskName);
    try {
      const res = await triggerMaintenanceTask(taskName);
      alert(`✅ Úloha úspešne dokončená. Odpoveď backendu: ${res.message || "OK"}`);
    } catch (err: any) { alert(`❌ Chyba: ${err.message}`); }
    finally { setTaskRunning(null); }
  };

  // Zoznam VŠETKÝCH dostupných cron úloh
  const allCronTasks = [
    { id: 'training', label: 'Push: Morning Training', group: 'Notifications' },
    { id: 'recovery', label: 'Push: Recovery Tips', group: 'Notifications' },
    { id: 'review', label: 'Push: Evening Review', group: 'Notifications' },
    { id: 'hourly-ping', label: 'Test Hourly Ping', group: 'Notifications' },
    
    { id: 'weekly-athlete-state', label: 'Force AI Refresh (50 users)', group: 'AI & Plans' },
    { id: 'daily-plan-completion', label: 'Auto-Complete Plans', group: 'AI & Plans' },
    
    { id: 'apply-subscriptions', label: 'Sync Subscriptions', group: 'System' },
    { id: 'cleanup-expired-activities', label: 'Clean Expired Files', group: 'System' },
    { id: 'cleanup-deleted-activities', label: 'Purge Deleted Data', group: 'System' },
    { id: 'account-hard-delete', label: 'Hard Delete Accounts', group: 'Danger' }
  ];

  if (loading) return <div className="p-8 text-gray-400 font-mono animate-pulse">Initializing Secure Protocol...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      
      <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-white/5">
        <Link href="/activities" className="text-blue-400 hover:text-blue-200 font-bold flex items-center gap-2 transition-all">
          ← Exit to App
        </Link>
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
          <span className="text-[10px] font-black uppercase text-green-500 tracking-tighter">System Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ÚDRŽBA */}
        <div className="bg-gray-900 border-t-4 border-yellow-500 p-8 rounded-b-2xl shadow-2xl space-y-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic">
            <span className="text-yellow-500">🚧</span> Maintenance Mode
          </h2>
          
          <form onSubmit={handleSaveMaintenance} className="space-y-6">
            <div className={`p-4 rounded-xl border-2 transition-all ${isActive ? 'bg-red-900/20 border-red-500' : 'bg-gray-800 border-gray-700'}`}>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-6 h-6 accent-red-600" />
                <span className="text-lg font-bold text-white uppercase">Aktivovať údržbu</span>
              </label>
            </div>

            <div className="space-y-4">
              <textarea value={msgSk} onChange={(e) => setMsgSk(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white focus:ring-2 ring-yellow-500 outline-none transition-all" placeholder="Správa pre Slovákov..." rows={2} />
              <textarea value={msgEn} onChange={(e) => setMsgEn(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white focus:ring-2 ring-yellow-500 outline-none transition-all" placeholder="Message for Internationals..." rows={2} />
            </div>

            <button type="submit" disabled={saving} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest transition-all disabled:opacity-50">
              {saving ? "Ukladám..." : "Uložiť zmeny"}
            </button>
          </form>

          <button onClick={() => handleSendNotification('maintenance')} className="w-full border-2 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 py-3 rounded-xl font-bold transition-all">
            Poslať Info Notifikáciu
          </button>
        </div>

        {/* NOTIFIKÁCIE */}
        <div className="bg-gray-900 border-t-4 border-blue-500 p-8 rounded-b-2xl shadow-2xl space-y-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic">
            <span className="text-blue-500">📢</span> Broadcast
          </h2>

          <div className="space-y-6">
            <div className="space-y-3 p-4 bg-blue-900/10 rounded-xl border border-blue-900/20">
              <p className="text-[10px] font-black uppercase text-blue-400">Slovenčina</p>
              <input value={notifTitleSk} onChange={e => setNotifTitleSk(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white outline-none" placeholder="Titulok..." />
              <textarea value={notifBodySk} onChange={e => setNotifBodySk(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-sm text-gray-400 outline-none" placeholder="Obsah správy..." rows={2} />
            </div>

            <div className="space-y-3 p-4 bg-purple-900/10 rounded-xl border border-purple-900/20">
              <p className="text-[10px] font-black uppercase text-purple-400">English</p>
              <input value={notifTitleEn} onChange={e => setNotifTitleEn(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white outline-none" placeholder="Title..." />
              <textarea value={notifBodyEn} onChange={e => setNotifBodyEn(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-sm text-gray-400 outline-none" placeholder="Body content..." rows={2} />
            </div>

            <button onClick={() => handleSendNotification('custom')} disabled={sending || !notifTitleSk} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all disabled:opacity-30 shadow-lg shadow-blue-500/20">
              {sending ? "Odosielam..." : "Vyslať do sveta"}
            </button>
          </div>
        </div>
      </div>

      {/* CRON MASTER / CRITICAL OPERATIONS */}
      <div className="bg-black border-2 border-red-900/30 p-8 rounded-3xl shadow-2xl">
        <h3 className="text-red-600 font-black mb-6 flex items-center gap-3 uppercase tracking-tighter text-xl italic">
          <span className="animate-pulse">🔴</span> Cron Master Operations
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allCronTasks.map((task) => (
            <button 
              key={task.id}
              onClick={() => runTask(task.id, task.label)}
              disabled={!!taskRunning}
              className={`group flex flex-col items-start p-4 bg-gray-900 hover:bg-red-950/20 border transition-all disabled:opacity-20 rounded-2xl ${
                task.group === 'Danger' ? 'border-red-900/50 hover:border-red-600' : 'border-gray-800 hover:border-gray-500'
              }`}
            >
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{task.group}</span>
              <span className="text-xs font-black text-white uppercase tracking-tight">
                {taskRunning === task.id ? "⚡ Running..." : task.label}
              </span>
            </button>
          ))}
        </div>

        {/* Tlačidlo na Global Logout */}
        <div className="mt-10 pt-8 border-t border-red-900/30">
          <button 
            onClick={() => runTask('force-logout-all', 'GLOBAL FORCE LOGOUT')}
            disabled={!!taskRunning}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-6 rounded-2xl uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all active:scale-[0.98]"
          >
            🚨 Global Force Logout (Kicks everyone) 🚨
          </button>
        </div>
      </div>
    </div>
  );
}