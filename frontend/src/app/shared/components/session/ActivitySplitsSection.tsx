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

// 1 km ± 10 m -> 1.0, inak km s 1 desatinným miestom
function formatSplitDistanceFull(distance_m: number | null): string {
  if (distance_m == null) return "—";
  const km = distance_m / 1000;

  if (Math.abs(distance_m - 1000) <= 10) {
    return "1.0";
  }

  return km.toFixed(1); // napr. 1.0, 1.3, 9.7
}

// krátka verzia na mobil – rovnako 1 desatinné miesto
function formatSplitDistanceShort(distance_m: number | null): string {
  if (distance_m == null) return "—";
  const km = distance_m / 1000;

  if (Math.abs(distance_m - 1000) <= 10) {
    return "1.0";
  }

  return km.toFixed(1);
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
  minPx = 30,
  maxPx = 90
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

  // len faktor, keby sme ho chceli použiť; nechávam kvôli signature
  const segmentWidthFactor = rows.length ? 100 / (rows.length + 4) : 0;

  return (
    <div className="text-[11px] sm:text-xs">
      {/* TOP – trendy */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] opacity-70">
          Total time: {fmtSecondsHMS(totalTime)}
        </div>

        {/* celý blok trendov cez šírku panelu */}
        <div className="mx-auto w-full">
          <div className="space-y-4">
            {/* PORADIE: HR, Pace, Elevation, Time */}
            <MetricBarRow
              label="Heart rate"
              rows={rows}
              segmentWidthFactor={segmentWidthFactor}
              colorClass="bg-rose-500/80"
              getValue={(r) => r.avg_hr_bpm}
              getStatValue={(r) => r.avg_hr_bpm}
              formatStat={(v) => formatHr(v)}
              statMode="hr"
            />

            <MetricBarRow
              label="Pace"
              rows={rows}
              segmentWidthFactor={segmentWidthFactor}
              colorClass="bg-sky-500/80"
              getValue={(r) => r.pace_s_per_km}
              getStatValue={(r) => r.pace_s_per_km}
              formatStat={(v) => formatPace(v)}
              statMode="pace"
            />

            <MetricBarRow
              label="Elevation"
              rows={rows}
              segmentWidthFactor={segmentWidthFactor}
              colorClass="bg-amber-500/80"
              getValue={(r) =>
                r.elev_delta_m != null ? Math.abs(r.elev_delta_m) : null
              }
              getStatValue={(r) => r.elev_delta_m}
              formatStat={(v) => formatElev(v)}
              statMode="elev"
            />

            <MetricBarRow
              label="Time"
              rows={rows}
              segmentWidthFactor={segmentWidthFactor}
              colorClass="bg-emerald-500/80"
              getValue={(r) => r.time_s}
              getStatValue={(r) => r.time_s}
              formatStat={(v) => formatTimeShort(v)}
              statMode="time"
            />
          </div>
        </div>
      </div>

      {/* TABLE – poradie: HR, Pace, Elev, Time */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="border-b border-white/10">
            <tr className="opacity-70">
              <th className="py-1 px-1 text-center align-bottom text-[10px]">
                #
              </th>
              <th className="py-1 px-1 text-center align-bottom text-[10px]">
                Dist. (km)
              </th>
              <th className="py-1 px-1 text-center align-bottom text-[10px]">
                Avg HR (bpm)
              </th>
              <th className="py-1 px-1 text-center align-bottom text-[10px]">
                Pace (min/km)
              </th>
              <th className="py-1 pl-1 pr-0.5 text-right align-bottom text-[10px]">
                Elev. Δm
              </th>
              <th className="py-1 px-1 text-center align-bottom text-[10px]">
                Time (h:mm:ss)
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.index}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="py-1 px-1 text-center tabular-nums">
                  {r.index}
                </td>

                <td className="py-1 px-1 text-center tabular-nums whitespace-nowrap">
                  <span className="sm:hidden">
                    {formatSplitDistanceShort(r.distance_m)}
                  </span>
                  <span className="hidden sm:inline">
                    {formatSplitDistanceFull(r.distance_m)}
                  </span>
                </td>

                <td className="py-1 px-1 text-center tabular-nums whitespace-nowrap">
                  {formatHr(r.avg_hr_bpm)}
                </td>

                <td className="py-1 px-1 text-center tabular-nums whitespace-nowrap">
                  {formatPace(r.pace_s_per_km)}
                </td>

                <td className="py-1 pl-1 pr-0.5 text-right tabular-nums whitespace-nowrap">
                  {formatElev(r.elev_delta_m)}
                </td>

                <td className="py-1 px-1 text-center tabular-nums whitespace-nowrap">
                  {formatTimeShort(r.time_s)}
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
  segmentWidthFactor: number; // nechávam kvôli signature, vnútri ho už nepotrebujeme
  colorClass: string;
  getValue: (r: SplitRow) => number | null;
  getStatValue?: (r: SplitRow) => number | null;
  formatStat: (v: number | null) => string;
  // time/hr -> max,avg,min; pace -> min,avg,max; elev -> max,0,min
  statMode: "time" | "hr" | "pace" | "elev";
};

function MetricBarRow({
  label,
  rows,
  // segmentWidthFactor,
  colorClass,
  getValue,
  getStatValue,
  formatStat,
  statMode,
}: MetricBarRowProps) {
  const values = rows.map((r) => getValue(r));
  const statValues = rows.map((r) =>
    getStatValue ? getStatValue(r) : getValue(r)
  );
  const heightFor = makeHeightScaler(values, 30, 90);
  const stats = computeStats(statValues);

  let topVal: number | null = null;
  let midVal: number | null = null;
  let bottomVal: number | null = null;

  if (statMode === "time" || statMode === "hr") {
    // hore max, v strede priemer, dole min
    topVal = stats?.max ?? null;
    midVal = stats?.avg ?? null;
    bottomVal = stats?.min ?? null;
  } else if (statMode === "pace") {
    // pace – hore najrýchlejší (najnižšie číslo), dole najpomalší
    topVal = stats?.min ?? null;
    midVal = stats?.avg ?? null;
    bottomVal = stats?.max ?? null;
  } else if (statMode === "elev") {
    // elev – hore najvyšší +, v strede 0, dole najnižší -
    topVal = stats?.max ?? null;
    midVal = 0;
    bottomVal = stats?.min ?? null;
  }

  const topLabel = formatStat(topVal);
  const midLabel = formatStat(midVal);
  const bottomLabel = formatStat(bottomVal);

  const barWidthPercent = rows.length ? 100 / rows.length : 0;

  return (
    <div className="pt-1">
      {/* názov metriky – centrovaný */}
      <div className="mb-1 text-center">
        <span className="text-[11px] opacity-80">{label}</span>
      </div>

      {/* blok barov + čísiel roztiahnutý do šírky */}
      <div className="flex justify-center">
        <div className="flex items-stretch gap-3 w-full px-1 sm:px-2">
          {/* bary – flex-1, každý zaberá percento z dostupnej šírky */}
          <div className="flex-1 flex items-end gap-[6px] h-24">
            {rows.map((r) => {
              const hPx = heightFor(getValue(r));
              return (
                <div
                  key={`${label}-${r.index}`}
                  className={`rounded-sm ${colorClass} flex-none`}
                  style={{
                    width: `${barWidthPercent}%`,
                    minWidth: "4px",
                    height: `${hPx}px`,
                  }}
                />
              );
            })}
          </div>

          {/* čísla vpravo – väčší font na väčších displejoch */}
          <div className="flex flex-col justify-between items-end text-[9px] sm:text-[11px] md:text-xs font-medium opacity-80 leading-tight min-w-[44px]">
            <span>{topLabel}</span>
            <span>{midLabel}</span>
            <span>{bottomLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}