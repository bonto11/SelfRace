"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { updateMaintenanceMode } from "./actions";
// Tu si naimportuj váš vlastný <Button> a <TextField> ak chcete, použil som čistý HTML/Tailwind pre ukážku

export default function AdminDashboard() {
  const [isActive, setIsActive] = useState(false);
  const [msgSk, setMsgSk] = useState("");
  const [msgEn, setMsgEn] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Načítanie aktuálneho stavu pri otvorení stránky
    async function loadStatus() {
      const sb = getSupabaseBrowser();
      const { data } = await sb
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();

      if (data?.value) {
        setIsActive(data.value.active);
        setMsgSk(data.value.message?.sk || "");
        setMsgEn(data.value.message?.en || "");
      }
      setLoading(false);
    }
    loadStatus();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Zavolanie zabezpečenej serverovej akcie z kroku 1
      await updateMaintenanceMode(isActive, msgSk, msgEn);
      alert("✅ Nastavenia údržby boli úspešne uložené!");
    } catch (err: any) {
      alert("❌ Chyba: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Načítavam dáta...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
        <h2 className="text-xl font-bold text-white mb-4">Režim Údržby</h2>
        
        <form onSubmit={handleSave} className="space-y-6">
          {/* Prepínač ON / OFF */}
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-6 h-6 text-red-600 bg-gray-800 border-gray-700 rounded focus:ring-red-600 focus:ring-2"
            />
            <span className="text-gray-200 font-medium text-lg">
              Zapnúť presmerovanie na údržbu
            </span>
          </label>

          {/* Texty pre používateľov */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Správa (Slovenčina)</label>
              <textarea 
                value={msgSk}
                onChange={(e) => setMsgSk(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                rows={2}
                placeholder="Práve vylepšujeme aplikáciu..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Správa (Angličtina)</label>
              <textarea 
                value={msgEn}
                onChange={(e) => setMsgEn(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                rows={2}
                placeholder="We are upgrading the app..."
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className={`px-6 py-3 rounded font-bold transition-all ${
              isActive 
                ? "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]" 
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            {saving ? "Ukladám..." : "Uložiť nastavenia"}
          </button>
        </form>
      </div>

      {/* Tlačidlo na odhlásenie všetkých si pridáme neskôr (vyžaduje Admin API kľúč) */}
      <div className="p-4 border border-red-900/50 bg-red-950/20 rounded-xl">
        <h3 className="text-red-400 font-bold mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-500">Ďalšie funkcie ako hromadné odhlásenie a spúšťanie jobov pridáme neskôr.</p>
      </div>
    </div>
  );
}