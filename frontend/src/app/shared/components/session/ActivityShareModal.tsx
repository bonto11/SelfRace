"use client";

import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import ActivityShareCard from "./ActivityShareCard";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [showHr, setShowHr] = useState(true);
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

      // Čakáme, kým sa DOM usadí
      await new Promise(r => setTimeout(r, 500)); 

      if (!cardRef.current || isCancelled) return;

      try {
        // Znížili sme scale na 2, aby sme predišli zlyhaniu pamäte na iPhone
        const canvas = await html2canvas(cardRef.current, {
          scale: 2, 
          useCORS: true,
          backgroundColor: "#000000",
        });

        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            const file = new File([blob], "trening.png", { type: "image/png" });
            const url = canvas.toDataURL("image/png");
            setReadyData({ url, file });
          } else {
            if (!isCancelled) setDebugMsg("Chyba: Blob je prázdny.");
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
  }, [isOpen, showHr, activity, summary]);

  if (!isOpen) return null;

  // Čistá, synchrónna natívna funkcia pre zdieľanie
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
      setDebugMsg("Web Share API nie je dostupné. Ulož obrázok podržaním prsta.");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl">
        
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] sticky top-0 z-50">
          <h3 className="font-bold text-white tracking-wide">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* NÁHĽAD OBRÁZKA */}
        <div className="bg-black p-4 flex justify-center items-center relative min-h-[360px] overflow-hidden">
          
          {readyData ? (
            // ✅ Na iPhone MUSÍ BYŤ WebkitTouchCallout zapnuté, aby fungoval long-press
            <img 
              src={readyData.url} 
              alt="Môj tréning" 
              className="w-full h-auto max-w-[360px] border border-white/20 shadow-lg rounded-md" 
              style={{ WebkitTouchCallout: "default", userSelect: "none" }}
            />
          ) : (
            // Skryté generovanie - plná veľkosť 360x360 bez zmenšovania
            <div className="w-[360px] h-[360px] flex-shrink-0">
               <ActivityShareCard 
                 cardRef={cardRef} 
                 activity={activity} 
                 summary={summary} 
                 showHr={showHr} 
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

        <div className="px-5 py-5 bg-[#1a1a1a] flex flex-col gap-4 border-t border-white/10">
          
          {debugMsg && (
            <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded text-center border border-red-500/20">
              {debugMsg}
            </div>
          )}

          {readyData && (
            <div className="text-[11px] text-white/50 text-center uppercase tracking-wider mb-2 leading-relaxed">
              Tip pre iPhone: Podrž prst dlho na obrázku <br/> a vyber <strong className="text-white">Uložiť do Fotiek</strong>.
            </div>
          )}

          <div className="flex items-center justify-between">
             <span className="text-sm text-white/70 font-medium">Zobraziť srdcový tep (HR)</span>
             <Checkbox 
              checked={showHr} 
              onChange={(e) => setShowHr(e.currentTarget.checked)} 
              disabled={isGenerating}
            />
          </div>
          
          {/* ✅ SUROVÝ HTML BUTTON obchádza všetky UI oneskorenia a spúšťa Share okamžite */}
          <button 
            className="w-full py-3 text-base font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
            onClick={handleShare}
            disabled={isGenerating || !readyData}
          >
            {isGenerating ? "Generujem..." : "Zdieľať / Poslať"}
          </button>
        </div>

      </div>
    </div>
  );
}