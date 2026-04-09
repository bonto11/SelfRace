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
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row gap-6 items-center justify-around">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Total Users</p>
        <p className="text-4xl font-black text-white">{data?.totalUsers}</p>
      </div>
      <div className="w-px h-12 bg-gray-800 hidden md:block"></div>
      <div className="text-center">
        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Push Subscribers</p>
        <p className="text-4xl font-black text-blue-500">{data?.pushSubscribers}</p>
      </div>
      <div className="w-px h-12 bg-gray-800 hidden md:block"></div>
      <div className="text-center">
        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Server Time (UTC)</p>
        <p className="text-lg font-mono text-gray-300">{new Date(data?.serverTime).toLocaleTimeString()}</p>
      </div>
    </div>
  );
}