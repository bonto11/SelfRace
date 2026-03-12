"use client";

import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";
import { useState } from "react";
import Checkbox from "@/app/shared/ui/components/Checkbox";

const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  swim: appColors.chartSwim,
  strength: appColors.chartStrength,
  other: appColors.chartOther,
};

// Ikonky (Emoji) namiesto textov pre moderný vzhľad
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

  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showElev, setShowElev] = useState(true);
  const [showTime, setShowTime] = useState(true);

  if (!isOpen) return null;

  // Príprava Dát
  const sport = (summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other").toLowerCase();
  const title = summary?.name || activity?.title || (t("sessions.detail.newActivityTitle" as any) || "Nový tréning");
  const dateStr = summary?.date ? new Date(summary.date).toLocaleDateString("sk-SK") : "";

  const distTxt = summary ? formatDistance(summary.distance_m ?? null) : activity?.distanceStr ?? "—";
  const timeTxt = summary && summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : activity?.timeStr ?? "—";
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;
  const pace = formatPaceFromSpeedMps(summary?.average_speed_mps);

  const sportColor = SPORT_COLORS[sport] || SPORT_COLORS.other;

  // HLAVNÁ ZDIEĽACIA FUNKCIA (Ultra rýchla, natívna, žiadne generovanie canvasu!)
  const handleShare = async () => {
    // Vytvoríme text/správu, ktorá sa bude zdieľať spolu s odkazom do tvojej apky.
    const shareText = `Môj tréning v aplikácii SelfRace!\n🏃 ${title}\n📏 ${distTxt}  ⏱️ ${timeTxt}`;
    // Ak chceš generovať link na konkrétnu aktivitu, tak takto:
    // const shareUrl = `https://dev.selfrace.com/activity/${activity.id}`;
    const shareUrl = window.location.origin; 

    if (navigator.share) {
      try {
        await navigator.share({
          title: "SelfRace Tréning",
          text: shareText,
          url: shareUrl, 
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") {
          toast.error("Zdieľanie zrušené alebo zlyhalo.");
        }
      }
    } else {
        // Fallback pre PC, kde PWA Share nemusí ísť (Len nakopírujeme do schránky)
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success("Odkaz skopírovaný do schránky!");
        onClose();
    }
  };

  return (
    // FIX: Tmavé polopriehľadné pozadie modalu zostáva, ale celý vnútorný panel bude vyzerať inak
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      
      {/* Hlavný Wrapper: Presne ako tvoj červený rámik */}
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* --- 1. SAMOTNÁ KARTA (Vizitka) --- */}
        <div 
          className="w-full flex flex-col relative overflow-hidden rounded-[20px] shadow-2xl border"
          style={{ 
            backgroundColor: "#0A1A12", // ✅ Tvoja požadovaná SelfRace tmavozelená
            borderColor: "rgba(255,255,255,0.08)",
            fontFamily: "sans-serif" 
          }} 
        >
          {/* Farebný prúžok hore */}
          <div className="h-2 w-full shrink-0" style={{ backgroundColor: sportColor }} />

          <div className="p-7 relative z-10 flex flex-col h-full">
            
            {/* Hlavička: Názov a Dátum */}
            <div className="mb-6">
              {/* Opravené riadkovanie, aby to nerezalo písmená */}
              <h2 className="text-[22px] sm:text-2xl font-black uppercase tracking-wide leading-normal line-clamp-2 text-white pt-1">
                {title}
              </h2>
              <div className="text-white/50 text-[10px] sm:text-xs mt-1.5 uppercase font-bold tracking-widest">
                {dateStr} • {sport}
              </div>
            </div>

            {/* Mriežka štatistík s Emoji */}
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-4">
              
              <div className="flex flex-col">
                <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                  <span className="text-sm">{ICONS.distance}</span> Vzdialenosť
                </div>
                <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{distTxt}</div>
              </div>

              {showTime && (
                <div className="flex flex-col">
                  <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                    <span className="text-sm">{ICONS.time}</span> Čas
                  </div>
                  <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{timeTxt}</div>
                </div>
              )}

              {showPace && pace && (
                <div className="flex flex-col">
                  <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                    <span className="text-sm">{ICONS.pace}</span> Tempo
                  </div>
                  <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{pace}</div>
                </div>
              )}

              {showElev && elev && elev > 0 ? (
                <div className="flex flex-col">
                  <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                    <span className="text-sm">{ICONS.elev}</span> Prevýšenie
                  </div>
                  <div className="text-[24px] sm:text-[26px] font-black text-white leading-none">{elev} m</div>
                </div>
              ) : null}

              {showHr && avgHr && avgHr > 0 ? (
                <div className="flex flex-col col-span-2">
                  <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                    <span className="text-sm">{ICONS.hr}</span> Priem. tep
                  </div>
                  <div className="text-[20px] sm:text-[22px] font-bold text-white leading-none">
                     {avgHr} bpm
                  </div>
                </div>
              ) : null}
            </div>

            {/* Značka/Logo dole */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                {/* SVG Logo: tu bez strachu, natívne sa načíta normálne */}
                <img 
                  src="/logo/actual/selfrace_logo.svg" 
                  alt="Logo" 
                  className="w-5 h-5 object-contain" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span style="color: ${appColors.brandPrimary}; font-size: 16px;">▲</span>`);
                  }} 
                />
                <span className="text-[11px] font-bold text-white/50 tracking-[0.2em] mt-0.5">SELFRACE</span>
              </div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sportColor }} />
            </div>

          </div>
          {/* Estetický blur v rohu pre luxusnejší pocit */}
          <div 
            className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ backgroundColor: sportColor }}
          />
        </div>
        {/* --- KONIEC KARTY --- */}

        {/* --- 2. OVLÁDACIE PRVKY --- */}
        <div className="w-full flex flex-col gap-3">
            {/* Nastavenia zobrazenia */}
            <div className="p-5 bg-[#141414] rounded-[20px] border border-white/5 shadow-xl grid grid-cols-2 gap-x-4 gap-y-3">
              <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} label="Tep (HR)" />
              <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} label="Tempo" />
              <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} label="Čas" />
              <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} label="Prevýšenie" />
            </div>

            {/* Akčné tlačidlá v riadku (Zdieľať | Zatvoriť) */}
            <div className="flex gap-2">
              <button 
                onClick={handleShare}
                className="flex-1 py-3.5 bg-white text-black font-bold rounded-[16px] uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
              >
                Zdieľať na sieťach
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
    </div>
  );
}