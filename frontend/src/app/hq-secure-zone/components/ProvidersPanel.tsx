"use client";
import { useState } from "react";
import { apiFetchAiModels, type AiModelsData } from "../api/ai_providers";

export default function ProvidersPanel() {
  const [models, setModels] = useState<AiModelsData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoadModels = async () => {
    setLoading(true);
    try {
      const data = await apiFetchAiModels();
      setModels(data);
    } catch (err: any) {
      alert(`❌ Chyba: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border-t-4 border-green-500 p-8 rounded-b-2xl shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic">
          <span className="text-green-500">🧠</span> AI Providers
        </h2>
        <button 
          onClick={handleLoadModels} 
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-widest px-4 py-3 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-green-900/20"
        >
          {loading ? "Komunikujem s API..." : "Načítať zoznam modelov z API"}
        </button>
      </div>

      {!models && !loading && (
        <div className="text-center p-8 border border-gray-800 border-dashed rounded-xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/50">
          Zoznam je prázdny. Klikni na tlačidlo pre overenie kľúčov a stiahnutie.
        </div>
      )}

      {models && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          
          {/* GEMINI */}
          <div className="bg-black border border-gray-800 p-5 rounded-2xl">
            <h3 className="text-blue-400 font-black uppercase tracking-widest mb-4 flex justify-between items-center border-b border-gray-800 pb-3">
              Google Gemini 
              <span className="bg-blue-900/30 text-blue-500 px-2 py-1 rounded text-xs">
                {models.gemini.length}
              </span>
            </h3>
            <div className="h-72 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {models.gemini.length === 0 ? (
                <span className="text-gray-600 text-sm italic">Žiadne modely</span>
              ) : (
                models.gemini.map(m => (
                  <div key={m} className="bg-gray-900 p-2.5 rounded-lg text-xs font-mono text-gray-300 border border-gray-800 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-default">
                    {m}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* OPENAI */}
          <div className="bg-black border border-gray-800 p-5 rounded-2xl">
            <h3 className="text-green-400 font-black uppercase tracking-widest mb-4 flex justify-between items-center border-b border-gray-800 pb-3">
              OpenAI 
              <span className="bg-green-900/30 text-green-500 px-2 py-1 rounded text-xs">
                {models.openai.length}
              </span>
            </h3>
            <div className="h-72 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {models.openai.length === 0 ? (
                <span className="text-gray-600 text-sm italic">Žiadne modely</span>
              ) : (
                models.openai.map(m => (
                  <div key={m} className="bg-gray-900 p-2.5 rounded-lg text-xs font-mono text-gray-300 border border-gray-800 hover:border-green-500 hover:text-green-400 transition-colors cursor-default">
                    {m}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* CHYBY */}
          {models.errors.length > 0 && (
            <div className="col-span-1 md:col-span-2 bg-red-950/20 border border-red-900/50 p-5 rounded-2xl">
              <h4 className="text-red-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>⚠️</span> Zistené problémy
              </h4>
              <ul className="list-disc list-inside text-red-400 text-sm space-y-2 ml-2 font-mono">
                {models.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}