"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { toast } from "@/app/shared/ui/components/Toast";

const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  swim: appColors.chartSwim,
  strength: appColors.chartStrength,
  other: appColors.chartOther,
};

// Fallback ikonky (ak by zlyhalo načítanie SVG)
const ICONS = {
  distance: "📏",
  time: "⏱️",
  pace: "⚡",
  elev: "⛰️",
  hr: "❤️",
};

function formatPaceFromSpeedMps(speed: number | null | undefined): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = String(Math.round(secPerKm % 60)).padStart(2, "0");
  return `${minutes}:${seconds} /km`;
}

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showElev, setShowElev] = useState(true);
  const [showTime, setShowTime] = useState(true);

  const [isGenerating, setIsGenerating] = useState(true);
  const [readyFile, setReadyFile] = useState<File | null>(null);

  const sport = (summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other").toLowerCase();
  const title = summary?.name || activity?.title || (t("sessions.detail.newActivityTitle" as any) || "Nový tréning");
  const dateStr = summary?.date ? new Date(summary.date).toLocaleDateString("sk-SK") : "";

  const distTxt = summary ? formatDistance(summary.distance_m ?? null) : activity?.distanceStr ?? "—";
  const timeTxt = summary && summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : activity?.timeStr ?? "—";
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;
  const pace = formatPaceFromSpeedMps(summary?.average_speed_mps);
  const sportColor = SPORT_COLORS[sport] || SPORT_COLORS.other;

  useEffect(() => {
    if (!isOpen || !mounted) return;
    let isCancelled = false;

    const generateImage = async () => {
      setIsGenerating(true);
      setReadyFile(null);

      // Čakáme, aby sa SVG ikony stihli stiahnuť zo servera
      await new Promise(r => setTimeout(r, 600)); 

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, 
          useCORS: true,
          backgroundColor: null,
        });

        canvas.toBlob((blob) => {
          if (blob && !isCancelled) {
            const file = new File([blob], "selfrace-training.png", { type: "image/png" });
            setReadyFile(file);
          }
          if (!isCancelled) setIsGenerating(false);
        }, "image/png");
      } catch (err) {
        if (!isCancelled) {
          setIsGenerating(false);
          console.error("html2canvas error:", err);
        }
      }
    };

    generateImage();
    return () => { isCancelled = true; };
  }, [isOpen, mounted, showHr, showPace, showElev, showTime, activity, summary]);

  if (!isOpen || !mounted) return null;

  const handleShare = async () => {
    if (!readyFile) {
      toast.error("Obrázok sa ešte generuje, sekundu strpenia.");
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
        if (e.name !== "AbortError") toast.error("Zdieľanie zlyhalo.");
      }
    } else {
      try {
        const url = URL.createObjectURL(readyFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = "selfrace-trening.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Obrázok stiahnutý.");
        onClose();
      } catch (e) {
        toast.error("Zariadenie nepodporuje zdieľanie obrázkov.");
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      
      <div className="w-full max-w-sm flex flex-col gap-4 mt-auto mb-auto">

        {/* NÁHĽAD OBRÁZKA (KARTA) */}
        <div className="relative">
          <div 
            ref={cardRef}
            className="w-full flex flex-col relative overflow-hidden rounded-[20px] shadow-2xl border"
            style={{ backgroundColor: "#0A1A12", borderColor: "rgba(255,255,255,0.08)", fontFamily: "sans-serif" }} 
          >
            <div className="h-2 w-full shrink-0" style={{ backgroundColor: sportColor }} />

            <div className="p-7 relative z-10 flex flex-col h-full">
              
              <div className="mb-6">
                <h2 className="text-[22px] sm:text-2xl font-black uppercase tracking-wide leading-normal line-clamp-2 text-white pt-1">
                  {title}
                </h2>
                <div className="text-white/50 text-[10px] sm:text-xs mt-1.5 uppercase font-bold tracking-widest">
                  {dateStr} • {sport}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-4">
                
                {/* VZDIALENOSŤ */}
                <div className="flex flex-col">
                  <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                    <img 
                      src="/icons/distance.svg" 
                      crossOrigin="anonymous"
                      className="w-3.5 h-3.5 object-contain opacity-70"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span class="text-sm">${ICONS.distance}</span>`);
                      }}
                    />
                    Vzdialenosť
                  </div>
                  <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{distTxt}</div>
                </div>

                {/* ČAS */}
                {showTime && (
                  <div className="flex flex-col">
                    <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                      <img 
                        src="/icons/time.svg" 
                        crossOrigin="anonymous"
                        className="w-3.5 h-3.5 object-contain opacity-70"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span class="text-sm">${ICONS.time}</span>`);
                        }}
                      />
                      Čas
                    </div>
                    <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{timeTxt}</div>
                  </div>
                )}

                {/* TEMPO */}
                {showPace && pace && (
                  <div className="flex flex-col">
                    <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                      <img 
                        src="/icons/speed.svg" 
                        crossOrigin="anonymous"
                        className="w-3.5 h-3.5 object-contain opacity-70"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span class="text-sm">${ICONS.pace}</span>`);
                        }}
                      />
                      Tempo
                    </div>
                    <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{pace}</div>
                  </div>
                )}

                {/* PREVÝŠENIE */}
                {showElev && elev && elev > 0 ? (
                  <div className="flex flex-col">
                    <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                      <img 
                        src="/icons/elevation.svg" 
                        crossOrigin="anonymous"
                        className="w-3.5 h-3.5 object-contain opacity-70"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span class="text-sm">${ICONS.elev}</span>`);
                        }}
                      />
                      Prevýšenie
                    </div>
                    <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{elev} m</div>
                  </div>
                ) : null}

                {/* TEP */}
                {showHr && avgHr && avgHr > 0 ? (
                  <div className="flex flex-col col-span-2">
                    <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                      <img 
                        src="/icons/heartRate.svg" 
                        crossOrigin="anonymous"
                        className="w-3.5 h-3.5 object-contain opacity-70"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span class="text-sm">${ICONS.hr}</span>`);
                        }}
                      />
                      Priem. tep
                    </div>
                    <div className="text-[20px] sm:text-[22px] font-bold text-white leading-none">
                       {avgHr} bpm
                    </div>
                  </div>
                ) : null}
              </div>

              {/* PÄTIČKA */}
              <div className="flex justify-center items-center mt-6 pt-5 border-t border-white/10 shrink-0">
                <img 
                  src="/logo/actual/selfrace_logo.svg" 
                  alt="SelfRace" 
                  crossOrigin="anonymous"
                  className="h-10 w-auto object-contain opacity-90"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span style="color: ${appColors.brandPrimary}; font-size: 20px; font-weight: 900;">▲ SELFRACE</span>`);
                  }} 
                />
              </div>

            </div>
            
            <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ backgroundColor: sportColor }} />
          </div>

          {/* Loading overlay na obrázku */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 rounded-[20px] flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                Generujem fotku...
              </span>
            </div>
          )}
        </div>

        {/* OVLÁDANIE DOLE */}
        <div className="w-full flex flex-col gap-3">
            <div className="p-5 bg-[#141414] rounded-[20px] border border-white/5 shadow-xl grid grid-cols-2 gap-x-4 gap-y-3">
              <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} label="Tep (HR)" disabled={isGenerating} />
              <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} label="Tempo" disabled={isGenerating} />
              <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} label="Čas" disabled={isGenerating} />
              <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} label="Prevýšenie" disabled={isGenerating} />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleShare}
                disabled={isGenerating || !readyFile}
                className="flex-1 py-3.5 bg-white text-black font-bold rounded-[16px] uppercase tracking-wider shadow-lg active:scale-95 transition-transform disabled:opacity-50"
              >
                Zdieľať
              </button>

              <button 
                onClick={onClose}
                className="px-6 bg-white/10 text-white font-bold rounded-[16px] uppercase tracking-wider border border-white/5 active:scale-95 transition-transform"
              >
                Zavrieť
              </button>
            </div>
        </div>

      </div>
    </div>,
    document.body
  );
}