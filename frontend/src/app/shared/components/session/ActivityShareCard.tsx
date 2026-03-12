"use client";

import { useT } from "@/app/shared/i18n/useT";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";

// Zjednodušené farby pre športy
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
  return `${minutes}:${seconds} ${t("common.units.pace")}`;
}

export default function ActivityShareCard({ 
  activity, 
  summary, 
  showHr = true,
  cardRef 
}: any) {
  const t = useT();

  // Základné dáta
  const sport = (summary?.sport_type_ovrd ?? summary?.sport_type_fe ?? summary?.sport_type ?? activity?.sport ?? "other").toLowerCase();
  const title = summary?.name || activity?.title || (t("sessions.detail.newActivityTitle" as any) || "Nový tréning");
  const dateStr = summary?.date ? new Date(summary.date).toLocaleDateString("sk-SK") : "";

  // Štatistiky
  const distTxt = summary ? formatDistance(summary.distance_m ?? null) : activity?.distanceStr ?? "—";
  const timeTxt = summary && summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : activity?.timeStr ?? "—";
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;
  const pace = formatPaceFromSpeedMps(summary?.average_speed_mps, t);

  const sportColor = SPORT_COLORS[sport] || SPORT_COLORS.other;

  return (
    <div 
      // Vynútime pevnú veľkosť pre IG post (štvorec) a čierne pozadie
      ref={cardRef}
      className="w-[400px] h-[400px] bg-black text-white p-8 relative overflow-hidden flex flex-col justify-between"
      style={{ fontFamily: "sans-serif" }} 
    >
      {/* Farebný pásik hore */}
      <div 
        className="absolute top-0 left-0 right-0 h-3" 
        style={{ backgroundColor: sportColor }} 
      />

      {/* Hlavička */}
      <div className="z-10 mt-2">
        <h2 className="text-2xl font-bold uppercase tracking-wide leading-tight line-clamp-2">
          {title}
        </h2>
        <div className="text-white/50 text-sm mt-1 uppercase font-bold tracking-wider">
          {dateStr} • {sport.toUpperCase()}
        </div>
      </div>

      {/* Mriežka so štatistikami */}
      <div className="grid grid-cols-2 gap-4 z-10">
        <div>
          <div className="text-xs uppercase font-bold opacity-50 mb-1">{t("common.metrics.distance")}</div>
          <div className="text-3xl font-black">{distTxt}</div>
        </div>

        <div>
          <div className="text-xs uppercase font-bold opacity-50 mb-1">{t("common.metrics.time")}</div>
          <div className="text-3xl font-black">{timeTxt}</div>
        </div>

        {pace && (
          <div>
            <div className="text-xs uppercase font-bold opacity-50 mb-1">{t("common.metrics.pace")}</div>
            <div className="text-3xl font-black">{pace}</div>
          </div>
        )}

        {elev && elev > 0 && (
          <div>
            <div className="text-xs uppercase font-bold opacity-50 mb-1">{t("sessions.splits.colElev")}</div>
            <div className="text-3xl font-black">{elev} m</div>
          </div>
        )}

        {showHr && avgHr > 0 && (
          <div className="col-span-2 mt-2">
            <div className="text-xs uppercase font-bold opacity-50 mb-1">{t("common.metrics.hr_avg")}</div>
            <div className="text-xl font-bold flex items-center gap-2">
               <span className="text-red-500">❤️</span> {avgHr} bpm
            </div>
          </div>
        )}
      </div>

      {/* Pätička */}
      <div className="z-10 flex justify-between items-end border-t border-white/20 pt-4 mt-4">
        <div className="text-xs font-bold text-white/40">Powered by SelfRace</div>
        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: sportColor }} />
      </div>

      {/* Dekoratívne kruhy v pozadí */}
      <div 
        className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ backgroundColor: sportColor }}
      />
    </div>
  );
}
