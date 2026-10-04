"use client";
import { useState } from "react";
import { triggerMaintenanceTask } from "../actions";

type Cohort = {
  cohort_week: string;
  signups: number;
  started: number;
  trains_w4: number;
  uses_w4: number;
  trains_w4_pct: number | null;
  uses_w4_pct: number | null;
  uses_w4_of_started_pct: number | null;
};

type RetentionData = {
  cohorts: Cohort[];
  total: {
    signups: number;
    started: number;
    trains_w4: number;
    uses_w4: number;
    uses_w4_of_started_pct: number | null;
  };
  generated_at: string;
};

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v} %`);

// Farba podľa toho, koľko začatých userov appku v 4. týždni stále používa.
const usesColor = (v: number | null) =>
  v == null
    ? "text-gray-500"
    : v >= 40
      ? "text-emerald-400"
      : v >= 20
        ? "text-yellow-400"
        : "text-red-400";

export default function RetentionPanel() {
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Výpočet robí veľa dotazov - spúšťa sa až po otvorení, nie automaticky.
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await triggerMaintenanceTask("retention-stats");
      setData((json?.data as RetentionData) ?? null);
    } catch (e: any) {
      setError(e?.message || "Nepodarilo sa načítať udržanie userov.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !data && !loading) void load();
  };

  return (
    <div className="bg-gray-900 border-t-4 border-emerald-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <div
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-emerald-500 mr-3">📈</span> Retention
          </h2>
          {!isOpen && data && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-emerald-900/30 text-emerald-500 hidden sm:inline-block">
              4. týždeň: {pct(data.total.uses_w4_of_started_pct)} začatých používa appku
            </span>
          )}
        </div>
        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="p-6 md:p-8 space-y-6 border-t border-gray-800">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="bg-emerald-600/20 border border-emerald-600/50 hover:bg-emerald-600/40 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? "🔄 Počítam..." : "🔄 Prepočítať"}
            </button>
            {data?.generated_at && (
              <span className="text-[10px] text-gray-500">
                {new Date(data.generated_at).toLocaleString("sk-SK")}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Kohorty podľa týždňa registrácie (len staršie ako 28 dní).{" "}
            <b className="text-gray-300">Začal</b> = naimportovali sa mu aktivity.{" "}
            <b className="text-gray-300">Trénuje</b> = mal aktivitu v 4. týždni (Strava ju pošle aj tomu, kto appku neotvára).{" "}
            <b className="text-gray-300">Používa</b> = v 4. týždni si sám niečo vyžiadal od AI - to je hlavné číslo.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-xs">{error}</div>
          )}

          {data && data.cohorts.length === 0 && !loading && (
            <div className="text-xs text-gray-500">Zatiaľ žiadna kohorta staršia ako 28 dní.</div>
          )}

          {data && data.cohorts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-500 text-right">
                    <th className="text-left py-2 pr-3">Týždeň</th>
                    <th className="py-2 px-2">Registr.</th>
                    <th className="py-2 px-2">Začal</th>
                    <th className="py-2 px-2">Trénuje</th>
                    <th className="py-2 px-2">Používa</th>
                    <th className="py-2 pl-2">Používa / začal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((c) => (
                    <tr key={c.cohort_week} className="border-t border-gray-800 text-right text-gray-300">
                      <td className="text-left py-2 pr-3 font-bold">{c.cohort_week}</td>
                      <td className="py-2 px-2">{c.signups}</td>
                      <td className="py-2 px-2">{c.started}</td>
                      <td className="py-2 px-2">
                        {c.trains_w4} <span className="text-gray-500">({pct(c.trains_w4_pct)})</span>
                      </td>
                      <td className="py-2 px-2">
                        {c.uses_w4} <span className="text-gray-500">({pct(c.uses_w4_pct)})</span>
                      </td>
                      <td className={`py-2 pl-2 font-black ${usesColor(c.uses_w4_of_started_pct)}`}>
                        {pct(c.uses_w4_of_started_pct)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-700 text-right text-white font-black">
                    <td className="text-left py-2 pr-3">Spolu</td>
                    <td className="py-2 px-2">{data.total.signups}</td>
                    <td className="py-2 px-2">{data.total.started}</td>
                    <td className="py-2 px-2">{data.total.trains_w4}</td>
                    <td className="py-2 px-2">{data.total.uses_w4}</td>
                    <td className={`py-2 pl-2 ${usesColor(data.total.uses_w4_of_started_pct)}`}>
                      {pct(data.total.uses_w4_of_started_pct)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
