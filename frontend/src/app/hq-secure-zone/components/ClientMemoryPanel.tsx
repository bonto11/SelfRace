"use client";
import { useState, useEffect } from "react";

export default function ClientMemoryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [storages, setStorages] = useState({
    ls: "{}",
    ss: "{}",
    cookies: "{}",
  });

  const loadEverything = () => {
    // 1. LocalStorage
    const lsData = { ...window.localStorage };
    
    // 2. SessionStorage
    const ssData = { ...window.sessionStorage };
    
    // 3. Cookies
    const cookiesData = document.cookie.split('; ').reduce((acc: any, current) => {
      const [name, ...value] = current.split('=');
      if (name) acc[name.trim()] = decodeURIComponent(value.join('='));
      return acc;
    }, {});

    setStorages({
      ls: JSON.stringify(lsData, null, 2),
      ss: JSON.stringify(ssData, null, 2),
      cookies: JSON.stringify(cookiesData, null, 2),
    });
  };

  // Načíta dáta len vtedy, keď panel rozbalíme
  useEffect(() => {
    if (isOpen) {
      loadEverything();
    }
  }, [isOpen]);

  const clearLS = () => {
    if (!confirm("⚠️ Naozaj vymazať LocalStorage? (Zmaže uložené nastavenia apky v tomto prehliadači)")) return;
    window.localStorage.clear();
    loadEverything();
  };

  const clearSS = () => {
    if (!confirm("⚠️ Naozaj vymazať SessionStorage?")) return;
    window.sessionStorage.clear();
    loadEverything();
  };

  const clearCookies = () => {
    if (!confirm("⚠️ Naozaj vymazať klientské Cookies? (Môže ťa to odhlásiť z niektorých služieb)")) return;
    // Prejde všetky cookies a nastaví im dátum expirácie do minulosti
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    loadEverything();
  };

  return (
    <div className="bg-gray-900 border-t-4 border-teal-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      
      {/* HLAVIČKA */}
      <div 
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-teal-500 mr-3">💾</span> Memory Scanner
          </h2>
        </div>

        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* ROZBALENÝ OBSAH */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[3000px] opacity-100 border-t border-gray-800' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-6 md:p-8 space-y-6">
          
          {/* AKČNÉ TLAČIDLÁ */}
          <div className="flex flex-wrap gap-3 border-b border-gray-800 pb-6">
            <button 
              onClick={loadEverything} 
              className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all"
            >
              🔄 Refresh Scan
            </button>
            <button 
              onClick={clearLS} 
              className="bg-red-900/20 hover:bg-red-900/50 border border-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all"
            >
              🗑️ Clear LS
            </button>
            <button 
              onClick={clearSS} 
              className="bg-red-900/20 hover:bg-red-900/50 border border-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all"
            >
              🗑️ Clear SS
            </button>
            <button 
              onClick={clearCookies} 
              className="bg-red-900/20 hover:bg-red-900/50 border border-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all"
            >
              🍪 Clear Cookies
            </button>
          </div>

          {/* DUMP PAMÄTE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COOKIES */}
            <div className="bg-black border border-gray-800 p-4 rounded-xl flex flex-col">
              <h3 className="text-teal-400 font-black uppercase tracking-widest text-xs mb-3 flex justify-between">
                Cookies 
                <span className="text-gray-600">Client-Side</span>
              </h3>
              <pre className="text-[10px] font-mono text-gray-400 overflow-auto max-h-64 scrollbar-thin scrollbar-thumb-gray-800 p-2 bg-gray-900/50 rounded border border-gray-800/50 flex-1">
                {storages.cookies === "{}" ? "Žiadne dáta" : storages.cookies}
              </pre>
            </div>

            {/* LOCAL STORAGE */}
            <div className="bg-black border border-gray-800 p-4 rounded-xl flex flex-col">
              <h3 className="text-teal-400 font-black uppercase tracking-widest text-xs mb-3 flex justify-between">
                Local Storage 
                <span className="text-gray-600">Persistent</span>
              </h3>
              <pre className="text-[10px] font-mono text-gray-300 overflow-auto max-h-64 scrollbar-thin scrollbar-thumb-gray-800 p-2 bg-gray-900/50 rounded border border-gray-800/50 flex-1">
                {storages.ls === "{}" ? "Žiadne dáta" : storages.ls}
              </pre>
            </div>

            {/* SESSION STORAGE */}
            <div className="bg-black border border-gray-800 p-4 rounded-xl flex flex-col">
              <h3 className="text-teal-400 font-black uppercase tracking-widest text-xs mb-3 flex justify-between">
                Session Storage 
                <span className="text-gray-600">Temporary</span>
              </h3>
              <pre className="text-[10px] font-mono text-gray-500 overflow-auto max-h-64 scrollbar-thin scrollbar-thumb-gray-800 p-2 bg-gray-900/50 rounded border border-gray-800/50 flex-1">
                {storages.ss === "{}" ? "Žiadne dáta" : storages.ss}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
