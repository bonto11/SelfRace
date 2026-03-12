"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import Button from "@/app/shared/ui/components/Button";
import SegmentedControl from "@/app/shared/ui/components/SegmentedControl";
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
  const rawSport = summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other";
  const sport = String(rawSport).toLowerCase();
  
  const title = summary?.name || activity?.title || t("share.title" as any) || "Tréning";
  const dateStr = summary?.date ? new Date(summary.date).toLocaleDateString("sk-SK") : "";

  // Helper na formátovanie sekúnd do MM:SS (alebo HH:MM:SS ak je to viac ako hodina)
  function formatPaceSeconds(totalSeconds: number | null | undefined): string | null {
    if (!totalSeconds || totalSeconds <= 0) return null;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.round(totalSeconds % 60);
    
    const sStr = String(s).padStart(2, "0");
    const mStr = String(m).padStart(2, "0");

    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${m}:${sStr}`;
  }

  // ROZHODOVANIE: Rýchlosť vs Tempo
  const isSpeedSport = ["ride", "ebikeride", "virtualride", "velomobile", "inlineskate", "iceskate", "alpineski", "snowboard"].includes(sport);
  
  let speedOrPaceVal = null;
  let speedOrPaceUnit = "";
  let speedOrPaceLabel = "";

  if (isSpeedSport) {
    // Bicykel, korčule atď -> Rýchlosť v km/h
    speedOrPaceLabel = t("common.metrics.speed" as any) || "Rýchlosť";
    speedOrPaceUnit = t("common.units.speed" as any) || "km/h";
    
    // Použijeme average_speed_mps (m/s) a premeníme na km/h (* 3.6)
    const avgMps = summary?.average_speed_mps ? parseFloat(summary.average_speed_mps) : null;
    if (avgMps && avgMps > 0) {
      speedOrPaceVal = (avgMps * 3.6).toFixed(1); // 1 desatinné miesto
    }
  } else {
    // Beh, chôdza, hike atď -> Tempo v min/km
    speedOrPaceLabel = t("common.metrics.pace" as any) || "Tempo";
    speedOrPaceUnit = t("common.units.pace" as any) || "/km";
    
    // Tu zoberieme tvoj `pace_seconds_per_km` priamo z DB
    speedOrPaceVal = formatPaceSeconds(summary?.pace_seconds_per_km);
  }

  const distStr = summary ? formatDistance(summary.distance_m ?? null) : activity?.distanceStr ?? "—";
  const distMatch = distStr.match(/^([\d.,]+)\s*(.*)$/);
  const distVal = distMatch ? distMatch[1] : distStr;
  const distUnit = distMatch ? distMatch[2] : "";

  const timeTxt = summary && summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : activity?.timeStr ?? "—";
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;

  // FARBY PODĽA TÉMY
  const isDark = theme === "dark";
  const cardBg = isDark ? appColors.backgroundMain || "#0A1A12" : "#ffffff";
  const textColor = isDark ? "#ffffff" : appColors.backgroundMain || "#000000";
  const borderColor = isDark ? appColors.widgetBorder || "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const iconSuffix = isDark ? "" : "_green";

  // GENEROVANIE OBRÁZKA
  useEffect(() => {
    if (!isOpen || !mounted) return;
    let isCancelled = false;

    const generateImage = async () => {
      setIsGenerating(true);
      setReadyFile(null);

      // Pevne veríme, že 800ms stačí na stiahnutie .png ikoniek na iOS
      await new Promise(r => setTimeout(r, 800)); 

      if (!cardRef.current || isCancelled) return;

      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3, 
          useCORS: true,
          backgroundColor: null,
          logging: false,
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
  }, [isOpen, mounted, showHr, showPace, showElev, showTime, theme, displayMode, activity, summary, cardBg]);

  if (!isOpen || !mounted) return null;

  const handleShare = async () => {
    if (!readyFile) {
      toast.error(t("share.generatingWarning" as any) || "Obrázok sa ešte generuje, prosím čakajte.");
      return;
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [readyFile] })) {
      try {
        await navigator.share({
          title: t("share.title" as any) || "Zdieľanie tréningu",
          files: [readyFile]
        });
        onClose();
      } catch (e: any) {
        if (e.name !== "AbortError") toast.error(t("share.errorFailed" as any) || "Zdieľanie zlyhalo.");
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
        toast.success(t("share.successDownload" as any) || "Obrázok stiahnutý.");
        onClose();
      } catch (e) {
        toast.error(t("share.errorNotSupported" as any) || "Zdieľanie nie je podporované.");
      }
    }
  };

  // POMOCNÁ FUNKCIA NA VYKRESLENIE METRIKY (Pevné CSS, PNG ikony)
  const renderMetric = (iconName: string, label: string, value: string | number, unit: string) => {
    // Všetky ikonky načítava ako PNG
    const iconUrl = `/icons/${iconName}${iconSuffix}.png`;

    return (
      <div style={{ marginBottom: "16px", display: "block", clear: "both", minHeight: "40px" }}>
        
        {/* TEXTOVÁ HLAVIČKA */}
        {displayMode !== "icon" && (
          <div 
            style={{ 
              fontSize: "11px", 
              textTransform: "uppercase", 
              fontWeight: "bold", 
              color: textColor, 
              opacity: isDark ? 0.5 : 0.7,
              marginBottom: "4px",
              letterSpacing: "0.05em",
              display: "block"
            }}
          >
            {label}
          </div>
        )}

        {/* RIADOK S HODNOTOU A IKONOU */}
        <div style={{ display: "block" }}>
          {displayMode !== "text" && (
             <img 
               src={iconUrl} 
               crossOrigin="anonymous" 
               alt={iconName}
               style={{
                 width: "24px",
                 height: "24px",
                 objectFit: "contain",
                 marginRight: "8px",
                 verticalAlign: "middle",
                 display: "inline-block"
               }}
               onError={(e) => { e.currentTarget.style.display = 'none'; }}
             />
          )}
          <span style={{ fontSize: "28px", fontWeight: 900, color: textColor, verticalAlign: "middle" }}>
            {value}
          </span>
          {unit && (
             <span style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: textColor, opacity: isDark ? 0.5 : 0.7, marginLeft: "4px", verticalAlign: "baseline" }}>
               {unit}
             </span>
          )}
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
            className="w-full relative overflow-hidden rounded-[20px] shadow-2xl border transition-colors duration-300"
            style={{ backgroundColor: cardBg, borderColor: borderColor, fontFamily: "sans-serif", display: "block", boxSizing: "border-box" }} 
          >
            {/* ZELENÁ ZÁLOŽKA NA VRCHU */}
            <div style={{ height: "8px", width: "100%", backgroundColor: appColors.brandPrimary || "#4ade80", display: "block" }} />

            <div style={{ padding: "28px", display: "block" }}>
              
              {/* HLAVIČKA */}
              <div style={{ marginBottom: "24px", display: "block" }}>
                <h2 style={{ fontSize: "24px", fontWeight: 900, textTransform: "uppercase", color: textColor, margin: 0, lineHeight: 1.2 }}>
                  {title}
                </h2>
                <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "bold", color: textColor, opacity: isDark ? 0.5 : 0.7, marginTop: "6px", letterSpacing: "0.1em" }}>
                  {dateStr} • {t(`common.sports.${sport}` as any) || sport}
                </div>
              </div>

              {/* ŠTATISTIKY (Plávajúce bloky pre maximálnu kompatibilitu v iOS html2canvas) */}
              <div style={{ display: "block", overflow: "hidden", marginBottom: "8px", width: "100%" }}>
                
                {/* Ľavý stĺpec */}
                <div style={{ float: "left", width: "50%", boxSizing: "border-box", paddingRight: "8px" }}>
                  {renderMetric("distance", t("common.metrics.distance" as any) || "Vzdialenosť", distVal, distUnit || t("common.units.km" as any) || "km")}
                  
                  {/* Tempo alebo Rýchlosť (zobrazené, ak to nie je vypnuté) */}
                  {showPace && speedOrPaceVal && renderMetric("speed", speedOrPaceLabel, speedOrPaceVal, speedOrPaceUnit)}
                </div>

                {/* Pravý stĺpec */}
                <div style={{ float: "right", width: "50%", boxSizing: "border-box", paddingLeft: "8px" }}>
                  {showTime && renderMetric("time", t("common.metrics.time" as any) || "Čas", timeTxt, "")}
                  
                  {showElev && elev && elev > 0 && renderMetric("elevation", t("common.metrics.elevation" as any) || "Prevýšenie", elev, t("common.units.meter" as any) || "m")}
                </div>

                {/* Čistý riadok pred Heart Rate */}
                <div style={{ clear: "both" }}></div>

                {/* Tep na celú šírku dole */}
                {showHr && avgHr && avgHr > 0 && (
                   <div style={{ marginTop: "8px" }}>
                     {renderMetric("heartRate", t("common.metrics.hr_avg" as any) || "Priem. tep", avgHr, t("common.units.hr" as any) || "bpm")}
                   </div>
                )}
              </div>

              {/* PÄTIČKA */}
              <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", clear: "both" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <img 
                    src="/logo/actual/selfrace_logo.png" 
                    alt="SelfRace" 
                    crossOrigin="anonymous"
                    style={{ height: "20px", width: "auto", opacity: 0.9, objectFit: "contain" }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }} 
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Loading overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 rounded-[20px] flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse uppercase tracking-widest text-sm">
                 {t("share.generating" as any) || "Pripravujem..."}
              </span>
            </div>
          )}
        </div>

        {/* OVLÁDANIE DOLE */}
        <div className="w-full flex flex-col gap-3">
            <div className="p-4 bg-[#141414] rounded-[20px] border border-white/5 shadow-xl flex flex-col gap-4">
              
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase text-white/50 font-bold px-1">{t("share.theme" as any) || "Téma"}</span>
                  <SegmentedControl
                    options={[
                      { label: t("share.themeDark" as any) || "Tmavá", value: "dark" },
                      { label: t("share.themeLight" as any) || "Svetlá", value: "light" },
                    ]}
                    value={theme}
                    onChange={(val: any) => setTheme(val)}
                    disabled={isGenerating}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase text-white/50 font-bold px-1">{t("share.displayMode" as any) || "Zobrazenie"}</span>
                  <SegmentedControl
                    options={[
                      { label: t("share.modeIcon" as any) || "Ikony", value: "icon" },
                      { label: t("share.modeText" as any) || "Text", value: "text" },
                      { label: t("share.modeBoth" as any) || "Oboje", value: "both" },
                    ]}
                    value={displayMode}
                    onChange={(val: any) => setDisplayMode(val)}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-white/5">
                <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} label={t("common.metrics.hr_avg" as any) || "Priem. tep"} disabled={isGenerating} />
                
                {/* Dynamický label pre checkbox */}
                <Checkbox 
                  checked={showPace} 
                  onChange={(e) => setShowPace(e.currentTarget.checked)} 
                  label={speedOrPaceLabel} 
                  disabled={isGenerating} 
                />
                
                <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} label={t("common.metrics.time" as any) || "Čas"} disabled={isGenerating} />
                <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} label={t("common.metrics.elevation" as any) || "Prevýšenie"} disabled={isGenerating} />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Button 
                  variant="primary" 
                  block
                  disabled={isGenerating || !readyFile}
                  onClick={handleShare}
                >
                  {t("share.buttonShare" as any) || "Zdieľať fotku"}
                </Button>
              </div>
              <Button 
                variant="secondary"
                disabled={isGenerating}
                onClick={onClose}
              >
                {t("common.close" as any) || "Zavrieť"}
              </Button>
            </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
