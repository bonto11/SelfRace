"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { toast } from "@/app/shared/ui/components/Toast";
import ActivityShareCard from "./ActivityShareCard";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Stavy pre viditeľnosť prvkov na karte
  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showTime, setShowTime] = useState(true);
  const [showElev, setShowElev] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  // HLAVNÁ FUNKCIA (Fotí priamo na kliknutie, bez generovania do zásoby)
  const handleShare = async () => {
    if (!cardRef.current) return;
    
    // Ak prehiadač vôbec nepodporuje zdieľanie, ani nebudeme zaťažovať mobil fotením, len stiahneme.
    const canNativeShare = !!navigator.share; 
    
    setIsGenerating(true);

    try {
      // 1. Odfotíme presne ten element. Nepoužívame už scale v CSS, takže by to pre iOS nemal byť problém.
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // 3x zväčšené pre krásne ostrý obrázok
        useCORS: true,
        backgroundColor: null, // Nechá pozadie div-u
        logging: false, // Vypneme spam do konzoly
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Nepodarilo sa vytvoriť obrázok.");
          setIsGenerating(false);
          return;
        }

        const file = new File([blob], "selfrace-trening.png", { type: "image/png" });

        // Ak mobil vie zdieľať (iPhone)
        if (canNativeShare && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: "Môj tréning",
              files: [file]
            });
            onClose();
          } catch (e: any) {
            if (e.name !== "AbortError") {
              toast.error("Zdieľanie zrušené alebo zlyhalo.");
            }
          }
        } else {
          // Fallback (PC alebo staršie mobily) - sťahovanie
          try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "selfrace-trening.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Obrázok bol stiahnutý do zariadenia.");
            onClose();
          } catch (dlErr) {
             toast.error("Zlyhalo sťahovanie.");
          }
        }
        setIsGenerating(false);
      }, "image/png");

    } catch (err: any) {
      toast.error("Chyba: " + (err.message || "Generátor obrázkov spadol."));
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      
      {/* Kontajner modalu - je menší a preberá farbu okolia */}
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Hlavička modalu */}
        <div className="px-5 py-4 flex justify-between items-center sticky top-0 z-50">
          <h3 className="font-bold text-white tracking-wide">Zdieľať na IG / Siete</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-3xl leading-none">&times;</button>
        </div>

        {/* Samotná Karta vložená priamo. Žiadne tmavé boxy okolo. */}
        <div className="flex justify-center p-2 mb-2">
          <ActivityShareCard 
            cardRef={cardRef} 
            activity={activity} 
            summary={summary} 
            showHr={showHr}
            showPace={showPace}
            showTime={showTime}
            showElev={showElev}
          />
        </div>

        {/* Sekcia s Checkboxami v dvoch stĺpcoch */}
        <div className="px-6 py-4 bg-[#1a1a1a] border-t border-white/5 flex flex-col gap-4">
          
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} disabled={isGenerating} label="Tep (HR)" />
            <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} disabled={isGenerating} label="Čas" />
            <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} disabled={isGenerating} label="Tempo" />
            <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} disabled={isGenerating} label="Prevýšenie" />
          </div>
          
          <Button 
            variant="primary" 
            className="w-full py-4 mt-2 text-base font-bold rounded-2xl bg-blue-600 hover:bg-blue-500 text-white border-none" 
            onClick={handleShare}
            disabled={isGenerating}
          >
            {isGenerating ? "Generujem fotku..." : "Zdieľať / Poslať"}
          </Button>

        </div>

      </div>
    </div>
  );
}