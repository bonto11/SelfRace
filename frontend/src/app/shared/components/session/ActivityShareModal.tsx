"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { toast } from "@/app/shared/ui/components/Toast";
import ActivityShareCard from "./ActivityShareCard";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [showHr, setShowHr] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  // Funkcia, ktorá spraví fotku a zdieľa
  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);

    try {
      // 1. Odfotíme HTML
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // Lepšie rozlíšenie pre retinu
        useCORS: true,
        backgroundColor: "#000000",
      });

      // 2. Prevedieme canvas na Blob (súbor)
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Nepodarilo sa vytvoriť obrázok");

        const file = new File([blob], "trening.png", { type: "image/png" });

        // 3. Skúsime Web Share API (Natívny mobilný dialóg)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Môj tréning",
            files: [file],
          });
        } else {
          // 4. Fallback pre PC/nepodporované prehliadače - Stiahnutie súboru
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "trening.png";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Obrázok bol stiahnutý do tvojho zariadenia");
        }
        setIsGenerating(false);
        onClose();
      }, "image/png");

    } catch (error) {
      console.error("Share error:", error);
      toast.error("Nastala chyba pri zdieľaní.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl">
        
        {/* Hlavička modalu */}
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-bold text-white">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Samotná Karta (Odfotí sa len táto časť vďaka refu) */}
        <div className="bg-black flex justify-center p-4 overflow-hidden relative">
          {/* Kvôli fixnej šírke 400px to pre mobil jemne zmenšíme vizuálne pomocou transformácie */}
          <div className="origin-top scale-[0.75] sm:scale-90 h-[300px] sm:h-[360px] w-[400px] flex justify-center">
             <ActivityShareCard 
               cardRef={cardRef} 
               activity={activity} 
               summary={summary} 
               showHr={showHr} 
             />
          </div>
        </div>

        {/* Nastavenia */}
        <div className="px-5 py-4 bg-[#1a1a1a] flex flex-col gap-4">
          <div className="text-sm text-white/50 mb-1">Nastavenia obrázka</div>
          
          <Checkbox 
            label="Zobraziť Srdcový Tep" 
            checked={showHr} 
            onChange={(e) => setShowHr(e.currentTarget.checked)} 
          />
          
          <Button 
            variant="primary" 
            className="w-full mt-2" 
            onClick={handleShare}
            disabled={isGenerating}
          >
            {isGenerating ? "Generujem obrázok..." : "Zdieľať / Stiahnuť"}
          </Button>
        </div>

      </div>
    </div>
  );
}
