"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export default function MaintenancePage() {
  const [message, setMessage] = useState("Práve vylepšujeme aplikáciu. Hneď sme späť!");

  useEffect(() => {
    async function fetchMessage() {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();
      
      if (data?.value?.message?.sk) {
        setMessage(data.value.message.sk);
      }
    }
    fetchMessage();
  }, []);

  const handleRefresh = () => {
    // Tvrdý refresh - pokus o návrat do aplikácie
    window.location.href = "/activities";
  };

  return (
    <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center p-6 text-black font-sans overflow-hidden relative">
      
      {/* Varovné pruhy hore a dole */}
      <div className="absolute top-0 left-0 w-full h-8 bg-black flex space-x-4 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="w-12 h-full bg-yellow-400 skew-x-12" />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-8 bg-black flex space-x-4 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="w-12 h-full bg-yellow-400 skew-x-12" />
        ))}
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        
        {/* Ikona bagra a staveniska */}
        <div className="flex justify-center flex-col items-center space-y-4">
          <span className="text-8xl animate-bounce">🚜</span>
          <div className="flex space-x-2">
            <span className="text-4xl">🚧</span>
            <span className="text-4xl">🛠️</span>
            <span className="text-4xl">🚧</span>
          </div>
        </div>

        <div className="bg-black text-yellow-400 p-8 rounded-2xl shadow-2xl border-4 border-black space-y-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-center">
            Pozor! <br /> Prebieha údržba
          </h1>
          
          <div className="h-1 bg-yellow-400 w-full" />

          <p className="text-xl font-bold leading-tight text-center">
            {message}
          </p>

          <button 
            onClick={handleRefresh}
            className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl hover:bg-yellow-300 transition-all active:scale-95 border-b-4 border-yellow-600 uppercase tracking-widest"
          >
            Skúsiť znova (Refresh)
          </button>
        </div>

        <p className="text-center font-black text-black/60 uppercase text-sm tracking-widest">
          SelfRace Construction Crew
        </p>
      </div>
    </div>
  );
}