"use client";
import { useState } from "react";
import { sendGlobalNotification } from "../actions";

export default function NotificationPanel() {
  const [notifTitleSk, setNotifTitleSk] = useState("");
  const [notifBodySk, setNotifBodySk] = useState("");
  const [notifTitleEn, setNotifTitleEn] = useState("");
  const [notifBodyEn, setNotifBodyEn] = useState("");
  const [sending, setSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSend = async () => {
    if (!confirm("Vyslať notifikáciu všetkým do sveta?")) return;
    setSending(true);
    try {
      const payload = {
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

  return (
    <div className="bg-gray-900 border-t-4 border-blue-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      
      {/* HLAVIČKA */}
      <div 
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-2xl font-black text-white uppercase italic">
          <span className="text-blue-500 mr-3">📢</span> Broadcast
        </h2>
        
        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* ROZBALENÝ OBSAH */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 border-t border-gray-800' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-6 md:p-8 space-y-6">
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
          <button onClick={handleSend} disabled={sending || !notifTitleSk} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all disabled:opacity-30 shadow-lg shadow-blue-500/20">
            {sending ? "Odosielam..." : "Vyslať do sveta"}
          </button>
        </div>
      </div>
    </div>
  );
}
