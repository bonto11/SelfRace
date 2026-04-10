"use client";
import { useState, useEffect, useRef } from "react";

// Typ pre naše zachytené logy
type LogEntry = { time: string; type: "log" | "warn" | "error"; message: string };

export default function ClientMemoryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [storages, setStorages] = useState({
    ls: "{}",
    ss: "{}",
    cookies: "{}",
  });
  
  // Tu budeme ukladať zachytené správy z konzoly
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 1. ZACHYTÁVANIE KONZOLY (Interceptor)
  useEffect(() => {
    // Odložíme si pôvodné funkcie
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Funkcia, ktorá spracuje log a uloží ho k nám do state
    const captureLog = (type: "log" | "warn" | "error", originalFn: any, ...args: any[]) => {
      const message = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)))
        .join(" ");
        
      setConsoleLogs((prev) => {
        // Udržíme len posledných 50 logov, nech nám to nezahltí pamäť
        const newLogs = [...prev, { time: new Date().toLocaleTimeString(), type, message }];
        return newLogs.slice(-50);
      });
      
      // Zavoláme aj originálnu konzolu, nech to funguje normálne (F12)
      originalFn(...args);
    };

    // Prepíšeme konzolu našimi funkciami
    console.log = (...args) => captureLog("log", originalLog, ...args);
    console.warn = (...args) => captureLog("warn", originalWarn, ...args);
    console.error = (...args) => captureLog("error", originalError, ...args);

    // Keď sa komponent zničí, vrátime konzolu do pôvodného stavu
    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Automatické scrollovanie konzoly dole
  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, isOpen]);


  // 2. NAČÍTANIE PAMÄTE PREHLIADAČA
  const loadEverything = () => {
    const lsData = { ...window.localStorage };
    const ssData = { ...window.sessionStorage };
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

  useEffect(() => {
    if (isOpen) loadEverything();
  }, [isOpen]);

  // 3. ČISTIACE AKCIE
  const clearLS = () => {
    if (!confirm("⚠️ Naozaj vymazať LocalStorage?")) return;
    window.localStorage.clear();
    loadEverything();
    console.warn("LocalStorage bol manuálne vymazaný administrátorom.");
  };

  const clearSS = () => {
    if (!confirm("⚠️ Naozaj vymazať SessionStorage?")) return;
    window.sessionStorage.clear();
    loadEverything();
    console.warn("SessionStorage bol manuálne vymazaný administrátorom.");
  };

  const clearCookies = () => {
    if (!confirm("⚠️ Naozaj vymazať klientské Cookies?")) return;
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    loadEverything();
    console.warn("Klientske Cookies boli manuálne vymazané.");
  };

  const clearCapturedLogs = () => {
    setConsoleLogs([]);
  };

  // 4. TESTOVACIE TLAČIDLÁ
  const fireTestLog = () => console.log("✅ Toto je testovací log z Command Centra.", { status: "OK", id: 123 });
  const fireTestError = () => console.error("🚨 Toto je simulovaná chyba!", new Error("API Timeout test"));

  return (
    <div className="bg-gray-900 border-t-4 border-teal-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      
      {/* HLAVIČKA */}
      <div 
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-teal-500 mr-3">💾</span> Memory & Console
          </h2>
        </div>

        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* ROZBALENÝ OBSAH */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100 border-t border-gray-800' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-6 md:p-8 space-y-8">
          
          {/* AKČNÉ TLAČIDLÁ PRE PAMÄŤ */}
          <div className="flex flex-wrap gap-3 border-b border-gray-800 pb-6">
            <button onClick={loadEverything} className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all">
              🔄 Refresh Storage
            </button>
            <button onClick={clearLS} className="bg-red-900/20 hover:bg-red-900/50 border border-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all">
              🗑️ Clear LS
            </button>
            <button onClick={clearSS} className="bg-red-900/20 hover:bg-red-900/50 border border-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all">
              🗑️ Clear SS
            </button>
            <button onClick={clearCookies} className="bg-red-900/20 hover:bg-red-900/50 border border-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all">
              🍪 Clear Cookies
            </button>
          </div>

          {/* DUMP PAMÄTE (Cookies, LS, SS) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-black border border-gray-800 p-4 rounded-xl flex flex-col">
              <h3 className="text-teal-400 font-black uppercase tracking-widest text-xs mb-3 flex justify-between">Cookies <span className="text-gray-600">Client-Side</span></h3>
              <pre className="text-[10px] font-mono text-gray-400 overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-gray-800 p-2 bg-gray-900/50 rounded flex-1">
                {storages.cookies === "{}" ? "Žiadne dáta" : storages.cookies}
              </pre>
            </div>
            <div className="bg-black border border-gray-800 p-4 rounded-xl flex flex-col">
              <h3 className="text-teal-400 font-black uppercase tracking-widest text-xs mb-3 flex justify-between">Local Storage <span className="text-gray-600">Persistent</span></h3>
              <pre className="text-[10px] font-mono text-gray-300 overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-gray-800 p-2 bg-gray-900/50 rounded flex-1">
                {storages.ls === "{}" ? "Žiadne dáta" : storages.ls}
              </pre>
            </div>
            <div className="bg-black border border-gray-800 p-4 rounded-xl flex flex-col">
              <h3 className="text-teal-400 font-black uppercase tracking-widest text-xs mb-3 flex justify-between">Session Storage <span className="text-gray-600">Temporary</span></h3>
              <pre className="text-[10px] font-mono text-gray-500 overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-gray-800 p-2 bg-gray-900/50 rounded flex-1">
                {storages.ss === "{}" ? "Žiadne dáta" : storages.ss}
              </pre>
            </div>
          </div>

          {/* LIVE KONZOLA */}
          <div className="bg-black border border-teal-900/50 rounded-xl overflow-hidden flex flex-col mt-8">
            <div className="bg-teal-950/30 p-3 border-b border-teal-900/50 flex justify-between items-center">
              <h3 className="text-teal-500 font-black uppercase tracking-widest text-xs flex items-center gap-2">
                <span className="animate-pulse">🟢</span> Live Console Interceptor
              </h3>
              <div className="flex gap-2">
                <button onClick={fireTestLog} className="text-[9px] font-bold uppercase tracking-widest bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded">Test Log</button>
                <button onClick={fireTestError} className="text-[9px] font-bold uppercase tracking-widest bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded">Test Error</button>
                <button onClick={clearCapturedLogs} className="text-[9px] font-bold uppercase tracking-widest bg-teal-900/50 hover:bg-teal-800 text-teal-300 px-2 py-1 rounded ml-2">Vyčistiť</button>
              </div>
            </div>
            
            <div className="p-4 h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-teal-900/50 bg-[#0d1117] space-y-1 font-mono text-[11px]">
              {consoleLogs.length === 0 ? (
                <div className="text-gray-600 italic mt-2">Čakám na logy... (Zobrazia sa akcie vykonané po otvorení panelu)</div>
              ) : (
                consoleLogs.map((log, i) => (
                  <div key={i} className={`py-1 border-b border-gray-800/50 last:border-0 ${
                    log.type === "error" ? "text-red-400 bg-red-950/10" : 
                    log.type === "warn" ? "text-yellow-400 bg-yellow-950/10" : 
                    "text-gray-300"
                  }`}>
                    <span className="text-gray-600 mr-3 text-[9px]">{log.time}</span>
                    <span className="break-words">{log.message}</span>
                  </div>
                ))
              )}
              {/* Záchytný bod pre auto-scroll */}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
