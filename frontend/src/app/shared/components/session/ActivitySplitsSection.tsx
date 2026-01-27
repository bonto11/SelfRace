// src/app/shared/components/session/ActivitySplitsSection.tsx
"use client";

import { fmtSecondsHMS } from "@/app/shared/utils/time";
import {
  SESSION_SPLITS_WRAP,
  SESSION_SPLITS_TOTAL,
  SESSION_SPLITS_BARS_STACK,
  SESSION_SPLITS_TABLE_WRAP,
  SESSION_SPLITS_TABLE,
  SESSION_SPLITS_THEAD,
  SESSION_SPLITS_THEAD_STYLE,
  SESSION_SPLITS_THEAD_ROW,
  SESSION_SPLITS_TH,
  SESSION_SPLITS_TR,
  SESSION_SPLITS_TR_STYLE,
  SESSION_SPLITS_TD,
  SESSION_SPLITS_TD_RIGHT,
  SESSION_SPLITS_EMPTY,
  SESSION_METRIC_ROW,
  SESSION_METRIC_LABEL,
  SESSION_METRIC_LABEL_TEXT,
  SESSION_METRIC_AXIS,
  SESSION_METRIC_BARS,
  SESSION_METRIC_BAR,
  SESSION_METRIC_BAR_STYLE,
} from "@/app/shared/ui/tokens";

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

  return km.toFixed(1);
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
    const distance_m = toNumber(sp.distance_m) ?? toNumber(sp.distance) ?? null;

    const time_s =
      toNumber(sp.moving_time_s) ?? toNumber(sp.elapsed_time_s) ?? null;

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
  minPx = 1,
  maxPx = 100
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
    return <div className={SESSION_SPLITS_EMPTY}>Žiadne dáta.</div>;
  }

  const totalTime = rows.reduce((acc, r) => acc + (r.time_s ?? 0), 0) || 0;

  return (
    <div className={SESSION_SPLITS_WRAP}>
      <div className={SESSION_SPLITS_TOTAL}>
        Total time: {fmtSecondsHMS(totalTime)}
      </div>

      <div className={SESSION_SPLITS_BARS_STACK}>
        <MetricBarRow
          label="Heart rate"
          rows={rows}
          metric="hr"
          getValue={(r) => r.avg_hr_bpm}
          getStatValue={(r) => r.avg_hr_bpm}
          formatStat={(v) => formatHr(v)}
          statMode="hr"
        />

        <MetricBarRow
          label="Pace"
          rows={rows}
          metric="pace"
          getValue={(r) => r.pace_s_per_km}
          getStatValue={(r) => r.pace_s_per_km}
          formatStat={(v) => formatPace(v)}
          statMode="pace"
        />

        <MetricBarRow
          label="Elevation"
          rows={rows}
          metric="elev"
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
          metric="time"
          getValue={(r) => r.time_s}
          getStatValue={(r) => r.time_s}
          formatStat={(v) => formatTimeShort(v)}
          statMode="time"
        />
      </div>

      <div className={SESSION_SPLITS_TABLE_WRAP}>
        <table className={SESSION_SPLITS_TABLE}>
          <thead
            className={SESSION_SPLITS_THEAD}
            style={SESSION_SPLITS_THEAD_STYLE}
          >
            <tr className={SESSION_SPLITS_THEAD_ROW}>
              <th className={SESSION_SPLITS_TH}>#</th>
              <th className={SESSION_SPLITS_TH}>Dist. (km)</th>
              <th className={SESSION_SPLITS_TH}>Avg HR (bpm)</th>
              <th className={SESSION_SPLITS_TH}>Pace (min/km)</th>
              <th className={SESSION_SPLITS_TD_RIGHT}>Elev. Δm</th>
              <th className={SESSION_SPLITS_TH}>Time (h:mm:ss)</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.index}
                className={SESSION_SPLITS_TR}
                style={SESSION_SPLITS_TR_STYLE}
              >
                <td className={SESSION_SPLITS_TD}>{r.index}</td>

                <td className={SESSION_SPLITS_TD}>
                  <span className="sm:hidden">
                    {formatSplitDistanceShort(r.distance_m)}
                  </span>
                  <span className="hidden sm:inline">
                    {formatSplitDistanceFull(r.distance_m)}
                  </span>
                </td>

                <td className={SESSION_SPLITS_TD}>{formatHr(r.avg_hr_bpm)}</td>

                <td className={SESSION_SPLITS_TD}>
                  {formatPace(r.pace_s_per_km)}
                </td>

                <td className={SESSION_SPLITS_TD_RIGHT}>
                  {formatElev(r.elev_delta_m)}
                </td>

                <td className={SESSION_SPLITS_TD}>
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
  metric: "hr" | "pace" | "elev" | "time";
  getValue: (r: SplitRow) => number | null;
  getStatValue?: (r: SplitRow) => number | null;
  formatStat: (v: number | null) => string;
  statMode: "time" | "hr" | "pace" | "elev";
};

function MetricBarRow({
  label,
  rows,
  metric,
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
    topVal = stats?.max ?? null;
    midVal = stats?.avg ?? null;
    bottomVal = stats?.min ?? null;
  } else if (statMode === "pace") {
    topVal = stats?.min ?? null;
    midVal = stats?.avg ?? null;
    bottomVal = stats?.max ?? null;
  } else if (statMode === "elev") {
    topVal = stats?.max ?? null;
    midVal = 0;
    bottomVal = stats?.min ?? null;
  }

  const topLabel = formatStat(topVal);
  const midLabel = formatStat(midVal);
  const bottomLabel = formatStat(bottomVal);

  return (
    <div className={SESSION_METRIC_ROW}>
      <div className={SESSION_METRIC_LABEL}>
        <span className={SESSION_METRIC_LABEL_TEXT}>{label}</span>
      </div>

      <div className="flex items-stretch">
        <div className={SESSION_METRIC_AXIS}>
          <span>{topLabel}</span>
          <span>{midLabel}</span>
          <span>{bottomLabel}</span>
        </div>

        <div className={SESSION_METRIC_BARS}>
          {rows.map((r) => {
            const hPx = heightFor(getValue(r));
            return (
              <div
                key={`${label}-${r.index}`}
                className={SESSION_METRIC_BAR}
                style={{ ...SESSION_METRIC_BAR_STYLE[metric], height: `${hPx}px` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}