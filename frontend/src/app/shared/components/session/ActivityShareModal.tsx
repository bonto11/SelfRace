"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import Button from "@/app/shared/ui/components/Button"; // ✅ Tvoj Button komponent
import SegmentedControl from "@/app/shared/ui/components/SegmentedControl"; // ✅ Náš nový prepínač
import { toast } from "@/app/shared/ui/components/Toast";

export default function ActivityShareModal({ isOpen, onClose, activity, summary }: any) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);

  // STAVY METRÍK
  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showElev, setShowElev] = useState(true);
  const [showTime, setShowTime] = useState(true);

  // STAVY DIZAJNU A TÉMY
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [displayMode, setDisplayMode] = useState<"icon" | "text" | "both">("both");

  const [isGenerating, setIsGenerating] = useState(true);
  const [readyFile, setReadyFile] = useState<File | null>(null);

  // NAČÍTANIE Z LOCALSTORAGE
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

  // UKLADANIE DO LOCALSTORAGE
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(
      "selfrace_share_prefs",
      JSON.stringify({ showHr, showPace, showElev, showTime, theme, displayMode })
    );
  }, [showHr, showPace, showElev, showTime, theme, displayMode, mounted]);

  // PRÍPRAVA DÁT
  const sport = (summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other").toLowerCase();
  const title = summary?.name || activity?.title || t("share.title") || "Tréning";
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
  const isDark = theme === "dark";
  const cardBg = isDark ? appColors.backgroundMain : "#ffffff";
  const textColor = isDark ? "#ffffff" : appColors.brandPrimary;
  const borderColor = isDark ? appColors.widgetBorder : "rgba(0,0,0,0.05)";
  const iconSuffix = isDark ? "_green" : "_green"; // Pripravené, ak by si mal iné farby ikon pre light temu

  // GENEROVANIE OBRÁZKA
  useEffect(() => {
    if (!isOpen || !mounted) return;
    let isCancelled = false;

    const generateImage = async () => {
      setIsGenerating(true);
      setReadyFile(null);

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
        }
      }
    };

    generateImage();
    return () => { isCancelled = true; };
  }, [isOpen, mounted, showHr, showPace, showElev, showTime, theme, displayMode, activity, summary]);

  if (!isOpen || !mounted) return null;

  const handleShare = async () => {
    if (!readyFile) {
      toast.error(t("share.generatingWarning"));
      return;
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [readyFile] })) {
      try {
        await navigator.share({
          title: t("share.title"),
          files: [readyFile]
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") toast.error(t("share.errorFailed"));
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
        toast.success(t("share.successDownload"));
        onClose();
      } catch (e) {
        toast.error(t("share.errorNotSupported"));
      }
    }
  };

  // POMOCNÁ FUNKCIA NA VYKRESLENIE METRIKY (Ikona zarovnaná k hodnote, bez fallbackov)
  const renderMetric = (iconName: string, label: string, value: string | number, unit: string) => {
    const iconUrl = `/icons/${iconName}${iconSuffix}.svg`;

    return (
      <div className="flex flex-col gap-0.5">
        
        {/* TEXTOVÁ HLAVIČKA (Zobrazí sa len v režime text a both) */}
        {displayMode !== "icon" && (
          <div 
            className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold mb-0.5" 
            style={{ color: textColor, opacity: isDark ? 0.5 : 0.7 }}
          >
            {label}
          </div>
        )}

        {/* RIADOK S HODNOTOU A IKONOU */}
        <div className="flex items-center gap-2">
          {/* IKONA JE VŽDY PRED HODNOTOU (Okrem čisto textového režimu) */}
          {displayMode !== "text" && (
             <img 
               src={iconUrl} 
               crossOrigin="anonymous" 
               className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
               onError={(e) => { e.currentTarget.style.display = 'none'; }}
             />
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] sm:text-[28px] font-black leading-none" style={{ color: textColor }}>{value}</span>
            {unit && (
               <span className="text-[10px] font-bold uppercase" style={{ color: textColor, opacity: isDark ? 0.5 : 0.7 }}>{unit}</span>
            )}
          </div>
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
            className="w-full flex flex-col relative overflow-hidden rounded-[20px] shadow-2xl border transition-colors duration-300"
            style={{ backgroundColor: cardBg, borderColor: borderColor, fontFamily: "sans-serif" }} 
          >
            {/* ZELENÁ ZÁLOŽKA NA VRCHU */}
            <div className="h-2 w-full shrink-0" style={{ backgroundColor: appColors.brandPrimary }} />

            <div className="p-7 relative z-10 flex flex-col h-full">
              
              <div className="mb-6">
                <h2 className="text-[22px] sm:text-2xl font-black uppercase tracking-wide leading-normal line-clamp-2 pt-1" style={{ color: textColor }}>
                  {title}
                </h2>
                <div className="text-[10px] sm:text-xs mt-1.5 uppercase font-bold tracking-widest" style={{ color: textColor, opacity: isDark ? 0.5 : 0.7 }}>
                  {dateStr} • {t(`common.sports.${sport}` as any) || sport}
                </div>
              </div>

              {/* Mriežka štatistík volaná cez helper */}
              <div className="grid grid-cols-2 gap-y-7 gap-x-4 mb-4">
                {renderMetric("distance", t("common.metrics.distance"), distVal, distUnit || t("common.units.km"))}
                {showTime && renderMetric("time", t("common.metrics.time"), timeTxt, "")}
                {showPace && paceVal && renderMetric("speed", t("common.metrics.pace"), paceVal, t("common.units.pace"))}
                {showElev && elev && elev > 0 && renderMetric("elevation", t("common.metrics.elevation"), elev, t("common.units.meter"))}
                {showHr && avgHr && avgHr > 0 && (
                   <div className="col-span-2 mt-1">
                     {renderMetric("heartRate", t("common.metrics.hr_avg"), avgHr, t("common.units.hr"))}
                   </div>
                )}
              </div>

              {/* PÄTIČKA S NEMENNÝM LOGOM */}
              <div className="flex justify-center items-center mt-6 pt-5 border-t shrink-0" style={{ borderColor: borderColor }}>
                <img 
                  src="/logo/actual/selfrace_logo.svg" 
                  alt="SelfRace" 
                  crossOrigin="anonymous"
                  className="h-10 w-auto object-contain opacity-90"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }} 
                />
              </div>

            </div>
          </div>

          {/* Loading overlay na obrázku */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 rounded-[20px] flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                 {t("share.generating")}
              </span>
            </div>
          )}
        </div>

        {/* OVLÁDANIE DOLE */}
        <div className="w-full flex flex-col gap-3">
            <div className="p-4 bg-[#141414] rounded-[20px] border border-white/5 shadow-xl flex flex-col gap-4">
              
              {/* PREPÍNAČE DIZAJNU (Použitý nový SegmentedControl) */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase text-white/50 font-bold px-1">{t("share.theme")}</span>
                  <SegmentedControl
                    options={[
                      { label: t("share.themeDark"), value: "dark" },
                      { label: t("share.themeLight"), value: "light" },
                    ]}
                    value={theme}
                    onChange={(val) => setTheme(val)}
                    disabled={isGenerating}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase text-white/50 font-bold px-1">{t("share.displayMode")}</span>
                  <SegmentedControl
                    options={[
                      { label: t("share.modeIcon"), value: "icon" },
                      { label: t("share.modeText"), value: "text" },
                      { label: t("share.modeBoth"), value: "both" },
                    ]}
                    value={displayMode}
                    onChange={(val) => setDisplayMode(val)}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              {/* PREPÍNAČE METRÍK */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-white/5">
                <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} label={t("common.metrics.hr_avg")} disabled={isGenerating} />
                <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} label={t("common.metrics.pace")} disabled={isGenerating} />
                <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} label={t("common.metrics.time")} disabled={isGenerating} />
                <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} label={t("common.metrics.elevation")} disabled={isGenerating} />
              </div>
            </div>

            {/* AKČNÉ TLAČIDLÁ (Použité tvoje natívne Button komponenty) */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Button 
                  variant="primary" 
                  block
                  disabled={isGenerating || !readyFile}
                  onClick={handleShare}
                >
                  {t("share.buttonShare")}
                </Button>
              </div>
              <Button 
                variant="secondary"
                disabled={isGenerating}
                onClick={onClose}
              >
                {t("common.close")}
              </Button>
            </div>
        </div>

      </div>
    </div>,
    document.body
  );
}