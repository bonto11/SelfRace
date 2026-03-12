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

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generateImageInBackground = async () => {
      setIsGenerating(true);
      setReadyFile(null);

      await new Promise(r => setTimeout(r, 600)); // Čakáme kým sa renderne CSS

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, // Vysoká kvalita (3x veľkosť pre IG)
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

  // 🔴 TESTOVACIE TLAČIDLO (Iba text)
  const handleTestShare = async () => {
    // navigator.share vyžaduje HTTPS! Ak testuješ cez lokálnu IP, nepôjde to.
    if (!navigator.share) {
      toast.error("Tvoj prehliadač alebo zariadenie nepodporuje zdieľanie. (Si na HTTPS?)");
      return;
    }

    try {
      await navigator.share({
        title: "Test SelfRace",
        text: "Ak vidíš túto správu, zdieľanie v PWA funguje perfektne!",
        url: window.location.origin
      });
      toast.success("Natívne okno otvorené!");
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Chyba testu: " + e.message);
    }
  };

  // 🟢 HLAVNÉ TLAČIDLO (Obrázok)
  const handleShareSync = async () => {
    if (!readyFile) {
      toast.error("Obrázok ešte nie je pripravený. Skús to o sekundu.");
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
        if (e.name !== "AbortError") toast.error("Zdieľanie zlyhalo: " + e.message);
      }
    } else {
      // Fallback pre PC/nepodporované
      try {
        const url = URL.createObjectURL(readyFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = "selfrace-trening.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Obrázok bol stiahnutý!");
        onClose();
      } catch (dlErr) {
         toast.error("Nepodarilo sa stiahnuť.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* Pridané max-h-[90vh] a overflow-y-auto aby sa dalo scrollovať ak je mobil malý */}
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
        
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] sticky top-0 z-50">
          <h3 className="font-bold text-white tracking-wide">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Tlačidlo na overenie API (Žlté) */}
        <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/20">
          <p className="text-xs text-yellow-500/80 mb-2 text-center">Nefunguje zdieľanie obrázka? Skús toto:</p>
          <Button 
            variant="secondary" 
            className="w-full py-2 bg-yellow-500 text-black font-bold hover:bg-yellow-400 border-none" 
            onClick={handleTestShare}
          >
            TEST: Zdieľať len text
          </Button>
        </div>

        {/* Náhľad obrázka */}
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

        {/* Nastavenia a Akcia */}
        <div className="px-5 py-5 bg-[#1a1a1a] flex flex-col gap-5 border-t border-white/10">
          <div className="flex items-center justify-between">
             <span className="text-sm text-white/70 font-medium">Zobraziť srdcový tep (HR)</span>
             <Checkbox 
              checked={showHr} 
              onChange={(e) => setShowHr(e.currentTarget.checked)} 
              disabled={isGenerating}
            />
          </div>
          
          {/* Tlačidlo na zdieľanie fotky NIE JE zablokované, aby mohlo hodiť chybový Toast, ak to stlačíš priskoro */}
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
