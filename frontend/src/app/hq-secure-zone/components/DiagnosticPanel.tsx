"use client";
import { useEffect, useState } from "react";
import { getSystemDiagnostics } from "../actions";

export default function DiagnosticPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await getSystemDiagnostics();
        setData(stats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
    // Refresh každých 30 sekúnd
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-4 text-gray-500 animate-pulse border border-gray-800 rounded-2xl">Načítavam diagnostiku...</div>;

  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-start justify-items-center">
        
        {/* USERS */}
        <div className="text-center w-full">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Total Users</p>
          <p className="text-3xl font-black text-white">{data?.totalUsers}</p>
        </div>
        
        {/* STRAVA */}
        <div className="text-center w-full">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Strava Connected</p>
          <p className="text-3xl font-black text-[#FC4C02]">{data?.stravaConnected}</p>
        </div>
        
        {/* PUSH NOTIFICATIONS */}
        <div className="text-center w-full">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Push Subs</p>
          <p className="text-3xl font-black text-blue-500">{data?.pushSubscribers}</p>
        </div>
        
        {/* SUBSCRIPTIONS & TIERS */}
        <div className="text-center w-full flex flex-col items-center">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Active Plans</p>
          <p className="text-3xl font-black text-green-500">{data?.activeSubsTotal}</p>
          
          {/* Vykreslenie malých štítkov pre jednotlivé tiery (classic, pro, atď.) */}
          {data?.tiers && Object.keys(data.tiers).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {Object.entries(data.tiers).map(([tier, count]) => (
                <span key={tier} className="bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-green-900/50">
                  {tier}: {count as number}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* SERVER TIME */}
        <div className="text-center w-full col-span-2 md:col-span-1">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Server Time (UTC)</p>
          <p className="text-lg font-mono text-gray-300 mt-2">{new Date(data?.serverTime).toLocaleTimeString()}</p>
        </div>

      </div>
    </div>
  );
}
