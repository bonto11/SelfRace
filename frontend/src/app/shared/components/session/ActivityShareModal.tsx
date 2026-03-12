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

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);

    try {
      // 1. Odfotíme HTML (scale: 3 zaručí ostrý 1200x1200px obrázok pre Instagram)
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, 
        useCORS: true,
        backgroundColor: "#000000",
      });

      // 2. Vytvoríme Blob (súbor)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Nepodarilo sa vytvoriť obrázok.");
          setIsGenerating(false);
          return;
        }

        const file = new File([blob], "trening.png", { type: "image/png" });

        // 3. Skúsime Web Share API (Natívny iOS/Android dialóg)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: "Môj tréning",
              files: [file]
            });
            // Ak to prešlo (alebo user klikol krížik v share dialógu), modal zavrieme
            onClose(); 
          } catch (e: any) {
            // AbortError znamená, že užívateľ len zrušil to vyskakovacie okno
            if (e.name !== "AbortError") {
              toast.error("Zdieľanie zlyhalo: " + (e.message || "Neznáma chyba"));
            }
          }
        } else {
          // 4. Fallback: Ak prehliadač nepodporuje zdieľanie súborov, stiahneme ho.
          try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "trening.png";
            document.body.appendChild(a); // Nutné pre niektoré prehliadače
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Obrázok bol stiahnutý do zariadenia.");
            onClose();
          } catch (dlErr) {
             toast.error("Nepodarilo sa stiahnuť obrázok.");
          }
        }
        setIsGenerating(false);
      }, "image/png");

    } catch (error: any) {
      console.error("Share error:", error);
      toast.error("Chyba: " + (error.message || "Nepodarilo sa vygenerovať obrázok."));
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
        
        {/* Hlavička */}
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
          <h3 className="font-bold text-white tracking-wide">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Náhľad Karty
          Trik: Obal má 300x300px, ale vnútri je karta zmenšená cez CSS scale(0.75). 
          Tým pádom sa nám modal zbytočne nerozťahuje na výšku, ale karta sa odfotí v plnej veľkosti 400x400.
        */}
        <div className="bg-black flex justify-center items-center py-6">
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
        </div>

        {/* Nastavenia */}
        <div className="px-5 py-5 bg-[#1a1a1a] flex flex-col gap-5 border-t border-white/10">
          <div className="flex items-center justify-between">
             <span className="text-sm text-white/70 font-medium">Srdcový tep (HR)</span>
             <Checkbox 
              checked={showHr} 
              onChange={(e) => setShowHr(e.currentTarget.checked)} 
            />
          </div>
          
          <Button 
            variant="primary" 
            className="w-full py-3 text-base font-bold rounded-xl" 
            onClick={handleShare}
            disabled={isGenerating}
          >
            {isGenerating ? "Generujem obrázok..." : "Zdieľať tréning"}
          </Button>
        </div>

      </div>
    </div>
  );
}
