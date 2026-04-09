"use client";
import { useEffect, useState } from "react";
import { getSystemDiagnostics } from "../actions";

export default function DiagnosticPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

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
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-900 border-t-4 border-purple-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      
      {/* HLAVIČKA */}
      <div 
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-purple-500 mr-3">📊</span> Diagnostics & Users
          </h2>
          {/* Rýchly indikátor v zbalenom stave */}
          {!isOpen && data && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-purple-900/30 text-purple-500 hidden sm:inline-block">
              {data.totalUsers} Reg / {data.stravaConnected} Strava
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {loading && !data && (
            <span className="text-purple-500 text-xs font-black uppercase animate-pulse">Sťahujem...</span>
          )}
          <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {/* ROZBALENÝ OBSAH */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[3000px] opacity-100 border-t border-gray-800' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-6 md:p-8 space-y-10">
          
          {/* SUMÁR (Grid) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-start justify-items-center">
            <div className="text-center w-full">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Total Users</p>
              <p className="text-3xl font-black text-white">{data?.totalUsers || 0}</p>
            </div>
            
            <div className="text-center w-full">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Strava Connected</p>
              <p className="text-3xl font-black text-[#FC4C02]">{data?.stravaConnected || 0}</p>
            </div>
            
            <div className="text-center w-full">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Push Subs (Users)</p>
              <p className="text-3xl font-black text-blue-500">{data?.pushSubscribers || 0}</p>
            </div>
            
            <div className="text-center w-full flex flex-col items-center">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Active Plans</p>
              <p className="text-3xl font-black text-green-500">{data?.activeSubsTotal || 0}</p>
              
              {/* Tiers labels */}
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

            <div className="text-center w-full col-span-2 md:col-span-1">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Server Time (UTC)</p>
              <p className="text-lg font-mono text-gray-400 mt-2">
                {data?.serverTime ? new Date(data.serverTime).toLocaleTimeString() : '--:--:--'}
              </p>
            </div>
          </div>

          {/* DETAILNÁ TABUĽKA POUŽÍVATEĽOV */}
          {data?.userDetails && data.userDetails.length > 0 && (
            <div className="pt-8 border-t border-gray-800">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                👥 User Registry (Internal ID Link)
              </h3>
              
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-left text-xs font-mono whitespace-nowrap">
                  <thead className="bg-gray-800 text-gray-400 uppercase tracking-widest text-[10px]">
                    <tr>
                      <th className="p-3 pl-4">INT ID</th>
                      <th className="p-3">Email / Identity</th>
                      <th className="p-3 text-center">Strava (Athlete)</th>
                      <th className="p-3 text-center">Push</th>
                      <th className="p-3 text-center pr-4">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-black/30">
                    {data.userDetails.map((u: any) => (
                      <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="p-3 pl-4 text-purple-500 font-bold">#{u.id}</td>
                        <td className="p-3 text-gray-300">{u.email}</td>
                        <td className="p-3 text-center">
                          {u.stravaId ? (
                            <span className="text-[#FC4C02] font-bold bg-[#FC4C02]/10 px-2 py-1 rounded border border-[#FC4C02]/20">
                              🧡 {u.stravaId}
                            </span>
                          ) : (
                            <span className="text-gray-700 opacity-30 italic">Not linked</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {u.hasPush ? (
                            <span className="text-blue-500 font-bold">YES</span>
                          ) : (
                            <span className="text-gray-700">NO</span>
                          )}
                        </td>
                        <td className="p-3 text-center pr-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter border ${
                            u.tier !== 'free' 
                            ? 'bg-green-900/30 text-green-400 border-green-900/50' 
                            : 'bg-gray-800 text-gray-600 border-gray-700'
                          }`}>
                            {u.tier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
