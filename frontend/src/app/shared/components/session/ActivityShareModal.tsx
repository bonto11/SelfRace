"use client";

import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import ActivityShareCard from "./ActivityShareCard";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Stavy pre prepínače metrík
  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showElev, setShowElev] = useState(true);
  const [showTime, setShowTime] = useState(true);

  const [isGenerating, setIsGenerating] = useState(true);
  const [readyData, setReadyData] = useState<{ url: string, file: File } | null>(null);
  const [debugMsg, setDebugMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generateImage = async () => {
      setIsGenerating(true);
      setReadyData(null);
      setDebugMsg("");

      await new Promise(r => setTimeout(r, 400)); 

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, // Pôvodná vysoká kvalita pre IG 
          useCORS: true,
          backgroundColor: "#000000",
        });

        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            const file = new File([blob], "trening.png", { type: "image/png" });
            const url = canvas.toDataURL("image/png");
            setReadyData({ url, file });
          } else {
            if (!isCancelled) setDebugMsg("Chyba vytvorenia súboru.");
          }
          if (!isCancelled) setIsGenerating(false);
        }, "image/png");

      } catch (err: any) {
        if (!isCancelled) {
          setDebugMsg("Zlyhalo fotenie: " + err.message);
          setIsGenerating(false);
        }
      }
    };

    generateImage();
    return () => { isCancelled = true; };
  }, [isOpen, showHr, showPace, showElev, showTime, activity, summary]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!readyData) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Môj tréning",
          files: [readyData.file]
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") setDebugMsg("Zdieľanie zrušené/zlyhalo.");
      }
    } else {
      setDebugMsg("Web Share API nie je dostupné. Podrž prst na obrázku pre uloženie.");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      {/* Vždy limitujeme šírku a výšku, aby to na malom iPhone nepretieklo */}
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] flex-shrink-0">
          <h3 className="font-bold text-white tracking-wide">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* NÁHĽAD OBRÁZKA - Tu sa to dá pekne scrollovať ak treba */}
        <div className="overflow-y-auto flex-grow bg-black">
          <div className="p-4 flex justify-center items-center relative">
            
            {readyData ? (
              <img 
                src={readyData.url} 
                alt="Môj tréning" 
                className="w-full max-w-[320px] aspect-square border border-white/20 shadow-lg rounded-md" 
                style={{ WebkitTouchCallout: "default", userSelect: "none" }}
              />
            ) : (
              <div className="w-full max-w-[320px] aspect-square flex-shrink-0">
                 <ActivityShareCard 
                   cardRef={cardRef} 
                   activity={activity} 
                   summary={summary} 
                   showHr={showHr} 
                   showPace={showPace}
                   showElev={showElev}
                   showTime={showTime}
                 />
              </div>
            )}

            {isGenerating && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                  Vytváram...
                </span>
              </div>
            )}
          </div>

          {/* NASTAVENIA */}
          <div className="px-5 py-4 bg-[#1a1a1a] flex flex-col gap-3">
            
            {debugMsg && (
              <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded text-center border border-red-500/20">
                {debugMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="flex items-center justify-between">
                 <span className="text-xs text-white/70">Tep (HR)</span>
                 <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} disabled={isGenerating} />
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-xs text-white/70">Tempo</span>
                 <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} disabled={isGenerating} />
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-xs text-white/70">Čas</span>
                 <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} disabled={isGenerating} />
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-xs text-white/70">Prevýšenie</span>
                 <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} disabled={isGenerating} />
              </div>
            </div>
            
            <button 
              className="w-full py-3 mt-2 text-base font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors" 
              onClick={handleShare}
              disabled={isGenerating || !readyData}
            >
              {isGenerating ? "Generujem..." : "Zdieľať na Instagram / Poslať"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}