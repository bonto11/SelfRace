"use client";

import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import ActivityShareCard from "./ActivityShareCard";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [showHr, setShowHr] = useState(true);
  const [isGenerating, setIsGenerating] = useState(true);
  const [readyFile, setReadyFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generateImageInBackground = async () => {
      setIsGenerating(true);
      setReadyFile(null);

      await new Promise(r => setTimeout(r, 600)); 

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, 
          useCORS: true,
          backgroundColor: "#000000",
        });

        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            const file = new File([blob], "selfrace-trening.png", { type: "image/png" });
            setReadyFile(file);
          }
          if (!isCancelled) setIsGenerating(false);
        }, "image/png");
      } catch (err: any) {
        if (!isCancelled) setIsGenerating(false);
      }
    };

    generateImageInBackground();
    return () => { isCancelled = true; };
  }, [isOpen, showHr, activity, summary]);

  if (!isOpen) return null;

  // 🔴 AGRESÍVNY TEST (Iba text, použité alerty namiesto toastov)
  const handleTestShare = async () => {
    try {
      if (!navigator.share) {
        alert("CHYBA: Tvoj prehliadač vôbec nepodporuje Web Share API (navigator.share neexistuje).");
        return;
      }

      await navigator.share({
        title: "Test SelfRace",
        text: "Ak vidíš túto správu, zdieľanie v PWA funguje perfektne!",
        url: window.location.origin
      });
      // Ak prejde, neukazujeme alert, lebo iOS už ukazuje natívne okno
    } catch (e: any) {
      if (e.name !== "AbortError") {
        alert("TEST ZLYHAL s chybou: " + e.message);
      }
    }
  };

  // 🟢 HLAVNÉ TLAČIDLO (Obrázok)
  const handleShareSync = async () => {
    if (!readyFile) {
      alert("POZOR: Obrázok ešte nie je pripravený. Možno zlyhal html2canvas.");
      return;
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [readyFile] })) {
      try {
        await navigator.share({
          title: "Môj tréning",
          files: [readyFile]
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") alert("Zdieľanie OBRÁZKA zlyhalo: " + e.message);
      }
    } else {
      alert("Tvoj telefón nevie zdieľať SÚBORY. Skúsim ti ho stiahnuť do mobilu...");
      try {
        const url = URL.createObjectURL(readyFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = "selfrace-trening.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
      } catch (dlErr) {
         alert("Zlyhalo aj stiahnutie.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
        
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] sticky top-0 z-50">
          <h3 className="font-bold text-white tracking-wide">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/20">
          <Button 
            variant="secondary" 
            className="w-full py-2 bg-yellow-500 text-black font-bold hover:bg-yellow-400 border-none" 
            onClick={handleTestShare}
          >
            TEST: Zdieľať len text (Klikni najprv na toto)
          </Button>
        </div>

        <div className="bg-black p-4 flex justify-center items-center relative">
          <ActivityShareCard 
            cardRef={cardRef} 
            activity={activity} 
            summary={summary} 
            showHr={showHr} 
          />
          {isGenerating && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">Vytváram obrázok...</span>
            </div>
          )}
        </div>

        <div className="px-5 py-5 bg-[#1a1a1a] flex flex-col gap-5 border-t border-white/10">
          <div className="flex items-center justify-between">
             <span className="text-sm text-white/70 font-medium">Zobraziť srdcový tep (HR)</span>
             <Checkbox 
              checked={showHr} 
              onChange={(e) => setShowHr(e.currentTarget.checked)} 
              disabled={isGenerating}
            />
          </div>
          
          <Button 
            variant="primary" 
            className="w-full py-3 text-base font-bold rounded-xl" 
            onClick={handleShareSync}
          >
            {isGenerating ? "Čakaj (Generujem)..." : "Zdieľať obrázok"}
          </Button>
        </div>

      </div>
    </div>
  );
}
