"use client";

import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";

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

// Mapovanie emoji ikon namiesto textov
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
  showElev = true,
  showTime = true,
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
    <div 
      ref={cardRef}
      // Pevná, kompaktná šírka. Výška sa prispôsobí obsahu (obdĺžnik).
      className="w-[320px] flex flex-col relative overflow-hidden rounded-[20px] shadow-2xl border"
      style={{ 
        backgroundColor: "#0b160f", // Tmavá "SelfRace" zelená
        borderColor: "rgba(255,255,255,0.08)",
        fontFamily: "sans-serif" 
      }} 
    >
      {/* Farebný pásik hore podľa športu */}
      <div className="h-2 w-full" style={{ backgroundColor: sportColor }} />

      <div className="p-6 relative z-10 flex flex-col h-full">
        
        {/* Hlavička */}
        <div className="mb-6">
          <h2 className="text-xl font-black uppercase tracking-wide leading-tight line-clamp-2 text-white">
            {title}
          </h2>
          <div className="text-white/50 text-[10px] mt-1.5 uppercase font-bold tracking-widest">
            {dateStr} • {sport}
          </div>
        </div>

        {/* Štatistiky v mriežke (iba Piktogram a Hodnota) */}
        <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-6">
          
          <div className="flex flex-col">
            <div className="text-white/40 text-xs mb-1">{ICONS.distance}</div>
            <div className="text-2xl font-black text-white leading-none">{distTxt}</div>
          </div>

          {showTime && (
            <div className="flex flex-col">
              <div className="text-white/40 text-xs mb-1">{ICONS.time}</div>
              <div className="text-2xl font-black text-white leading-none">{timeTxt}</div>
            </div>
          )}

          {showPace && pace && (
            <div className="flex flex-col">
              <div className="text-white/40 text-xs mb-1">{ICONS.pace}</div>
              <div className="text-2xl font-black text-white leading-none">{pace}</div>
            </div>
          )}

          {showElev && elev && elev > 0 ? (
            <div className="flex flex-col">
              <div className="text-white/40 text-xs mb-1">{ICONS.elev}</div>
              <div className="text-2xl font-black text-white leading-none">{elev} m</div>
            </div>
          ) : null}

          {showHr && avgHr && avgHr > 0 ? (
            <div className="flex flex-col col-span-2">
              <div className="text-white/40 text-xs mb-1">{ICONS.hr}</div>
              <div className="text-xl font-bold text-white leading-none">
                 {avgHr} bpm
              </div>
            </div>
          ) : null}
        </div>

        {/* Pätička / Značka */}
        <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            {/* Odkaz na public/logo.svg */}
            <img src="/logo/actual/selfrace_logo.svg" alt="SelfRace Logo" className="w-5 h-5 opacity-80" onError={(e) => {
              // Ak náhodou logo.svg nemáš v public/, fallback na zelený trojuholník
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<span style="color: ${appColors.brandPrimary}; font-size: 14px;">▲</span>`);
            }} />
            <span className="text-[10px] font-bold text-white/50 tracking-[0.2em] mt-0.5">SELFRACE</span>
          </div>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sportColor }} />
        </div>

      </div>
      
      {/* Jemný glow vpravo dole */}
      <div 
        className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ backgroundColor: sportColor }}
      />
    </div>
  );
}