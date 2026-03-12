"use client";

import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import ActivityShareCard from "./ActivityShareCard";
import { toast } from "@/app/shared/ui/components/Toast";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showElev, setShowElev] = useState(true);
  const [showTime, setShowTime] = useState(true);

  const [isGenerating, setIsGenerating] = useState(true);
  const [readyData, setReadyData] = useState<{ url: string, file: File } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generateImage = async () => {
      setIsGenerating(true);
      setReadyData(null);

      // ✅ Dáme Safari dostatok času (700ms) na stiahnutie SVG loga a vykreslenie fontov
      await new Promise(r => setTimeout(r, 700)); 

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, 
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
        });

        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            const file = new File([blob], "trening.png", { type: "image/png" });
            const url = canvas.toDataURL("image/png");
            setReadyData({ url, file });
          }
          if (!isCancelled) setIsGenerating(false);
        }, "image/png");

      } catch (err: any) {
        if (!isCancelled) {
          toast.error("Zlyhalo fotenie karty.");
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
          title: "Môj tréning v aplikácii SelfRace",
          files: [readyData.file]
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") toast.error("Zdieľanie zrušené.");
      }
    } else {
      toast.error("Zariadenie nepodporuje natívne zdieľanie. Podrž prst na obrázku a ulož si ho.");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      
      <div className="w-full max-w-sm flex flex-col items-center max-h-[95vh] overflow-y-auto pb-4">
        
        {/* Tlačidlo Zatvoriť */}
        <div className="w-full max-w-[340px] flex justify-end mb-4">
           <button onClick={onClose} className="text-white/60 hover:text-white bg-black/40 rounded-full w-10 h-10 flex items-center justify-center text-2xl backdrop-blur-sm border border-white/10">
             &times;
           </button>
        </div>

        {/* NÁHĽAD OBRÁZKA */}
        <div className="relative flex justify-center w-full mb-6">
            {readyData ? (
              <img 
                src={readyData.url} 
                alt="Náhľad tréningu" 
                className="w-full max-w-[340px] rounded-2xl shadow-2xl" 
                style={{ WebkitTouchCallout: "default", userSelect: "none" }}
              />
            ) : (
              <div className="w-full max-w-[340px]">
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
              <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center z-50">
                <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                  Pripravujem...
                </span>
              </div>
            )}
        </div>

        {/* NASTAVENIA */}
        <div className="w-full max-w-[340px] p-5 bg-[#141414] rounded-[24px] border border-white/10 flex flex-col gap-4 shadow-2xl">
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-1">
            <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} disabled={isGenerating} label="Tep (HR)" />
            <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} disabled={isGenerating} label="Tempo" />
            <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} disabled={isGenerating} label="Čas" />
            <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} disabled={isGenerating} label="Prevýšenie" />
          </div>
          
          <button 
            className="w-full py-3.5 mt-2 text-sm font-bold rounded-[14px] bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors uppercase tracking-widest" 
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