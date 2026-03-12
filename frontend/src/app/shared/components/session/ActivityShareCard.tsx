"use client";

import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useRef } from "react";

const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  swim: appColors.chartSwim,
  strength: appColors.chartStrength,
  other: appColors.chartOther,
};

function formatPaceFromSpeedMps(speed: number | null | undefined): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = String(Math.round(secPerKm % 60)).padStart(2, "0");
  return `${minutes}:${seconds} /km`;
}

// Mapovanie emoji ikon
const ICONS = {
  distance: "📏", 
  time: "⏱️",
  pace: "⚡",
  elev: "⛰️",
  hr: "❤️",
};

export default function ActivityShareCard({ 
  activity, 
  summary, 
  showHr = true,
  showPace = true,
  showTime = true,
  showElev = true,
  cardRef 
}: any) {
  const t = useT();

  const sport = (summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other").toLowerCase();
  const title = summary?.name || activity?.title || (t("sessions.detail.newActivityTitle" as any) || "Nový tréning");
  const dateStr = summary?.date ? new Date(summary.date).toLocaleDateString("sk-SK") : "";

  const distTxt = summary ? formatDistance(summary.distance_m ?? null) : activity?.distanceStr ?? "—";
  const timeTxt = summary && summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : activity?.timeStr ?? "—";
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;
  const pace = formatPaceFromSpeedMps(summary?.average_speed_mps);

  const sportColor = SPORT_COLORS[sport] || SPORT_COLORS.other;

  return (
    // Používame pevnú, ale rozumnú veľkosť, ktorá sa zmestí na iPhone (napr. 340px)
    <div 
      ref={cardRef}
      className="w-[340px] flex flex-col relative overflow-hidden rounded-2xl border shadow-2xl"
      // Farba pozadia pre kartu (ako tmavá zelená z tvojej aplikácie)
      style={{ 
        backgroundColor: "#0d1b11", // Prispôsob kód farby podľa svojej hlavnej tmavo-zelenej
        borderColor: "rgba(255,255,255,0.1)",
        fontFamily: "sans-serif" 
      }} 
    >
      {/* Farebný pásik hore podľa športu */}
      <div className="h-2 w-full" style={{ backgroundColor: sportColor }} />

      <div className="p-6 relative z-10">
        
        {/* Hlavička */}
        <div className="mb-6">
          <h2 className="text-2xl font-black uppercase tracking-wide leading-tight line-clamp-2 text-white">
            {title}
          </h2>
          <div className="text-white/60 text-xs mt-1 uppercase font-bold tracking-widest">
            {dateStr} • {sport}
          </div>
        </div>

        {/* Štatistiky v mriežke */}
        <div className="grid grid-cols-2 gap-y-5 gap-x-4">
          
          <div className="flex flex-col">
            <div className="text-white/50 text-xs font-bold mb-1 flex items-center gap-1.5 uppercase">
              <span>{ICONS.distance}</span> {t("common.metrics.distance" as any) || "Vzdialenosť"}
            </div>
            <div className="text-2xl font-black text-white">{distTxt}</div>
          </div>

          {showTime && (
            <div className="flex flex-col">
              <div className="text-white/50 text-xs font-bold mb-1 flex items-center gap-1.5 uppercase">
                <span>{ICONS.time}</span> {t("common.metrics.time" as any) || "Čas"}
              </div>
              <div className="text-2xl font-black text-white">{timeTxt}</div>
            </div>
          )}

          {showPace && pace && (
            <div className="flex flex-col">
              <div className="text-white/50 text-xs font-bold mb-1 flex items-center gap-1.5 uppercase">
                <span>{ICONS.pace}</span> {t("common.metrics.pace" as any) || "Tempo"}
              </div>
              <div className="text-2xl font-black text-white">{pace}</div>
            </div>
          )}

          {showElev && elev && elev > 0 && (
            <div className="flex flex-col">
              <div className="text-white/50 text-xs font-bold mb-1 flex items-center gap-1.5 uppercase">
                <span>{ICONS.elev}</span> {t("sessions.splits.colElev" as any) || "Prevýšenie"}
              </div>
              <div className="text-2xl font-black text-white">{elev} m</div>
            </div>
          )}

          {showHr && avgHr && avgHr > 0 && (
            <div className="flex flex-col col-span-2">
              <div className="text-white/50 text-xs font-bold mb-1 flex items-center gap-1.5 uppercase">
                 <span>{ICONS.hr}</span> {t("common.metrics.hr_avg" as any) || "Priemerný tep"}
              </div>
              <div className="text-xl font-bold text-white">
                 {avgHr} bpm
              </div>
            </div>
          )}
        </div>

        {/* Pätička / Značka */}
        <div className="flex justify-between items-center mt-6 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            {/* Logo SelfRace (môžeš neskôr nahradiť reálnym img) */}
            <div className="text-yellow-500 font-black text-sm">▲</div>
            <span className="text-xs font-bold text-white/50 tracking-wider">SELFRACE</span>
          </div>
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: sportColor }} />
        </div>

      </div>
      
      {/* Ozdobný blur efekt vzadu */}
      <div 
        className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ backgroundColor: sportColor }}
      />
    </div>
  );
}