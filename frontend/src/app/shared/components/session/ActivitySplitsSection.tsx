"use client";

import { fmtSecondsHMS } from "@/app/shared/utils/time";

type Props = {
  kind: any[]; // splits alebo laps
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

// 1 km ± 10 m -> 1.00, inak km s 2 des. miestami
function formatSplitDistanceFull(distance_m: number | null): string {
  if (distance_m == null) return "—";
  if (Math.abs(distance_m - 1000) <= 10) return "1.00";
  const km = distance_m / 1000;
  return km.toFixed(2);
}

// krátka verzia na mobil: 1 km ± 10 m -> "1"
function formatSplitDistanceShort(distance_m: number | null): string {
  if (distance_m == null) return "—";
  if (Math.abs(distance_m - 1000) <= 10) return "1";
  const km = distance_m / 1000;
  return km.toFixed(2);
}

// čas do tabuľky – mm:ss alebo h:mm:ss, bez sufixov
function formatTimeShort(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

// tempo: mm:ss
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

function makeHeightScaler(
  values: (number | null)[],
  minPx = 26,
  maxPx = 80
): (v: number | null) => number {
  const nums = values.filter((v) => v != null && Number.isFinite(v)) as number[];
  if (!nums.length) {
    return () => (minPx + maxPx) / 2;
  }

  let min = nums[0];
  let max = nums[0];
  let sum = 0;
  for (const v of nums) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const avg = sum / nums.length;

  if (min === max) {
    return () => (minPx + maxPx) / 2;
  }

  return (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return minPx;
    const t = (v - min) / (max - min);
    return minPx + t * (maxPx - minPx);
  };
}

function computeStats(values: (number | null)[]): {
  min: number;
  max: number;
  avg: number;
} | null {
  const nums = values.filter((v) => v != null && Number.isFinite(v)) as number[];
  if (!nums.length) return null;
  let min = nums[0];
  let max = nums[0];
  let sum = 0;
  for (const v of nums) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, avg: sum / nums.length };
}

export function ActivitySplitsSection({ kind }: Props) {
  const rows = buildRows(Array.isArray(kind) ? kind : []).filter(
    (r) => r.time_s != null
  );

  if (!rows.length) {
    return <div className="text-sm opacity-80">Žiadne dáta.</div>;
  }

  const totalTime =
    rows.reduce((acc, r) => acc + (r.time_s ?? 0), 0) || 0;

  // väčšia rezerva -> užšie bary + väčšie medzery
  const segmentWidthPct = rows.length ? 100 / (rows.length + 8) : 0;

  return (
    <div className="text-[11px] sm:text-xs">
      {/* TOP – trendy */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] opacity-70">
          Total time: {fmtSecondsHMS(totalTime)}
        </div>

        <div className="space-y-2 ml-[-10px]">
          <MetricBarRow
            label="Time"
            rows={rows}
            segmentWidthPct={segmentWidthPct}
            colorClass="bg-emerald-500/80"
            getValue={(r) => r.time_s}
            formatStat={(v) => formatTimeShort(v)}
            statsMode="min-avg-max"
          />

          <MetricBarRow
            label="Pace"
            rows={rows}
            segmentWidthPct={segmentWidthPct}
            colorClass="bg-sky-500/80"
            getValue={(r) => r.pace_s_per_km}
            formatStat={(v) => formatPace(v)}
            statsMode="min-avg-max"
          />

          <MetricBarRow
            label="HR"
            rows={rows}
            segmentWidthPct={segmentWidthPct}
            colorClass="bg-rose-500/80"
            getValue={(r) => r.avg_hr_bpm}
            formatStat={(v) => formatHr(v)}
            statsMode="min-avg-max"
          />

          <MetricBarRow
            label="Elev."
            rows={rows}
            segmentWidthPct={segmentWidthPct}
            colorClass="bg-amber-500/80"
            getValue={(r) =>
              r.elev_delta_m != null ? Math.abs(r.elev_delta_m) : null
            }
            formatStat={(v) => formatElev(v)}
            statsMode="min-0-max"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="border-b border-white/10">
            <tr className="opacity-70">
              <th className="py-1.5 px-2 text-center align-bottom text-[10px]">
                #
              </th>
              <th className="py-1.5 px-2 text-center align-bottom text-[10px]">
                Dist. (km)
              </th>
              <th className="py-1.5 px-2 text-center align-bottom text-[10px]">
                Time (h:mm:ss)
              </th>
              <th className="py-1.5 px-2 text-center align-bottom text-[10px]">
                Pace (min/km)
              </th>
              <th className="py-1.5 px-2 text-center align-bottom text-[10px]">
                Avg HR (bpm)
              </th>
              <th className="py-1.5 pl-2 pr-1 text-right align-bottom text-[10px]">
                Elev. Δ m
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.index}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="py-1.5 px-2 text-center tabular-nums">
                  {r.index}
                </td>

                <td className="py-1.5 px-2 text-center tabular-nums whitespace-nowrap">
                  <span className="sm:hidden">
                    {formatSplitDistanceShort(r.distance_m)}
                  </span>
                  <span className="hidden sm:inline">
                    {formatSplitDistanceFull(r.distance_m)}
                  </span>
                </td>

                <td className="py-1.5 px-2 text-center tabular-nums whitespace-nowrap">
                  {formatTimeShort(r.time_s)}
                </td>

                <td className="py-1.5 px-2 text-center tabular-nums whitespace-nowrap">
                  {formatPace(r.pace_s_per_km)}
                </td>

                <td className="py-1.5 px-2 text-center tabular-nums whitespace-nowrap">
                  {formatHr(r.avg_hr_bpm)}
                </td>

                <td className="py-1.5 pl-2 pr-1 text-right tabular-nums whitespace-nowrap">
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
  formatStat: (v: number | null) => string;
  statsMode: "min-avg-max" | "min-0-max";
};

function MetricBarRow({
  label,
  rows,
  segmentWidthPct,
  colorClass,
  getValue,
  formatStat,
  statsMode,
}: MetricBarRowProps) {
  const values = rows.map((r) => getValue(r));
  const heightFor = makeHeightScaler(values, 26, 80);
  const stats = computeStats(values);

  return (
    <div className="flex items-center gap-1">
      {/* label – úzky, aby bary boli bližšie osi */}
      <div className="w-7 shrink-0 text-[10px] opacity-75 text-right pr-0.5">
        {label}
      </div>

      <div className="flex-1 flex items-end gap-[4px] h-20">
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

      {/* pravá strana – štatistiky */}
      <div className="w-[74px] shrink-0 text-[10px] text-right leading-tight pl-1">
        {statsMode === "min-0-max" ? (
          <>
            <div>{formatStat(stats?.min ?? null)}</div>
            <div>{formatStat(0)}</div>
            <div>{formatStat(stats?.max ?? null)}</div>
          </>
        ) : (
          <>
            <div>{formatStat(stats?.min ?? null)}</div>
            <div>{formatStat(stats?.avg ?? null)}</div>
            <div>{formatStat(stats?.max ?? null)}</div>
          </>
        )}
      </div>
    </div>
  );
}