"use client";
import { useState } from "react";
import { triggerMaintenanceTask } from "../actions";

type WelcomeRow = {
  user_id: number;
  email: string;
  kind: "activities" | "plan";
  from: string;
  to: string;
  active: boolean;
  reviews: number;
  input_tokens: number;
  output_tokens: number;
  est_usd: number;
};

type WelcomeData = {
  rows: WelcomeRow[];
  active_count: number;
  totals: {
    reviews: number;
    input_tokens: number;
    output_tokens: number;
    est_usd: number;
  };
  lookback_days: number;
  generated_at: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });

const fmtTokens = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const KIND_LABEL: Record<WelcomeRow["kind"], string> = {
  activities: "Nový účet",
  plan: "Nový plán",
};

export default function WelcomeWeekPanel() {
  const [data, setData] = useState<WelcomeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await triggerMaintenanceTask("welcome-week-status");
      setData((json?.data as WelcomeData) ?? null);
    } catch (e: any) {
      setError(e?.message || "Nepodarilo sa načítať uvítací týždeň.");
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
    <div className="bg-gray-900 border-t-4 border-amber-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <div
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-amber-500 mr-3">🎁</span> Welcome Week
          </h2>
          {!isOpen && data && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-amber-900/30 text-amber-500 hidden sm:inline-block">
              Aktívnych {data.active_count} · ~${data.totals.est_usd.toFixed(2)}
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
              className="bg-amber-600/20 border border-amber-600/50 hover:bg-amber-600/40 text-amber-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? "🔄 Načítavam..." : "🔄 Obnoviť"}
            </button>
            {data?.generated_at && (
              <span className="text-[10px] text-gray-500">
                {new Date(data.generated_at).toLocaleString("sk-SK")}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Useri, ktorým každú novú aktivitu AI hodnotí automaticky a zadarmo.{" "}
            <b className="text-gray-300">Nový účet</b> = 7 dní od prvej aktivity (účet mladší ako 14 dní).{" "}
            <b className="text-gray-300">Nový plán</b> = prvých 7 dní aktívneho plánu.
            Spotreba je zalogovaná (billed_via = welcome_free), ale do limitu usera sa nepočíta.
            Zobrazené sú okná za posledných {data?.lookback_days ?? 14} dní, cena je len odhad.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-xs">{error}</div>
          )}

          {data && data.rows.length === 0 && !loading && (
            <div className="text-xs text-gray-500">Momentálne nikto nemá uvítací týždeň.</div>
          )}

          {data && data.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-500 text-right">
                    <th className="text-left py-2 pr-3">User</th>
                    <th className="text-left py-2 px-2">Typ</th>
                    <th className="text-left py-2 px-2">Od – do</th>
                    <th className="py-2 px-2">Hodnotení</th>
                    <th className="py-2 px-2">Tokeny in / out</th>
                    <th className="py-2 pl-2">~USD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr
                      key={`${r.user_id}-${r.kind}-${r.from}`}
                      className={`border-t border-gray-800 text-right ${r.active ? "text-gray-200" : "text-gray-500"}`}
                    >
                      <td className="text-left py-2 pr-3">
                        <div className="font-bold">{r.email || `#${r.user_id}`}</div>
                        <div className="text-[10px] text-gray-500">ID {r.user_id}</div>
                      </td>
                      <td className="text-left py-2 px-2 whitespace-nowrap">
                        {KIND_LABEL[r.kind]}
                        {r.active && (
                          <span className="ml-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            aktívny
                          </span>
                        )}
                      </td>
                      <td className="text-left py-2 px-2 whitespace-nowrap">
                        {fmtDate(r.from)} – {fmtDate(r.to)}
                      </td>
                      <td className="py-2 px-2">{r.reviews}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {fmtTokens(r.input_tokens)} / {fmtTokens(r.output_tokens)}
                      </td>
                      <td className="py-2 pl-2">{r.est_usd.toFixed(3)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-700 text-right text-white font-black">
                    <td className="text-left py-2 pr-3" colSpan={3}>Spolu</td>
                    <td className="py-2 px-2">{data.totals.reviews}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {fmtTokens(data.totals.input_tokens)} / {fmtTokens(data.totals.output_tokens)}
                    </td>
                    <td className="py-2 pl-2">{data.totals.est_usd.toFixed(3)}</td>
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
