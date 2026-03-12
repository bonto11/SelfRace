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

  // Mágia pre iOS: Generujeme obrázok na pozadí
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generateImageInBackground = async () => {
      setIsGenerating(true);
      setReadyFile(null);

      await new Promise(r => setTimeout(r, 500)); // Dáme DOM-u čas na vyrenderovanie

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 2, // Na test to znížime na 2
          useCORS: true,
          backgroundColor: "#000000",
          logging: true, // Zapneme interné logy pre html2canvas
        });

        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            const file = new File([blob], "trening.png", { type: "image/png" });
            setReadyFile(file);
            // toast.success("Obrázok pripravený v pozadí!"); // Odkomentuj ak chceš vidieť, že sa to podarilo
          } else {
            if (!isCancelled) toast.error("Blob z canvasu bol prázdny.");
          }
          if (!isCancelled) setIsGenerating(false);
        }, "image/png");
      } catch (err: any) {
        if (!isCancelled) {
          toast.error("Chyba html2canvas: " + (err.message || "Neznáma chyba"));
          setIsGenerating(false);
        }
      }
    };

    generateImageInBackground();

    return () => { isCancelled = true; };
  }, [isOpen, showHr, activity, summary]);

  if (!isOpen) return null;

  // HLAVNÁ FUNKCIA (Fotka)
  const handleShareSync = async () => {
    if (!readyFile) {
      toast.error("Obrázok ešte nie je pripravený alebo zlyhal.");
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
        if (e.name !== "AbortError") {
          toast.error("Zdieľanie zlyhalo: " + e.message);
        }
      }
    } else {
      toast.error("Tento prehliadač nepodporuje zdieľanie SÚBOROV.");
    }
  };

  // ✅ TESTOVACIA FUNKCIA (Len čistý text, aby sme overili API)
  const handleTestShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Test PWA",
          text: "Toto je test, či funguje natívne okno na iOS!",
          url: "https://selfrace.app"
        });
        toast.success("Natívne okno úspešne otvorené!");
      } catch (e: any) {
        if (e.name !== "AbortError") toast.error("Test zlyhal: " + e.message);
      }
    } else {
      toast.error("Tvoj prehliadač vôbec nepodporuje Web Share API.");
    }
  };

  return (
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
          
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse text-sm tracking-wider uppercase">Pripravujem obrázok...</span>
            </div>
          )}
        </div>

        <div className="px-5 py-5 bg-[#1a1a1a] flex flex-col gap-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
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
            disabled={isGenerating || !readyFile}
          >
            {isGenerating ? "Čakajte..." : "Zdieľať obrázok"}
          </Button>

          {/* ✅ TESTOVACIE TLAČIDLO */}
          <Button 
            variant="ghost" 
            className="w-full py-2 text-xs opacity-50 border border-white/10" 
            onClick={handleTestShare}
          >
            TEST: Iba otvoriť zdieľacie okno (Text)
          </Button>

        </div>
      </div>
    </div>
  );
}
