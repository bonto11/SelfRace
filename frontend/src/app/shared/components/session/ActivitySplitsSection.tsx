"use client";

import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { formatDistance } from "@/app/shared/utils/distance";

type Props = {
  // sem pošleš buď splits alebo laps – je to len pole objektov
  kind: any[];
};

type SplitRow = {
  index: number;
  distance_m: number | null;
  time_s: number | null;
  pace_s_per_km: number | null;
  avg_hr_bpm: number | null;
  elev_delta_m: number | null;
};

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatSplitDistance(distance_m: number | null): string {
  if (distance_m == null) return "—";

  // 1 km ± 10 m -> zobraz "1 km"
  if (Math.abs(distance_m - 1000) <= 10) {
    return "1 km";
  }

  return formatDistance(distance_m);
}

function formatPace(pace_s_per_km: number | null): string {
  if (pace_s_per_km == null || pace_s_per_km <= 0) return "—";
  const total = Math.round(pace_s_per_km);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  const secStr = String(sec).padStart(2, "0");
  return `${min}m ${secStr}s /km`;
}

function formatHr(hr: number | null): string {
  if (hr == null || hr <= 0) return "—";
  return `${Math.round(hr)} bpm`;
}

function formatElev(elev: number | null): string {
  if (elev == null || !Number.isFinite(elev)) return "—";
  // bez "m", kvôli zarovnaniu; jednotku dáme do headeru
  return Math.round(elev).toString();
}

function buildRows(data: any[]): SplitRow[] {
  return data.map((sp, i) => {
    const distance_m =
      toNumber(sp.distance_m) ??
      toNumber(sp.distance) ??
      null;

    const time_s =
      toNumber(sp.moving_time_s) ??
      toNumber(sp.elapsed_time_s) ??
      null;

    const pace_s_per_km =
      toNumber(sp.pace_s_per_km) ??
      (() => {
        if (!distance_m || !time_s || distance_m <= 0) return null;
        return time_s / (distance_m / 1000);
      })();

    const avg_hr_bpm =
      toNumber(sp.avg_hr_bpm) ??
      toNumber(sp.average_heartrate_bpm) ??
      toNumber(sp.avg_hr) ??
      null;

    const elev_delta_m =
      toNumber(sp.elev_delta_m) ??
      toNumber(sp.elev_diff_m) ??
      toNumber(sp.elevation_diff_m) ??
      toNumber(sp.elevation_gain_m) ??
      null;

    return {
      index: i + 1,
      distance_m,
      time_s,
      pace_s_per_km,
      avg_hr_bpm,
      elev_delta_m,
    };
  });
}

// škálovanie výšky barov podľa hodnôt
function makeHeightScaler(
  values: (number | null)[],
  minPx = 4,
  maxPx = 18
): (v: number | null) => number {
  const nums = values.filter((v) => v != null && Number.isFinite(v)) as number[];
  if (!nums.length) {
    return () => (minPx + maxPx) / 2;
  }

  let min = nums[0];
  let max = nums[0];
  for (const v of nums) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (min === max) {
    return () => (minPx + maxPx) / 2;
  }

  return (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return minPx;
    const t = (v - min) / (max - min);
    return minPx + t * (maxPx - minPx);
  };
}

export function ActivitySplitsSection({ kind }: Props) {
  const rows = buildRows(Array.isArray(kind) ? kind : []).filter(
    (r) => r.time_s != null
  );

  if (!rows.length) {
    return (
      <div className="text-sm opacity-80">
        Žiadne dáta.
      </div>
    );
  }

  const totalTime =
    rows.reduce((acc, r) => acc + (r.time_s ?? 0), 0) || 0;

  const widthPct = (time_s: number | null): number => {
    if (!time_s || totalTime <= 0) return 0;
    const pct = (time_s / totalTime) * 100;
    return Math.max(pct, 2); // nech nie je úplne neviditeľný
  };

  return (
    <div className="text-xs sm:text-[13px]">
      {/* TOP – trendy */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] opacity-70">
          Total time: {fmtSecondsHMS(totalTime)}
        </div>

        <div className="space-y-1.5">
          {/* Time row */}
          <MetricBarRow
            label="Time"
            rows={rows}
            widthPct={widthPct}
            colorClass="bg-emerald-500/80"
            getValue={(r) => r.time_s}
          />

          {/* Pace row */}
          <MetricBarRow
            label="Pace"
            rows={rows}
            widthPct={widthPct}
            colorClass="bg-sky-500/80"
            getValue={(r) => r.pace_s_per_km}
          />

          {/* HR row */}
          <MetricBarRow
            label="HR"
            rows={rows}
            widthPct={widthPct}
            colorClass="bg-rose-500/80"
            getValue={(r) => r.avg_hr_bpm}
          />

          {/* Elevation row – berieme absolútnu hodnotu */}
          <MetricBarRow
            label="Elev."
            rows={rows}
            widthPct={widthPct}
            colorClass="bg-amber-500/80"
            getValue={(r) =>
              r.elev_delta_m != null ? Math.abs(r.elev_delta_m) : null
            }
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="border-b border-white/10">
            <tr className="text-[11px] uppercase tracking-wide opacity-70">
              <th className="py-1 pr-2 text-right">#</th>
              <th className="py-1 pr-2 text-left">Distance</th>
              <th className="py-1 pr-2 text-left">Time</th>
              <th className="py-1 pr-2 text-left">Pace</th>
              <th className="py-1 pr-2 text-right">Avg HR</th>
              <th className="py-1 pl-2 text-right">
                Elev. Δ (m)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.index}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="py-1 pr-2 text-right tabular-nums">
                  {r.index}
                </td>
                <td className="py-1 pr-2">
                  {formatSplitDistance(r.distance_m)}
                </td>
                <td className="py-1 pr-2 tabular-nums">
                  {r.time_s != null
                    ? fmtSecondsHMS(r.time_s)
                    : "—"}
                </td>
                <td className="py-1 pr-2 tabular-nums">
                  {formatPace(r.pace_s_per_km)}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {formatHr(r.avg_hr_bpm)}
                </td>
                <td className="py-1 pl-2 text-right tabular-nums">
                  {formatElev(r.elev_delta_m)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type MetricBarRowProps = {
  label: string;
  rows: SplitRow[];
  widthPct: (time_s: number | null) => number;
  colorClass: string;
  getValue: (r: SplitRow) => number | null;
};

function MetricBarRow({
  label,
  rows,
  widthPct,
  colorClass,
  getValue,
}: MetricBarRowProps) {
  // heights podľa hodnoty metriky
  const values = rows.map((r) => getValue(r));
  const heightFor = makeHeightScaler(values, 4, 18);

  return (
    <div className="flex items-center gap-2">
      <div className="w-14 shrink-0 text-[11px] opacity-75">
        {label}
      </div>
      <div className="flex-1 flex items-end gap-[3px] h-5">
        {rows.map((r) => {
          const hPx = heightFor(getValue(r));
          const w = widthPct(r.time_s);
          return (
            <div
              key={`${label}-${r.index}`}
              className={`rounded-sm ${colorClass} flex-none`}
              style={{
                width: `${w}%`,
                height: `${hPx}px`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}