"use client";
import { useState, useEffect } from "react";
import { updateMaintenanceMode, sendGlobalNotification } from "../actions";

export default function MaintenancePanel({ 
  dbStatus, 
  onUpdate 
}: { 
  dbStatus: any; 
  onUpdate: () => void 
}) {
  const [isActive, setIsActive] = useState(false);
  const [msgSk, setMsgSk] = useState("");
  const [msgEn, setMsgEn] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dbStatus) {
      setIsActive(dbStatus.active);
      setMsgSk(dbStatus.message?.sk || "");
      setMsgEn(dbStatus.message?.en || "");
    }
  }, [dbStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMaintenanceMode(isActive, msgSk, msgEn);
      alert("✅ Nastavenia údržby uložené!");
      onUpdate(); // Povie orchestrátorovi, aby si znovu natiahol reálny stav
    } catch (err: any) { alert("❌ Chyba: " + err.message); }
    finally { setSaving(false); }
  };

  const handleSendInfo = async () => {
    if (!confirm("Odoslať Push info o údržbe?")) return;
    try {
      const payload = {
        messages: {
          sk: { title: "Prebieha údržba ⚙️", body: msgSk, url: "/maintenance" },
          en: { title: "Maintenance in progress ⚙️", body: msgEn, url: "/maintenance" }
        }
      };
      await sendGlobalNotification(payload);
      alert("🚀 Notifikácia odoslaná!");
    } catch (err: any) { alert("❌ Chyba: " + err.message); }
  };

  return (
    <div className="bg-gray-900 border-t-4 border-yellow-500 p-8 rounded-b-2xl shadow-2xl space-y-6">
      <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic">
        <span className="text-yellow-500">🚧</span> Maintenance Mode
      </h2>
      
      <form onSubmit={handleSave} className="space-y-6">
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

      <button onClick={handleSendInfo} className="w-full border-2 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 py-3 rounded-xl font-bold transition-all">
        Poslať Info Notifikáciu
      </button>
    </div>
  );
}