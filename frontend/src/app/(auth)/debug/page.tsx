"use client";

import { useState, useEffect } from "react";

export default function DebugPage() {
  const [storages, setStorages] = useState({
    ls: "Načítavam...",
    ss: "Načítavam...",
    cookies: "Načítavam...",
  });

  const loadEverything = () => {
    // 1. LocalStorage
    const lsData = { ...window.localStorage };
    
    // 2. SessionStorage
    const ssData = { ...window.sessionStorage };
    
    // 3. Cookies
    const cookiesData = document.cookie.split('; ').reduce((acc: any, current) => {
      const [name, ...value] = current.split('=');
      if (name) acc[name] = decodeURIComponent(value.join('='));
      return acc;
    }, {});

    setStorages({
      ls: JSON.stringify(lsData, null, 2),
      ss: JSON.stringify(ssData, null, 2),
      cookies: JSON.stringify(cookiesData, null, 2),
    });
  };

  useEffect(() => {
    loadEverything();
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">PWA Scanner pamäte</h1>
      <button onClick={loadEverything} className="bg-blue-600 px-4 py-2 rounded font-bold mb-6">
        Obnoviť (Refresh)
      </button>

      <div className="space-y-6">
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
          <h2 className="text-blue-400 font-bold mb-2">Cookies (Základ pre Supabase):</h2>
          <pre className="text-xs overflow-auto text-green-400">{storages.cookies}</pre>
        </div>
        
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
          <h2 className="text-blue-400 font-bold mb-2">LocalStorage:</h2>
          <pre className="text-xs overflow-auto text-gray-300">{storages.ls}</pre>
        </div>
      </div>
    </div>
  );
}