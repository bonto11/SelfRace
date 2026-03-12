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

function formatPaceFromSpeedMps(
  speed: number | null | undefined,
): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = String(Math.round(secPerKm % 60)).padStart(2, "0");
  return `${minutes}:${seconds} /km`;
}

// Jemné, prehľadné emoji pre štatistiky
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
  cardRef,
}: any) {
  const t = useT();

  const sport = (
    summary?.sport_type_ovrd ??
    summary?.sport_type_fe ??
    summary?.sport_type ??
    activity?.sport ??
    "other"
  ).toLowerCase();
  const title =
    summary?.name ||
    activity?.title ||
    t("sessions.detail.newActivityTitle" as any) ||
    "Nový tréning";
  const dateStr = summary?.date
    ? new Date(summary.date).toLocaleDateString("sk-SK")
    : "";

  const distTxt = summary
    ? formatDistance(summary.distance_m ?? null)
    : (activity?.distanceStr ?? "—");
  const timeTxt =
    summary && summary.moving_time_s != null
      ? fmtSecondsHMS(summary.moving_time_s)
      : (activity?.timeStr ?? "—");
  const avgHr = summary ? summary.average_heartrate_bpm : activity?.avgHr;
  const elev = summary?.elevation_gain_m;
  const pace = formatPaceFromSpeedMps(summary?.average_speed_mps);

  const sportColor = SPORT_COLORS[sport] || SPORT_COLORS.other;

  return (
    <div
      ref={cardRef}
      // Nastavili sme pevnú šírku a výšku (ideálny obdĺžnik 4:5 pre Instagram)
      className="w-[340px] h-[425px] flex flex-col relative overflow-hidden rounded-2xl shadow-2xl border"
      style={{
        backgroundColor: "#0A1A12", // ✅ Krásna tmavá "SelfRace" zelená
        borderColor: "rgba(255,255,255,0.08)",
        fontFamily: "sans-serif",
      }}
    >
      {/* Farebný pásik hore podľa športu */}
      <div
        className="h-2 w-full shrink-0"
        style={{ backgroundColor: sportColor }}
      />

      <div className="p-7 relative z-10 flex flex-col h-full">
        {/* Hlavička */}
        <div className="mb-6">
          {/* ✅ Oprava pre useknutý font: pridali sme pt-1 a leading-normal */}
          <h2 className="text-2xl font-black uppercase tracking-wide leading-normal line-clamp-2 text-white pt-1">
            {title}
          </h2>
          <div className="text-white/50 text-xs mt-1 uppercase font-bold tracking-widest">
            {dateStr} • {sport}
          </div>
        </div>

        {/* Štatistiky v mriežke */}
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-auto">
          <div className="flex flex-col">
            <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
              <span className="text-sm">{ICONS.distance}</span> Vzdialenosť
            </div>
            <div className="text-[26px] font-black text-white leading-none">
              {distTxt}
            </div>
          </div>

          {showTime && (
            <div className="flex flex-col">
              <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                <span className="text-sm">{ICONS.time}</span> Čas
              </div>
              <div className="text-[26px] font-black text-white leading-none">
                {timeTxt}
              </div>
            </div>
          )}

          {showPace && pace && (
            <div className="flex flex-col">
              <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                <span className="text-sm">{ICONS.pace}</span> Tempo
              </div>
              <div className="text-[26px] font-black text-white leading-none">
                {pace}
              </div>
            </div>
          )}

          {showElev && elev && elev > 0 ? (
            <div className="flex flex-col">
              <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                <span className="text-sm">{ICONS.elev}</span> Prevýšenie
              </div>
              <div className="text-[26px] font-black text-white leading-none">
                {elev} m
              </div>
            </div>
          ) : null}

          {showHr && avgHr && avgHr > 0 ? (
            <div className="flex flex-col col-span-2">
              <div className="text-white/40 text-[11px] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                <span className="text-sm">{ICONS.hr}</span> Priem. tep
              </div>
              <div className="text-[22px] font-bold text-white leading-none">
                {avgHr} bpm
              </div>
            </div>
          ) : null}
        </div>

        {/* Pätička / Značka */}
        <div className="flex justify-between items-center pt-5 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            {/* ✅ Odkaz na logo s crossOrigin="anonymous", aby ho html2canvas vedel stiahnuť */}
            <img
              src="/logo/actual/selfrace_icon.svg"
              alt="Logo"
              crossOrigin="anonymous"
              className="w-5 h-5 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement?.insertAdjacentHTML(
                  "afterbegin",
                  `<span style="color: ${appColors.brandPrimary}; font-size: 16px;">▲</span>`,
                );
              }}
            />
            <span className="text-[11px] font-bold text-white/50 tracking-[0.2em] mt-0.5">
              SELFRACE
            </span>
          </div>
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: sportColor }}
          />
        </div>
      </div>
    </div>
  );
}
