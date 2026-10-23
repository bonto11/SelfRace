"use client";
import { useState } from "react";
import { addBetaUser, getFeatureFlags, removeBetaUser, setFeatureStage } from "../actions";

/*
 * Funkcie (feature flags): komu je rozpracovaná funkcia vidieť.
 * Zoznam funkcií je v kóde (Backend/Configs/features.py), tu sa mení len
 * stupeň a jedna spoločná beta skupina.
 */

type Stage = "off" | "admin" | "beta" | "all";

type Feature = { key: string; stage: Stage; default_stage: Stage };
type BetaUser = { id: number; email: string | null; name: string | null; missing: boolean };
type FeaturesData = { stages: Stage[]; features: Feature[]; beta_users: BetaUser[] };

const STAGE_LABEL: Record<Stage, string> = {
  off: "Vypnuté",
  admin: "Admin",
  beta: "Beta",
  all: "Všetci",
};

const STAGE_COLOR: Record<Stage, string> = {
  off: "bg-gray-700 text-gray-200 border-gray-500",
  admin: "bg-red-900/60 text-red-200 border-red-500",
  beta: "bg-amber-900/60 text-amber-200 border-amber-500",
  all: "bg-emerald-900/60 text-emerald-200 border-emerald-500",
};

// popis pre admina – kľúče sú z BE
const FEATURE_LABEL: Record<string, string> = {
  trainer: "Živý tréner",
  nutrition: "Výživa",
};

const ERRORS: Record<string, string> = {
  user_not_found: "Taký user neexistuje (zadaj ID alebo e-mail).",
  unknown_feature: "Neznáma funkcia.",
  invalid_stage: "Neplatný stupeň.",
};

export default function FeatureFlagsPanel() {
  const [data, setData] = useState<FeaturesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [betaInput, setBetaInput] = useState("");

  const apply = (res: any) => {
    if (res?.success && res.data) {
      setData(res.data as FeaturesData);
      setError(null);
      return true;
    }
    const code = res?.error_code || "unknown";
    setError(ERRORS[code] || `Chyba: ${code}`);
    return false;
  };

  const load = async () => {
    setLoading(true);
    try {
      apply(await getFeatureFlags());
    } catch (e: any) {
      setError(e?.message || "Nepodarilo sa načítať funkcie.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !data && !loading) void load();
  };

  const changeStage = async (key: string, stage: Stage) => {
    setBusy(`stage:${key}`);
    try {
      apply(await setFeatureStage(key, stage));
    } catch (e: any) {
      setError(e?.message || "Uloženie zlyhalo.");
    } finally {
      setBusy(null);
    }
  };

  const addBeta = async () => {
    const v = betaInput.trim();
    if (!v) return;
    setBusy("beta:add");
    try {
      if (apply(await addBetaUser(v))) setBetaInput("");
    } catch (e: any) {
      setError(e?.message || "Pridanie zlyhalo.");
    } finally {
      setBusy(null);
    }
  };

  const removeBeta = async (id: number) => {
    setBusy(`beta:${id}`);
    try {
      apply(await removeBetaUser(id));
    } catch (e: any) {
      setError(e?.message || "Odobratie zlyhalo.");
    } finally {
      setBusy(null);
    }
  };

  const stages = data?.stages ?? (["off", "admin", "beta", "all"] as Stage[]);

  return (
    <div className="bg-gray-900 border-t-4 border-fuchsia-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <div
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-fuchsia-500 mr-3">🚦</span> Funkcie
          </h2>
          {!isOpen && data && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-fuchsia-900/30 text-fuchsia-400 hidden sm:inline-block">
              Beta: {data.beta_users.length} userov
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
        <div className="p-6 md:p-8 space-y-8 border-t border-gray-800">
          <p className="text-xs text-gray-400 leading-relaxed">
            Nová funkcia je predvolene len pre admina. Beta = admin + beta skupina nižšie. Zmena platí na BE hneď,
            userovi v appke po ďalšom otvorení.
          </p>

          {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}
          {loading && !data && <div className="text-sm text-gray-400">Načítavam…</div>}

          {data && (
            <div className="space-y-3">
              {data.features.map((f) => (
                <div
                  key={f.key}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-950/60 border border-gray-800 rounded-xl p-4"
                >
                  <div>
                    <div className="font-bold text-white">{FEATURE_LABEL[f.key] ?? f.key}</div>
                    <div className="text-[11px] text-gray-500 font-mono">
                      {f.key} · predvolene {STAGE_LABEL[f.default_stage]}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stages.map((s) => {
                      const active = f.stage === s;
                      return (
                        <button
                          key={s}
                          disabled={busy != null || active}
                          onClick={() => changeStage(f.key, s)}
                          className={[
                            "text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all",
                            active ? STAGE_COLOR[s] : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500",
                            busy === `stage:${f.key}` ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          {STAGE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && (
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Beta skupina</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={betaInput}
                  onChange={(e) => setBetaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addBeta();
                  }}
                  placeholder="ID alebo e-mail"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
                <button
                  onClick={addBeta}
                  disabled={busy != null || !betaInput.trim()}
                  className="bg-amber-600/20 border border-amber-600/50 hover:bg-amber-600/40 text-amber-300 text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {busy === "beta:add" ? "Pridávam…" : "+ Pridať"}
                </button>
              </div>

              {data.beta_users.length ? (
                <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
                  {data.beta_users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2 bg-gray-950/40">
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">
                          #{u.id} {u.name ? `· ${u.name}` : ""}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {u.missing ? "user neexistuje" : u.email || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => removeBeta(u.id)}
                        disabled={busy != null}
                        className="text-[11px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {busy === `beta:${u.id}` ? "…" : "Odobrať"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Beta skupina je prázdna.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
