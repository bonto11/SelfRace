"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import Button from "@/app/shared/ui/components/Button";
import SegmentedControl from "@/app/shared/ui/components/SegmentedControl";
import { toast } from "@/app/shared/ui/components/Toast";

// Komponent pre metriku v JEDNOM RIADKU + Offset hack pri exporte
function MetricItem({
  iconName,
  label,
  value,
  unit,
  iconSuffix,
  displayMode,
  textColor,
  isDark,
  centered = false,
  isExporting = false, // Prijímame info, či sa práve fotí obrazovka
}: any) {
  const iconUrl = `/icons/${iconName}${iconSuffix}.png`;
  const [iconErr, setIconErr] = useState(false);

  useEffect(() => {
    setIconErr(false);
  }, [iconSuffix]);

  const showIcon = displayMode !== "text" && !iconErr;
  const showLabel = displayMode !== "icon";

  return (
    <div
      style={{
        marginBottom: "26px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: centered ? "center" : "flex-start",
      }}
    >
      {/* 1. NADPIS (Label) */}
      {showLabel && (
        <div
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            fontWeight: "bold",
            color: textColor,
            opacity: isDark ? 0.4 : 0.6,
            marginBottom: "4px",
            letterSpacing: "0.1em",
            lineHeight: 1,
            // Odsadenie aby lícoval s číslom: Šírka ikony (32) + medzera (10)
            marginLeft: showIcon && !centered ? "42px" : "0px",
          }}
        >
          {label}
        </div>
      )}

      {/* 2. RIADOK: IKONA + HODNOTA V JEDNOM RIADKU */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: centered ? "center" : "flex-start", gap: "10px" }}>
        
        {/* IKONA S HACKOM PRE HTML2CANVAS */}
        {showIcon && (
          <img
            src={iconUrl}
            crossOrigin="anonymous"
            style={{
              width: "32px",
              height: "32px",
              objectFit: "contain",
              flexShrink: 0,
              position: "relative",
              // TOTO JE TEN TRIK: Keď sa fotí, potlačíme ikonu o 8px dole. html2canvas ju posunie hore a vyrovná sa to.
              top: isExporting ? "8px" : "0px", 
              transition: "none", // Vypíname animáciu, aby to bolo okamžité
            }}
            onError={() => setIconErr(true)}
          />
        )}

        {/* HODNOTA A JEDNOTKA */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          {typeof value === "string" || typeof value === "number" ? (
            <span style={{ fontSize: "28px", fontWeight: 900, color: textColor, lineHeight: 1 }}>
              {value}
            </span>
          ) : (
            value
          )}
          
          {unit && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: textColor,
                opacity: 0.5,
              }}
            >
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityShareModal({
  isOpen,
  onClose,
  activity,
  summary,
}: any) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showElev, setShowElev] = useState(true);
  const [showTime, setShowTime] = useState(true);

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [displayMode, setDisplayMode] = useState<"icon" | "text" | "both">("both");

  // Nový state pre fotenie
  const [isExporting, setIsExporting] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("selfrace_share_prefs");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setShowHr(p.showHr ?? true);
        setShowPace(p.showPace ?? true);
        setShowElev(p.showElev ?? true);
        setShowTime(p.showTime ?? true);
        setTheme(p.theme ?? "dark");
        setDisplayMode(p.displayMode ?? "both");
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(
      "selfrace_share_prefs",
      JSON.stringify({ showHr, showPace, showElev, showTime, theme, displayMode })
    );
  }, [showHr, showPace, showElev, showTime, theme, displayMode, mounted]);

  const rawSport = summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other";
  const sport = String(rawSport).toLowerCase();
  const title = summary?.name || activity?.title || t("share.title");
  const dateStr = summary?.date ? new Date(summary.date).toLocaleDateString("sk-SK") : "";

  function formatPaceSeconds(totalSeconds: number | null | undefined): string | null {
    if (!totalSeconds || totalSeconds <= 0) return null;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.round(totalSeconds % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  }

  // Primitívna štruktúra textu pre čas s malými jednotkami
  function renderTimeValue(seconds: number | null | undefined, textColor: string) {
    if (!seconds || seconds <= 0) return <span style={{ fontSize: "28px", fontWeight: 900, color: textColor }}>—</span>;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);

    const valStyle = { fontSize: "28px", fontWeight: 900, color: textColor };
    const unitStyle = {
      fontSize: "12px",
      fontWeight: "bold",
      color: textColor,
      opacity: 0.5,
      marginLeft: "2px",
      marginRight: "6px",
    };

    if (h > 0) {
      return (
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={valStyle}>{h}</span><span style={unitStyle}>h</span>
          <span style={valStyle}>{m}</span><span style={{ ...unitStyle, marginRight: 0 }}>m</span>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={valStyle}>{m}</span><span style={unitStyle}>m</span>
        <span style={valStyle}>{s}</span><span style={{ ...unitStyle, marginRight: 0 }}>s</span>
      </div>
    );
  }

  const isSpeedSport = ["ride", "ebikeride", "virtualride", "velomobile", "inlineskate", "skate", "iceskate", "alpineski", "snowboard"].includes(sport);
  let speedOrPaceVal = isSpeedSport
    ? summary?.average_speed_mps ? (parseFloat(summary.average_speed_mps) * 3.6).toFixed(1) : null
    : formatPaceSeconds(summary?.pace_seconds_per_km);
  const speedOrPaceLabel = isSpeedSport ? t("common.metrics.speed") : t("common.metrics.pace");
  const speedOrPaceUnit = isSpeedSport ? `${t("common.units.km")}/${t("common.units.hour")}` : `${t("common.units.min")}/${t("common.units.km")}`;

  const distStr = summary ? formatDistance(summary.distance_m ?? null) : (activity?.distanceStr ?? "—");
  const distMatch = distStr.match(/^([\d.,]+)\s*(.*)$/);
  const distVal = distMatch ? distMatch[1] : distStr;
  const distUnit = distMatch ? distMatch[2] : "";
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;

  const isDark = theme === "dark";
  const cardBg = isDark ? appColors.brandDark : appColors.brandLight;
  const textColor = isDark ? appColors.brandLight : appColors.brandDark;
  const iconSuffix = isDark ? "" : "_darkGreen";
  const logoSuffix = isDark ? "" : "_darkGreen";

  useEffect(() => { setLogoError(false); }, [logoSuffix]);

  if (!isOpen || !mounted) return null;

  // GENERÁTOR PO KLIKNUTÍ (Nové riešenie)
  const handleShare = async () => {
    if (!cardRef.current) return;
    
    // 1. Zapneme Export mód (aplikuje sa CSS offset na ikony)
    setIsExporting(true);

    // 2. Dáme Reactu a DOMu chvíľu na prekrekslenie tých 8px
    await new Promise((r) => setTimeout(r, 150));

    try {
      // 3. Spravíme fotku do Canvasu
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });

      canvas.toBlob(async (blob) => {
        // 4. Hneď po odfotení vrátime ikony späť (vyzerá to ako blesknutie)
        setIsExporting(false);

        if (!blob) {
          toast.error(t("share.errorFailed"));
          return;
        }

        const file = new File([blob], "selfrace-training.png", { type: "image/png" });

        // 5. Otvoríme zdieľací dialóg
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ title: t("share.title"), files: [file] });
            onClose();
          } catch (e: any) {
            if (e.name !== "AbortError") toast.error(t("share.errorFailed"));
          }
        } else {
          // Fallback na stiahnutie súboru
          const url = URL.createObjectURL(file);
          const a = document.createElement("a"); 
          a.href = url; 
          a.download = "selfrace-trening.png";
          document.body.appendChild(a); 
          a.click(); 
          document.body.removeChild(a); 
          URL.revokeObjectURL(url);
          toast.success(t("share.successDownload")); 
          onClose();
        }
      }, "image/png");

    } catch (e) {
      setIsExporting(false);
      toast.error(t("share.errorFailed"));
    }
  };

  const activeMetrics = [];

  activeMetrics.push(
    <MetricItem key="dist" iconName="distance" label={t("common.metrics.distance")} value={distVal} unit={distUnit || t("common.units.km")} displayMode={displayMode} textColor={textColor} isDark={isDark} iconSuffix={iconSuffix} centered={false} isExporting={isExporting} />,
  );

  if (showTime) {
    const timeSecs = summary?.moving_time_s ?? activity?.moving_time_s ?? 0;
    activeMetrics.push(
      <MetricItem key="time" iconName="time" label={t("common.metrics.time")} value={renderTimeValue(timeSecs, textColor)} unit="" displayMode={displayMode} textColor={textColor} isDark={isDark} iconSuffix={iconSuffix} centered={false} isExporting={isExporting} />,
    );
  }

  if (showPace && speedOrPaceVal) {
    activeMetrics.push(
      <MetricItem key="pace" iconName="speed" label={speedOrPaceLabel} value={speedOrPaceVal} unit={speedOrPaceUnit} displayMode={displayMode} textColor={textColor} isDark={isDark} iconSuffix={iconSuffix} centered={false} isExporting={isExporting} />,
    );
  }

  if (showElev && elev && elev > 0) {
    activeMetrics.push(
      <MetricItem key="elev" iconName="elevation" label={t("common.metrics.elevation")} value={elev} unit={t("common.units.meter")} displayMode={displayMode} textColor={textColor} isDark={isDark} iconSuffix={iconSuffix} centered={false} isExporting={isExporting} />,
    );
  }

  if (showHr && avgHr && avgHr > 0) {
    activeMetrics.push(
      <MetricItem key="hr" iconName="heartRate" label={t("common.metrics.hr_avg")} value={avgHr} unit={t("common.units.hr")} displayMode={displayMode} textColor={textColor} isDark={isDark} iconSuffix={iconSuffix} centered={false} isExporting={isExporting} />,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-sm flex flex-col gap-4 mt-auto mb-auto pt-6 pb-6">
        <div className="relative">
          <div
            ref={cardRef}
            className="w-full relative overflow-hidden rounded-[24px] shadow-2xl border border-white/5 transition-colors duration-300"
            style={{ backgroundColor: cardBg, fontFamily: "sans-serif" }}
          >
            <div style={{ height: "6px", width: "100%", backgroundColor: appColors.brandPrimary }} />

            <div style={{ padding: "36px 28px 46px 28px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              
              <div style={{ marginBottom: "24px" }}>
                {!logoError && (
                  <img
                    src={`/logo/actual/selfrace_logo${logoSuffix}.png`}
                    alt="SelfRace"
                    crossOrigin="anonymous"
                    style={{ height: "24px", width: "auto", objectFit: "contain", display: "block" }}
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>

              <div style={{ textAlign: "center", marginBottom: "36px", width: "100%" }}>
                <h2 style={{ fontSize: "24px", fontWeight: 900, textTransform: "uppercase", color: textColor, margin: 0, lineHeight: 1.2, letterSpacing: "0.02em" }}>
                  {title}
                </h2>
                <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "bold", color: textColor, opacity: 0.5, marginTop: "8px", letterSpacing: "0.15em" }}>
                  {dateStr} • {t(`common.sports.${sport}` as any)}
                </div>
              </div>

              {/* JEDNOTNÁ KASKÁDA */}
              <div style={{ width: "100%", display: "flex", flexWrap: "wrap", marginBottom: "0px" }}>
                {activeMetrics.map((item, index) => {
                  const isOddLast = activeMetrics.length % 2 !== 0 && index === activeMetrics.length - 1;

                  return (
                    <div
                      key={item.key}
                      style={{
                        width: isOddLast ? "100%" : "50%",
                        display: "flex",
                        justifyContent: isOddLast ? "center" : "flex-start",
                        boxSizing: "border-box",
                        paddingRight: !isOddLast && index % 2 === 0 ? "8px" : "0",
                        paddingLeft: !isOddLast && index % 2 !== 0 ? "8px" : "0",
                      }}
                    >
                      {React.cloneElement(item, { centered: isOddLast })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Overlay sa zobrazí pri exporte */}
          {isExporting && (
            <div className="absolute inset-0 bg-black/60 rounded-[24px] flex items-center justify-center z-50">
              <span className="text-white font-bold animate-pulse uppercase tracking-widest text-xs">
                {t("share.generating")}
              </span>
            </div>
          )}
        </div>

        {/* OVLÁDANIE DOLE */}
        <div className="w-full flex flex-col gap-3">
          <div className="p-4 bg-[#141414] rounded-[24px] border border-white/5 shadow-xl flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-white/50 font-bold px-1">{t("share.theme")}</span>
                <SegmentedControl options={[{ label: t("share.themeDark"), value: "dark" }, { label: t("share.themeLight"), value: "light" }]} value={theme} onChange={(val: any) => setTheme(val)} disabled={isExporting} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-white/50 font-bold px-1">{t("share.displayMode")}</span>
                <SegmentedControl options={[{ label: t("share.modeIcon"), value: "icon" }, { label: t("share.modeText"), value: "text" }, { label: t("share.modeBoth"), value: "both" }]} value={displayMode} onChange={(val: any) => setDisplayMode(val)} disabled={isExporting} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-white/5">
              <Checkbox checked={showHr} onChange={(e) => setShowHr(e.currentTarget.checked)} label={t("common.metrics.hr_avg")} disabled={isExporting} />
              <Checkbox checked={showPace} onChange={(e) => setShowPace(e.currentTarget.checked)} label={speedOrPaceLabel} disabled={isExporting} />
              <Checkbox checked={showTime} onChange={(e) => setShowTime(e.currentTarget.checked)} label={t("common.metrics.time")} disabled={isExporting} />
              <Checkbox checked={showElev} onChange={(e) => setShowElev(e.currentTarget.checked)} label={t("common.metrics.elevation")} disabled={isExporting} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              {/* Zmenené tlačidlo na spúšťač exportu */}
              <Button variant="primary" block disabled={isExporting} onClick={handleShare}>
                {isExporting ? t("share.generating") : t("share.buttonShare")}
              </Button>
            </div>
            <Button variant="secondary" disabled={isExporting} onClick={onClose}>{t("common.close")}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
