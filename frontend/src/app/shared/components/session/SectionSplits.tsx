// src/app/shared/components/session/ActivitySplitsSection.tsx
"use client";

import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { useT } from "@/app/shared/i18n/useT";
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

function formatSplitDistanceShort(distance_m: number | null): string {
  if (distance_m == null) return "—";
  return (distance_m / 1000).toFixed(1);
}

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
      (distance_m && time_s ? time_s / (distance_m / 1000) : null);
    const avg_hr_bpm =
      toNumber(sp.avg_hr_bpm) ?? toNumber(sp.average_heartrate_bpm) ?? null;
    const elev_delta_m =
      toNumber(sp.elev_delta_m) ??
      toNumber(sp.elevation_gain_m) ??
      toNumber(sp.elevation_diff_m) ??  // ← pridaj toto
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

function makeHeightScaler(values: (number | null)[], minPx = 1, maxPx = 100) {
  const nums = values.filter(
    (v) => v != null && Number.isFinite(v),
  ) as number[];
  if (!nums.length) return () => (minPx + maxPx) / 2;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return () => (minPx + maxPx) / 2;
  return (v: number | null) => {
    if (v == null) return minPx;
    return minPx + ((v - min) / (max - min)) * (maxPx - minPx);
  };
}

export function SectionSplits({ kind }: Props) {
  const t = useT();
  const rows = buildRows(Array.isArray(kind) ? kind : []).filter(
    (r) => r.time_s != null,
  );

  if (!rows.length) {
    return (
      <div className={SESSION_SPLITS_EMPTY}>{t("sessions.splits.noData")}</div>
    );
  }

  const totalTime = rows.reduce((acc, r) => acc + (r.time_s ?? 0), 0) || 0;

  return (
    <div className={SESSION_SPLITS_WRAP}>
      <div className={SESSION_SPLITS_TOTAL}>
        {t("sessions.splits.totalTime")}: {fmtSecondsHMS(totalTime)}
      </div>

      <div className={SESSION_SPLITS_BARS_STACK}>
        <MetricBarRow
          label={t("common.metrics.hr")}
          rows={rows}
          metric="hr"
          getValue={(r: SplitRow) => r.avg_hr_bpm}
          formatStat={formatHr}
        />

        <MetricBarRow
          label={t("common.metrics.pace")}
          rows={rows}
          metric="pace"
          getValue={(r: SplitRow) => r.pace_s_per_km}
          formatStat={formatPace}
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
              <th className={SESSION_SPLITS_TH}>
                {t("sessions.splits.colDist")}
              </th>
              <th className={SESSION_SPLITS_TH}>
                {t("sessions.splits.colHR")}
              </th>
              <th className={SESSION_SPLITS_TH}>
                {t("sessions.splits.colPace")}
              </th>
              <th className={SESSION_SPLITS_TD_RIGHT}>
                {t("sessions.splits.colElev")}
              </th>
              <th className={SESSION_SPLITS_TH}>
                {t("sessions.splits.colTime")}
              </th>
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
                  {formatSplitDistanceShort(r.distance_m)}
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

function MetricBarRow({ label, rows, metric, getValue, formatStat }: any) {
  const values = rows.map((r: any) => getValue(r));
  const scaler = makeHeightScaler(values, 30, 90);
  return (
    <div className={SESSION_METRIC_ROW}>
      <div className={SESSION_METRIC_LABEL}>
        <span className={SESSION_METRIC_LABEL_TEXT}>{label}</span>
      </div>
      <div className={SESSION_METRIC_BARS}>
        {rows.map((r: any) => (
          <div
            key={r.index}
            className={SESSION_METRIC_BAR}
            style={{
              ...SESSION_METRIC_BAR_STYLE[
                metric as keyof typeof SESSION_METRIC_BAR_STYLE
              ],
              height: `${scaler(getValue(r))}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
