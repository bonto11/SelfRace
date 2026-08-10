"use client";
import { useState } from "react";
import { apiFetchAiModels, type AiModelsData } from "../api/ai_providers";

export default function ProvidersPanel() {
  const [models, setModels] = useState<AiModelsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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

  const renderConfiguredModels = (configured: string[], available: string[]) => {
    if (!configured || configured.length === 0) {
      return <div className="text-gray-600 text-xs italic mb-4">Žiadne modely v konfigurácii.</div>;
    }
    return (
      <div className="mb-6 space-y-2 border-b border-gray-800 pb-6">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3">
          Aktuálna konfigurácia (.env)
        </p>
        {configured.map(m => {
          const isValid = available.includes(m);
          return (
            <div key={`cfg-${m}`} className={`flex justify-between items-center p-3 rounded-lg border transition-all ${isValid ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/40 shadow-[0_0_15px_rgba(220,38,38,0.15)]'}`}>
              <span className={`text-sm font-mono ${isValid ? 'text-white' : 'text-red-100 font-bold'}`}>
                {m}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${isValid ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500 animate-pulse'}`}>
                {isValid ? '✅ Valid' : '❌ Invalid'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-gray-900 border-t-4 border-green-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      
      {/* HLAVIČKA */}
      <div 
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-green-500 mr-3">🧠</span> AI Providers
          </h2>
          {/* Rýchly indikátor v zbalenom stave */}
          {!isOpen && models && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-green-900/30 text-green-500">
              {models.openai.length + models.gemini.length + models.claude.length} Modulov
            </span>
          )}
        </div>

        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* ROZBALENÝ OBSAH */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100 border-t border-gray-800' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-6 md:p-8 space-y-6">
          
          {/* TLAČIDLO NA NAČÍTANIE (Na celú šírku ako pri ostatných paneloch) */}
          <button 
            onClick={handleLoadModels} 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-green-900/20"
          >
            {loading ? "Komunikujem s API..." : "Načítať zoznam a overiť modely"}
          </button>

          {!models && !loading && (
            <div className="text-center p-8 border border-gray-800 border-dashed rounded-xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/50">
              Zoznam je prázdny. Klikni na tlačidlo vyššie pre overenie kľúčov a stiahnutie.
            </div>
          )}

          {models && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CLAUDE */}
              <div className="bg-black border border-gray-800 p-5 rounded-2xl flex flex-col">
                <h3 className="text-orange-400 font-black uppercase tracking-widest mb-4 flex justify-between items-center border-b border-gray-800 pb-3">
                  Anthropic Claude
                  <span className="bg-orange-900/30 text-orange-500 px-2 py-1 rounded text-xs">
                    {models.claude.length} available
                  </span>
                </h3>
              
                {renderConfiguredModels(models.configured.claude, models.claude)}
              
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Ostatné dostupné modely (statický zoznam):</p>
                <div className="flex-1 overflow-y-auto max-h-64 pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                  {models.claude.length === 0 ? (
                    <span className="text-gray-600 text-sm italic">Žiadne dostupné modely</span>
                  ) : (
                    models.claude.filter(m => !models.configured.claude.includes(m)).map(m => (
                      <div key={m} className="bg-gray-900 p-2.5 rounded-lg text-xs font-mono text-gray-400 border border-gray-800 hover:border-orange-500 hover:text-orange-400 transition-colors cursor-default">
                        {m}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* GEMINI */}
              <div className="bg-black border border-gray-800 p-5 rounded-2xl flex flex-col">
                <h3 className="text-blue-400 font-black uppercase tracking-widest mb-4 flex justify-between items-center border-b border-gray-800 pb-3">
                  Google Gemini 
                  <span className="bg-blue-900/30 text-blue-500 px-2 py-1 rounded text-xs">
                    {models.gemini.length} available
                  </span>
                </h3>
                
                {renderConfiguredModels(models.configured.gemini, models.gemini)}

                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Ostatné dostupné modely z API:</p>
                <div className="flex-1 overflow-y-auto max-h-64 pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                  {models.gemini.length === 0 ? (
                    <span className="text-gray-600 text-sm italic">Žiadne dostupné modely</span>
                  ) : (
                    models.gemini.filter(m => !models.configured.gemini.includes(m)).map(m => (
                      <div key={m} className="bg-gray-900 p-2.5 rounded-lg text-xs font-mono text-gray-400 border border-gray-800 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-default">
                        {m}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* OPENAI */}
              <div className="bg-black border border-gray-800 p-5 rounded-2xl flex flex-col">
                <h3 className="text-green-400 font-black uppercase tracking-widest mb-4 flex justify-between items-center border-b border-gray-800 pb-3">
                  OpenAI 
                  <span className="bg-green-900/30 text-green-500 px-2 py-1 rounded text-xs">
                    {models.openai.length} available
                  </span>
                </h3>
                
                {renderConfiguredModels(models.configured.openai, models.openai)}

                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Ostatné dostupné modely z API:</p>
                <div className="flex-1 overflow-y-auto max-h-64 pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                  {models.openai.length === 0 ? (
                    <span className="text-gray-600 text-sm italic">Žiadne dostupné modely</span>
                  ) : (
                    models.openai.filter(m => !models.configured.openai.includes(m)).map(m => (
                      <div key={m} className="bg-gray-900 p-2.5 rounded-lg text-xs font-mono text-gray-400 border border-gray-800 hover:border-green-500 hover:text-green-400 transition-colors cursor-default">
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
                    <span>⚠️</span> Zistené problémy s pripojením
                  </h4>
                  <ul className="list-disc list-inside text-red-400 text-sm space-y-2 ml-2 font-mono">
                    {models.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
