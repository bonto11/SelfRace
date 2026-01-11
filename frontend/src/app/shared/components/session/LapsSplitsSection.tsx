"use client";

import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { formatDistance } from "@/app/shared/utils/distance";

type LapsSplitsSectionProps = {
  kind: "splits" | "laps";
  items: any[];
};

type NormalizedRow = {
  index: number;
  label: string;
  distance_m: number | null;
  moving_time_s: number | null;
  avg_hr_bpm: number | null;
  elev_diff_m: number | null;
};

function formatPaceFromLap(distance_m: number | null, time_s: number | null) {
  if (!distance_m || !time_s || distance_m <= 0 || time_s <= 0) return "—";
  const km = distance_m / 1000;
  const secPerKm = time_s / km;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  const secStr = String(seconds).padStart(2, "0");
  return `${minutes}:${secStr} min/km`;
}

/**
 * Snaží sa z rôznych možných názvov stĺpcov spraviť jednotnú štruktúru.
 * Keď neskôr upresníme schému, doplníme mapping sem.
 */
function normalizeItems(kind: "splits" | "laps", items: any[]): NormalizedRow[] {
  return items.map((it, i) => {
    const idx =
      (kind === "splits" ? it.split_index : it.lap_index) ??
      it.index ??
      i + 1;

    const distance_m: number | null =
      it.distance_m ??
      it.dist_m ??
      it.distance ??
      null;

    const moving_time_s: number | null =
      it.moving_time_s ??
      it.moving_time ??
      it.elapsed_time_s ??
      it.elapsed_time ??
      null;

    const avg_hr_bpm: number | null =
      it.average_heartrate_bpm ??
      it.avg_hr_bpm ??
      it.avg_hr ??
      null;

    const elev_diff_m: number | null =
      it.elev_diff_m ??
      it.elevation_diff_m ??
      it.elevation_gain_m ??
      it.elev_gain_m ??
      null;

    return {
      index: Number(idx),
      label: `${kind === "splits" ? "Split" : "Lap"} ${idx}`,
      distance_m,
      moving_time_s,
      avg_hr_bpm,
      elev_diff_m,
    };
  });
}

export default function LapsSplitsSection({
  kind,
  items,
}: LapsSplitsSectionProps) {
  if (!items || items.length === 0) {
    return <div className="opacity-80 text-sm">Žiadne dáta.</div>;
  }

  const rows = normalizeItems(kind, items).filter(
    (r) => r.moving_time_s != null && r.moving_time_s > 0
  );

  if (!rows.length) {
    return <div className="opacity-80 text-sm">Žiadne validné dáta.</div>;
  }

  const totalTime = rows.reduce(
    (acc, r) => acc + (r.moving_time_s ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Trend – šírka stĺpcov podľa času */}
      <div>
        <div className="flex gap-1 w-full h-6">
          {rows.map((row) => {
            const t = row.moving_time_s ?? 0;
            // flexGrow podľa času => relatívna šírka
            const flexGrow = t > 0 ? t : 0.0001;

            return (
              <div
                key={row.index}
                className="relative h-full rounded-sm bg-emerald-500/70 hover:bg-emerald-400/80 transition-colors"
                style={{
                  flexGrow,
                  flexBasis: 0,
                }}
                title={`${row.label} – ${fmtSecondsHMS(
                  row.moving_time_s ?? 0
                )}`}
              >
                {/* malý text vnútri, ale len ak je bar dosť široký */}
                <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center">
                  <span className="text-[10px] leading-none font-semibold text-black/80 mix-blend-screen select-none">
                    {row.index}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 text-[11px] opacity-70">
          Total time: {fmtSecondsHMS(totalTime)}
        </div>
      </div>

      {/* Tabuľka s detailmi */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-1 pr-2 font-semibold opacity-80">
                #
              </th>
              <th className="text-left py-1 px-2 font-semibold opacity-80">
                Distance
              </th>
              <th className="text-left py-1 px-2 font-semibold opacity-80">
                Time
              </th>
              <th className="text-left py-1 px-2 font-semibold opacity-80">
                Pace
              </th>
              <th className="text-left py-1 px-2 font-semibold opacity-80">
                Avg HR
              </th>
              <th className="text-left py-1 pl-2 font-semibold opacity-80">
                Elev. Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`row-${row.index}`}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="py-1 pr-2 whitespace-nowrap">
                  {row.index}
                </td>
                <td className="py-1 px-2 whitespace-nowrap">
                  {row.distance_m != null
                    ? formatDistance(row.distance_m)
                    : "—"}
                </td>
                <td className="py-1 px-2 whitespace-nowrap">
                  {row.moving_time_s != null
                    ? fmtSecondsHMS(row.moving_time_s)
                    : "—"}
                </td>
                <td className="py-1 px-2 whitespace-nowrap">
                  {formatPaceFromLap(
                    row.distance_m,
                    row.moving_time_s
                  )}
                </td>
                <td className="py-1 px-2 whitespace-nowrap">
                  {row.avg_hr_bpm != null ? `${row.avg_hr_bpm} bpm` : "—"}
                </td>
                <td className="py-1 pl-2 whitespace-nowrap">
                  {row.elev_diff_m != null ? `${row.elev_diff_m} m` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}