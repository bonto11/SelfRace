"use client";

import { fmtSecondsHMS } from "@/app/shared/utils/time";

type Props = {
  // sem posielaš splits alebo laps
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

// 1 km ± 10 m -> 1.00, inak km s 2 des. miestami (bez jednotky)
function formatSplitDistance(distance_m: number | null): string {
  if (distance_m == null) return "—";

  if (Math.abs(distance_m - 1000) <= 10) return "1.00";

  const km = distance_m / 1000;
  return km.toFixed(2);
}

// krátky čas do tabuľky:  mm:ss alebo h:mm:ss, bez „h/m/s“
function formatTimeShort(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

// tempo: mm:ss (jednotka v headri)
function formatPace(pace_s_per_km: number | null): string {
  if (pace_s_per_km == null || pace_s_per_km <= 0) return "—";
  const total = Math.round(pace_s_per_km);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return `${m}:${ss}`;
}

function formatHr(hr: number | null): string {
  if (hr == null || hr <= 0) return "—";
  return `${Math.round(hr)}`;
}

function formatElev(elev: number | null): string {
  if (elev == null || !Number.isFinite(elev)) return "—";
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

// výška barov podľa rozsahu hodnôt
function makeHeightScaler(
  values: (number | null)[],
  minPx = 18,
  maxPx = 54
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

  // necháme si trochu rezervu kvôli gapom, aby sa všetky bary vošli do 100 %
  const segmentWidthPct = rows.length ? 100 / (rows.length + 2) : 0;

  return (
    <div className="text-[11px] sm:text-xs">
      {/* TOP – trendy */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] opacity-70">
          Total time: {fmtSecondsHMS(totalTime)}
        </div>

        <div className="space-y-1.5">
          <MetricBarRow
            label="Time"
            rows={rows}
            segmentWidthPct={segmentWidthPct}
            colorClass="bg-emerald-500/80"
            getValue={(r) => r.time_s}
          />

          <MetricBarRow
            label="Pace"
            rows={rows}
            segmentWidthPct={segmentWidthPct}
            colorClass="bg-sky-500/80"
            getValue={(r) => r.pace_s_per_km}
          />

          <MetricBarRow
            label="HR"
            rows={rows}
            segmentWidthPct={segmentWidthPct}
            colorClass="bg-rose-500/80"
            getValue={(r) => r.avg_hr_bpm}
          />

          <MetricBarRow
            label="Elev."
            rows={rows}
            segmentWidthPct={segmentWidthPct}
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
            <tr className="uppercase tracking-wide opacity-70">
              <th className="py-1.5 pr-2 text-right align-bottom text-[10px]">
                #
              </th>

              <th className="py-1.5 pr-2 text-left align-bottom">
                <HeaderWithUnit label="Distance" unit="km" />
              </th>

              <th className="py-1.5 pr-2 text-left align-bottom">
                <HeaderWithUnit label="Time" unit="h:mm:ss" />
              </th>

              <th className="py-1.5 pr-2 text-left align-bottom">
                <HeaderWithUnit label="Pace" unit="min/km" />
              </th>

              <th className="py-1.5 pr-2 text-right align-bottom">
                <HeaderWithUnit label="Avg HR" unit="bpm" />
              </th>

              <th className="py-1.5 pl-2 text-right align-bottom">
                <HeaderWithUnit label="Elev. Δ" unit="m" />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.index}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {r.index}
                </td>

                <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">
                  {formatSplitDistance(r.distance_m)}
                </td>

                <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">
                  {formatTimeShort(r.time_s)}
                </td>

                <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">
                  {formatPace(r.pace_s_per_km)}
                </td>

                <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">
                  {formatHr(r.avg_hr_bpm)}
                </td>

                <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">
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
  segmentWidthPct: number;
  colorClass: string;
  getValue: (r: SplitRow) => number | null;
};

function MetricBarRow({
  label,
  rows,
  segmentWidthPct,
  colorClass,
  getValue,
}: MetricBarRowProps) {
  const values = rows.map((r) => getValue(r));
  const heightFor = makeHeightScaler(values, 18, 54);

  return (
    <div className="flex items-center gap-1.5">
      {/* label – bližšie pri baroch, menšia šírka */}
      <div className="w-11 shrink-0 text-[10px] opacity-75 text-right pr-1">
        {label}
      </div>

      <div className="flex-1 flex items-end gap-[2px] h-16">
        {rows.map((r) => {
          const hPx = heightFor(getValue(r));
          return (
            <div
              key={`${label}-${r.index}`}
              className={`rounded-sm ${colorClass} flex-none`}
              style={{
                width: `${segmentWidthPct}%`,
                minWidth: "2px",
                height: `${hPx}px`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

type HeaderWithUnitProps = {
  label: string;
  unit: string;
};

function HeaderWithUnit({ label, unit }: HeaderWithUnitProps) {
  return (
    <div className="leading-tight">
      <div className="text-[10px]">{label}</div>
      <div className="text-[9px] opacity-70">{unit}</div>
    </div>
  );
}