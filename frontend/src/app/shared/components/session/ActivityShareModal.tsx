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

      await new Promise(r => setTimeout(r, 300)); 

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, // Pôvodná vysoká kvalita pre IG 
          useCORS: true,
          backgroundColor: null, // Ponechá priehľadné rohy / farbu z karty
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
      setDebugMsg("Zariadenie nepodporuje zdieľanie. Podrž prst na obrázku hore a ulož si ho.");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      
      {/* Zabalíme to do jedného flex stĺpca. Obrázok HORE, Nastavenia DOLE. Bez zbytočných rámikov. */}
      <div className="w-full max-w-sm flex flex-col items-center max-h-[90vh] overflow-y-auto">
        
        {/* Krížik na zatvorenie umiestnený voľne nad kartou */}
        <div className="w-full max-w-[320px] flex justify-end mb-3">
           <button onClick={onClose} className="text-white/60 hover:text-white bg-black/40 rounded-full w-8 h-8 flex items-center justify-center text-xl backdrop-blur-sm">
             &times;
           </button>
        </div>

        {/* NÁHĽAD OBRÁZKA */}
        <div className="relative flex justify-center w-full mb-6">
            {readyData ? (
              // Vykreslíme priamo už hotový obrázok, s ktorým sa užívateľ môže hrať (uložiť podržaním prsta)
              <img 
                src={readyData.url} 
                alt="Môj tréning" 
                className="w-full max-w-[320px] rounded-[20px] shadow-2xl" 
                style={{ WebkitTouchCallout: "default", userSelect: "none" }}
              />
            ) : (
              // Toto sa vykreslí a odfotí iba na chvíľku, potom sa to nahradí IMG tagom vyššie
              <div className="w-full max-w-[320px]">
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

            {/* Spinner prekrytie, kým prebieha fotenie */}
            {isGenerating && (
              <div className="absolute inset-0 bg-black/60 rounded-[20px] flex items-center justify-center z-50">
                <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                  Vytváram...
                </span>
              </div>
            )}
        </div>

        {/* NASTAVENIA & TLAČIDLO (Obalené v nenápadnom boxe pod kartou) */}
        <div className="w-full max-w-[320px] p-5 bg-[#1a1a1a] rounded-[20px] border border-white/5 flex flex-col gap-3 shadow-xl">
          
          {debugMsg && (
            <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded text-center mb-2">
              {debugMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-2">
            <div className="flex items-center justify-between">
               <span className="text-xs text-white/60">Tep (HR)</span>
               <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} disabled={isGenerating} />
            </div>
            <div className="flex items-center justify-between">
               <span className="text-xs text-white/60">Tempo</span>
               <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} disabled={isGenerating} />
            </div>
            <div className="flex items-center justify-between">
               <span className="text-xs text-white/60">Čas</span>
               <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} disabled={isGenerating} />
            </div>
            <div className="flex items-center justify-between">
               <span className="text-xs text-white/60">Prevýšenie</span>
               <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} disabled={isGenerating} />
            </div>
          </div>
          
          <button 
            className="w-full py-3 mt-1 text-sm font-bold rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors uppercase tracking-wide" 
            onClick={handleShare}
            disabled={isGenerating || !readyData}
          >
            {isGenerating ? "Generujem..." : "Zdieľať na sieťach"}
          </button>
        </div>

      </div>
    </div>
  );
}