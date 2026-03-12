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
  
  // Namiesto File ukladáme aj Base64 URL, aby sme mohli obrázok priamo zobraziť
  const [readyData, setReadyData] = useState<{ url: string, file: File } | null>(null);
  
  // Všetky chyby a logy pôjdu priamo do UI, aby sme ich na iPhone videli
  const [debugMsg, setDebugMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generateImage = async () => {
      setIsGenerating(true);
      setReadyData(null);
      setDebugMsg("Pripravujem plátno...");

      // Dáme DOM-u chvíľu na vyrenderovanie HTML
      await new Promise(r => setTimeout(r, 400)); 

      if (!cardRef.current || isCancelled) return;

      try {
        setDebugMsg("Kreslím obrázok...");
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, 
          useCORS: true,
          backgroundColor: "#000000",
        });

        setDebugMsg("Spracovávam súbor...");
        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            const file = new File([blob], "trening.png", { type: "image/png" });
            const url = canvas.toDataURL("image/png"); // Vytvoríme vizuálnu kópiu
            setReadyData({ url, file });
            setDebugMsg(""); // Zmažeme log, všetko je OK
          } else {
            if (!isCancelled) setDebugMsg("Chyba: Nepodarilo sa spracovať obrázok.");
          }
          if (!isCancelled) setIsGenerating(false);
        }, "image/png");

      } catch (err: any) {
        if (!isCancelled) {
          setDebugMsg("Chyba generovania: " + err.message);
          setIsGenerating(false);
        }
      }
    };

    generateImage();
    return () => { isCancelled = true; };
  }, [isOpen, showHr, activity, summary]);

  if (!isOpen) return null;

  // HLAVNÁ FUNKCIA (Zdieľanie cez tlačidlo)
  const handleShare = async () => {
    if (!readyData) return;

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [readyData.file] })) {
      try {
        setDebugMsg("Otváram zdieľanie...");
        await navigator.share({
          title: "Môj tréning",
          files: [readyData.file]
        });
        onClose();
      } catch (e: any) {
        // AbortError = používateľ to manuálne zavrel, to ignorujeme
        if (e.name !== "AbortError") {
          setDebugMsg("Zdieľanie zlyhalo: " + e.message);
        } else {
          setDebugMsg("");
        }
      }
    } else {
      setDebugMsg("Tvoj prehliadač blokuje priame zdieľanie cez tlačidlo. Podrž prst na obrázku!");
      
      // Fallback pre PC
      try {
        const a = document.createElement("a");
        a.href = readyData.url;
        a.download = "selfrace-trening.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {}
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
        
        {/* Hlavička */}
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] sticky top-0 z-50">
          <h3 className="font-bold text-white tracking-wide">Zdieľať tréning</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* NÁHĽAD OBRÁZKA */}
        <div className="bg-black p-4 flex justify-center items-center relative min-h-[300px]">
          
          {/* Ak už je obrázok hotový, ukážeme reálny <img> tag (Umožňuje Long-Press na iPhone!) */}
          {readyData ? (
            <img 
              src={readyData.url} 
              alt="Môj tréning" 
              className="w-full h-auto aspect-square border border-white/20 shadow-lg rounded-sm touch-auto" 
            />
          ) : (
            /* Ak sa ešte generuje, ukážeme HTML verziu (ktorú html2canvas fotí) */
            <div className="relative w-full aspect-square">
              <div className="absolute top-0 left-0 w-[400px] h-[400px] origin-top-left scale-[0.75]">
                 <ActivityShareCard 
                   cardRef={cardRef} 
                   activity={activity} 
                   summary={summary} 
                   showHr={showHr} 
                 />
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                Vytváram obrázok...
              </span>
            </div>
          )}
        </div>

        {/* Nastavenia a Tlačidlo */}
        <div className="px-5 py-5 bg-[#1a1a1a] flex flex-col gap-4 border-t border-white/10">
          
          {/* Zobrazenie chýb priamo do UI */}
          {debugMsg && (
            <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded text-center border border-red-500/20">
              {debugMsg}
            </div>
          )}

          {/* Inštrukcia pre iPhone */}
          {readyData && (
            <div className="text-[11px] text-white/50 text-center uppercase tracking-wider mb-2">
              Tip: Ak tlačidlo nefunguje, <strong className="text-white/80">podrž prst na obrázku</strong> pre uloženie.
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
          
          <Button 
            variant="primary" 
            className="w-full py-3 text-base font-bold rounded-xl" 
            onClick={handleShare}
            disabled={isGenerating || !readyData}
          >
            {isGenerating ? "Generujem..." : "Zdieľať obrázok"}
          </Button>
        </div>

      </div>
    </div>
  );
}