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

function formatPaceFromSpeedMps(speed: number | null | undefined, t: any): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = String(Math.round(secPerKm % 60)).padStart(2, "0");
  return `${minutes}:${seconds} /km`;
}

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
  const pace = formatPaceFromSpeedMps(summary?.average_speed_mps, t);

  const sportColor = SPORT_COLORS[sport] || SPORT_COLORS.other;

  return (
    <div 
      ref={cardRef}
      // Využívame flexibilitu - 100% šírka rodiča, zachovaný štvorec
      className="w-full aspect-square bg-black text-white p-5 sm:p-6 relative flex flex-col justify-between border border-white/10"
      style={{ fontFamily: "sans-serif", boxSizing: "border-box" }} 
    >
      <div className="absolute top-0 left-0 right-0 h-2 sm:h-3" style={{ backgroundColor: sportColor }} />

      <div className="z-10 mt-1 sm:mt-2">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide leading-tight line-clamp-2">
          {title}
        </h2>
        <div className="text-white/50 text-[10px] sm:text-xs mt-1 uppercase font-bold tracking-widest">
          {dateStr} • {sport}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3 sm:gap-y-4 gap-x-2 z-10 mt-auto mb-auto">
        <div>
          <div className="text-[10px] uppercase font-bold opacity-50 mb-1">{t("common.metrics.distance" as any) || "Vzdialenosť"}</div>
          <div className="text-xl sm:text-2xl font-black">{distTxt}</div>
        </div>

        {showTime && (
          <div>
            <div className="text-[10px] uppercase font-bold opacity-50 mb-1">{t("common.metrics.time" as any) || "Čas"}</div>
            <div className="text-xl sm:text-2xl font-black">{timeTxt}</div>
          </div>
        )}

        {showPace && pace && (
          <div>
            <div className="text-[10px] uppercase font-bold opacity-50 mb-1">{t("common.metrics.pace" as any) || "Tempo"}</div>
            <div className="text-xl sm:text-2xl font-black">{pace}</div>
          </div>
        )}

        {showElev && elev && elev > 0 ? (
          <div>
            <div className="text-[10px] uppercase font-bold opacity-50 mb-1">{t("sessions.splits.colElev" as any) || "Prevýšenie"}</div>
            <div className="text-xl sm:text-2xl font-black">{elev} m</div>
          </div>
        ) : null}

        {showHr && avgHr > 0 && (
          <div className="col-span-2 mt-1 sm:mt-2">
            <div className="text-[10px] uppercase font-bold opacity-50 mb-1">{t("common.metrics.hr_avg" as any) || "Priemerný tep"}</div>
            <div className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2">
               <span className="text-red-500">❤️</span> {avgHr} bpm
            </div>
          </div>
        )}
      </div>

      <div className="z-10 flex justify-between items-end border-t border-white/20 pt-2 sm:pt-3 mt-2">
        {/* LOGO (nateraz textové, neskôr môžeš nahradiť <img src="/logo.svg"/>) */}
        <div className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
           <span style={{ color: sportColor }}>▲</span> SELFRACE
        </div>
      </div>

      <div 
        className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ backgroundColor: sportColor }}
      />
    </div>
  );
}