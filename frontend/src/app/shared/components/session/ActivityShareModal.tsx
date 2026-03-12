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

// Fallback ikonky
const ICONS = {
  distance: "📏",
  time: "⏱️",
  pace: "⚡",
  elev: "⛰️",
  hr: "❤️",
};

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);

  // STAVY
  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showElev, setShowElev] = useState(true);
  const [showTime, setShowTime] = useState(true);

  // NOVÉ STAVY PRE DIZAJN
  const [theme, setTheme] = useState<"light" | "brand">("light");
  const [displayMode, setDisplayMode] = useState<"icon" | "text" | "both">("icon");

  const [isGenerating, setIsGenerating] = useState(true);
  const [readyFile, setReadyFile] = useState<File | null>(null);

  // 1. NAČÍTANIE Z LOCALSTORAGE (iba raz po zobrazení)
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("selfrace_share_prefs");
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.showHr === "boolean") setShowHr(p.showHr);
        if (typeof p.showPace === "boolean") setShowPace(p.showPace);
        if (typeof p.showElev === "boolean") setShowElev(p.showElev);
        if (typeof p.showTime === "boolean") setShowTime(p.showTime);
        if (p.theme) setTheme(p.theme);
        if (p.displayMode) setDisplayMode(p.displayMode);
      }
    } catch (e) {
      console.error("Nepodarilo sa načítať prefs", e);
    }
  }, []);

  // 2. UKLADANIE DO LOCALSTORAGE (pri každej zmene)
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(
      "selfrace_share_prefs",
      JSON.stringify({ showHr, showPace, showElev, showTime, theme, displayMode })
    );
  }, [showHr, showPace, showElev, showTime, theme, displayMode, mounted]);

  // SPRACOVANIE DÁT
  const sport = (summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other").toLowerCase();
  const title = summary?.name || activity?.title || t("share.title" as any) || "Tréning";
  const dateStr = summary?.date ? new Date(summary.date).toLocaleDateString("sk-SK") : "";

  function formatPaceFromSpeedMps(speed: number | null | undefined): string | null {
    if (!speed || speed <= 0) return null;
    const secPerKm = 1000 / speed;
    const minutes = Math.floor(secPerKm / 60);
    const seconds = String(Math.round(secPerKm % 60)).padStart(2, "0");
    return `${minutes}:${seconds}`; 
  }

  const distStr = summary ? formatDistance(summary.distance_m ?? null) : activity?.distanceStr ?? "—";
  const distMatch = distStr.match(/^([\d.,]+)\s*(.*)$/);
  const distVal = distMatch ? distMatch[1] : distStr;
  const distUnit = distMatch ? distMatch[2] : "";

  const timeTxt = summary && summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : activity?.timeStr ?? "—";
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;
  const paceVal = formatPaceFromSpeedMps(summary?.average_speed_mps);

  // FARBY PODĽA TÉMY
  const textColor = theme === "brand" ? appColors.brandPrimary : "#ffffff";
  const mutedColor = theme === "brand" ? appColors.brandPrimary : "rgba(255,255,255,0.5)";
  const iconSuffix = theme === "brand" ? "_green" : "";

  // GENEROVANIE OBRÁZKA (Reaguje aj na zmenu témy a režimu)
  useEffect(() => {
    if (!isOpen || !mounted) return;
    let isCancelled = false;

    const generateImage = async () => {
      setIsGenerating(true);
      setReadyFile(null);

      await new Promise((r) => setTimeout(r, 600)); 

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
        if (!isCancelled) setIsGenerating(false);
      }
    };

    generateImage();
    return () => { isCancelled = true; };
  }, [isOpen, mounted, showHr, showPace, showElev, showTime, theme, displayMode, activity, summary]);

  if (!isOpen || !mounted) return null;

  const handleShare = async () => {
    if (!readyFile) {
      toast.error(t("share.generatingWarning" as any));
      return;
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [readyFile] })) {
      try {
        await navigator.share({
          title: t("share.title" as any),
          files: [readyFile]
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") toast.error(t("share.errorFailed" as any));
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
        toast.success(t("share.successDownload" as any));
        onClose();
      } catch (e) {
        toast.error(t("share.errorNotSupported" as any));
      }
    }
  };

  // HELPER PRE VYKRESLENIE METRIKY (Aby bol kód čistejší)
  const renderMetric = (iconName: string, fallbackEmoji: string, label: string, value: string | number, unit: string) => {
    const iconUrl = `/icons/${iconName}${iconSuffix}.svg`;
    
    return (
      <div className={`flex ${displayMode === 'icon' ? 'items-center gap-3' : 'flex-col gap-0.5'}`}>
        
        {/* Hlavička (Ikona a/alebo Text) */}
        {displayMode !== 'icon' ? (
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold" style={{ color: mutedColor }}>
            {displayMode === 'both' && (
              <img src={iconUrl} crossOrigin="anonymous" className="w-3.5 h-3.5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
            <span>{label}</span>
          </div>
        ) : (
          <img 
            src={iconUrl} 
            crossOrigin="anonymous" 
            className="w-6 h-6 object-contain shrink-0" 
            style={{ opacity: theme === 'light' ? 0.7 : 1 }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span class="text-xl shrink-0 opacity-70">${fallbackEmoji}</span>`);
            }}
          />
        )}

        {/* Hodnota a Jednotka */}
        <div className="flex items-baseline gap-1">
          <span className="text-[24px] sm:text-[26px] font-black leading-none" style={{ color: textColor }}>{value}</span>
          <span className="text-xs font-bold uppercase" style={{ color: mutedColor }}>{unit}</span>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-sm flex flex-col gap-4 mt-auto mb-auto pt-6 pb-6">
        
        {/* NÁHĽAD OBRÁZKA (KARTA) */}
        <div className="relative">
          <div 
            ref={cardRef}
            className="w-full flex flex-col relative overflow-hidden rounded-[20px] shadow-2xl border"
            style={{ backgroundColor: appColors.backgroundMain, borderColor: appColors.widgetBorder, fontFamily: "sans-serif" }} 
          >
            {/* ✅ Horný pásik zmenený na brandPrimary */}
            <div className="h-2 w-full shrink-0" style={{ backgroundColor: appColors.brandPrimary }} />

            <div className="p-7 relative z-10 flex flex-col h-full">
              
              <div className="mb-6">
                <h2 className="text-[22px] sm:text-2xl font-black uppercase tracking-wide leading-normal line-clamp-2 pt-1" style={{ color: textColor }}>
                  {title}
                </h2>
                <div className="text-[10px] sm:text-xs mt-1.5 uppercase font-bold tracking-widest" style={{ color: mutedColor }}>
                  {dateStr} • {t(`common.sports.${sport}` as any) || sport}
                </div>
              </div>

              {/* Štatistiky vykreslené cez helper */}
              <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-4">
                
                {renderMetric("distance", ICONS.distance, t("common.metrics.distance" as any) || "Vzdial.", distVal, distUnit || t("common.units.km"))}
                
                {showTime && renderMetric("time", ICONS.time, t("common.metrics.time" as any) || "Čas", timeTxt, "")}
                
                {showPace && paceVal && renderMetric("speed", ICONS.pace, t("common.metrics.pace" as any) || "Tempo", paceVal, t("common.units.pace"))}
                
                {showElev && elev && elev > 0 && renderMetric("elevation", ICONS.elev, t("common.metrics.elevation" as any) || "Prevýš.", elev, t("common.units.meter"))}
                
                {showHr && avgHr && avgHr > 0 && (
                   <div className="col-span-2 mt-2">
                     {renderMetric("heartRate", ICONS.hr, t("common.metrics.hr_avg" as any) || "Tep", avgHr, t("common.units.hr"))}
                   </div>
                )}
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
          </div>

          {/* Loading overlay na obrázku */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 rounded-[20px] flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                 {t("share.generating" as any) || "Generujem..."}
              </span>
            </div>
          )}
        </div>

        {/* OVLÁDANIE DOLE */}
        <div className="w-full flex flex-col gap-3">
            <div className="p-4 bg-[#141414] rounded-[20px] border border-white/5 shadow-xl flex flex-col gap-4">
              
              {/* Prepínače dizajnu (Ukladajú sa do Prefs) */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase text-white/50 font-bold">{t("share.theme" as any) || "Téma"}</span>
                  <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                    <button onClick={() => setTheme("light")} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${theme === "light" ? "bg-white/20 text-white" : "text-white/40"}`}>{t("share.themeLight" as any) || "Svetlá"}</button>
                    <button onClick={() => setTheme("brand")} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${theme === "brand" ? "bg-white/20 text-white" : "text-white/40"}`}>{t("share.themeBrand" as any) || "Značková"}</button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase text-white/50 font-bold">{t("share.displayMode" as any) || "Zobrazenie"}</span>
                  <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                    <button onClick={() => setDisplayMode("icon")} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${displayMode === "icon" ? "bg-white/20 text-white" : "text-white/40"}`}>{t("share.modeIcon" as any) || "Ikony"}</button>
                    <button onClick={() => setDisplayMode("both")} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${displayMode === "both" ? "bg-white/20 text-white" : "text-white/40"}`}>{t("share.modeBoth" as any) || "Oboje"}</button>
                    <button onClick={() => setDisplayMode("text")} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${displayMode === "text" ? "bg-white/20 text-white" : "text-white/40"}`}>{t("share.modeText" as any) || "Text"}</button>
                  </div>
                </div>
              </div>

              {/* Prepínače metrík */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-white/5">
                <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} label={t("common.metrics.hr_avg" as any) || "Tep"} disabled={isGenerating} />
                <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} label={t("common.metrics.pace" as any) || "Tempo"} disabled={isGenerating} />
                <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} label={t("common.metrics.time" as any) || "Čas"} disabled={isGenerating} />
                <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} label={t("common.metrics.elevation" as any) || "Prevýšenie"} disabled={isGenerating} />
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleShare}
                disabled={isGenerating || !readyFile}
                className="flex-1 py-3.5 bg-white text-black font-bold rounded-[16px] uppercase tracking-wider shadow-lg active:scale-95 transition-transform disabled:opacity-50"
              >
                {t("share.buttonShare" as any) || "Zdieľať fotku"}
              </button>

              <button 
                onClick={onClose}
                className="px-6 bg-white/10 text-white font-bold rounded-[16px] uppercase tracking-wider border border-white/5 active:scale-95 transition-transform"
              >
                {t("common.close" as any) || "Zavrieť"}
              </button>
            </div>
        </div>

      </div>
    </div>,
    document.body
  );
}