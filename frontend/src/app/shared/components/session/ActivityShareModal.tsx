"use client";

import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { toast } from "@/app/shared/ui/components/Toast";
import ActivityShareCard from "./ActivityShareCard";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [showHr, setShowHr] = useState(true);
  const [isGenerating, setIsGenerating] = useState(true);
  const [readyFile, setReadyFile] = useState<File | null>(null);

  // Mágia pre iOS: Generujeme obrázok na pozadí hneď pri otvorení alebo zmene nastavení
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generateImageInBackground = async () => {
      setIsGenerating(true);
      setReadyFile(null);

      // Dáme Reactu 300ms, aby najprv vykreslil HTML zmeny (napr. skrytie tepu)
      await new Promise(r => setTimeout(r, 300));

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, // Vysoká kvalita
          useCORS: true,
          backgroundColor: "#000000",
        });

        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            // Uložíme hotový súbor do state-u
            const file = new File([blob], "trening.png", { type: "image/png" });
            setReadyFile(file);
          }
          if (!isCancelled) setIsGenerating(false);
        }, "image/png");
      } catch (err) {
        console.error("Generovanie zlyhalo:", err);
        if (!isCancelled) setIsGenerating(false);
      }
    };

    generateImageInBackground();

    // Cleanup funkcia pre prípad, že užívateľ rýchlo prepína nastavenia
    return () => { isCancelled = true; };
  }, [isOpen, showHr, activity, summary]);

  if (!isOpen) return null;

  // Samotné zdieľanie je teraz OKAMŽITÉ (synchrónne), čo Safari miluje
  const handleShareSync = async () => {
    if (!readyFile) return;

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [readyFile] })) {
      try {
        await navigator.share({
          title: "Môj tréning",
          files: [readyFile]
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") {
          toast.error("Zdieľanie zrušené alebo zlyhalo.");
        }
      }
    } else {
      // Fallback: PC alebo nepodporované zariadenia
      try {
        const url = URL.createObjectURL(readyFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = "trening.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Obrázok bol stiahnutý do zariadenia.");
        onClose();
      } catch (dlErr) {
         toast.error("Nepodarilo sa stiahnuť obrázok.");
      }
    }
  };

  return (
    // ✅ Oprava Z-indexu: 99999 prekryje aj spodnú navigačnú lištu
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
        
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
          <h3 className="font-bold text-white tracking-wide">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="bg-black flex justify-center items-center py-6 relative">
          <div className="relative w-[300px] h-[300px]">
            <div className="absolute top-0 left-0 w-[400px] h-[400px] origin-top-left scale-[0.75]">
               <ActivityShareCard 
                 cardRef={cardRef} 
                 activity={activity} 
                 summary={summary} 
                 showHr={showHr} 
               />
            </div>
          </div>
          
          {/* Vizuálna odozva pri generovaní */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse text-sm tracking-wider uppercase">Pripravujem obrázok...</span>
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
            disabled={isGenerating || !readyFile} // Tlačidlo čaká, kým nie je súbor pripravený v pozadí
          >
            {isGenerating ? "Čakajte..." : "Zdieľať tréning"}
          </Button>
        </div>

      </div>
    </div>
  );
}
