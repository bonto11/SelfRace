"use client";

import { useMemo } from "react";
import type { JSX } from "react";

import HrChart from "@/app/shared/components/trend/HrChart";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { CHART_HR } from "@/app/shared/ui/classes";
import type { StreamsData } from "@/app/features/activities/types/activities";

type ActivityStreamChartsProps = {
  streams: StreamsData;
  compact?: boolean;
};

type MiniChartProps = {
  title: string;
  xs: number[];
  ys: (number | null | undefined)[];
  compact?: boolean;
  yLabel?: string;
  formatY?: (v: number) => string;
};

function MiniStreamChart({
  title,
  xs,
  ys,
  compact = false,
  yLabel,
  formatY,
}: MiniChartProps) {
  const Svg = useMemo(() => {
    const n = Math.min(xs.length, ys.length);
    if (!n) {
      return () => (
        <div className="opacity-70 text-xs">Dáta nie sú k dispozícii.</div>
      );
    }

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const v = ys[i];
      if (v == null) continue;
      points.push({ x: xs[i], y: Number(v) });
    }

    if (!points.length) {
      return () => (
        <div className="opacity-70 text-xs">Dáta nie sú k dispozícii.</div>
      );
    }

    const padL = 32;
    const padR = 8;
    const padT = 16;
    const padB = 22;

    const W = 480;
    const H = compact ? 90 : 110;

    const minX = points[0].x;
    const maxX = points[points.length - 1].x;

    let minY = points[0].y;
    let maxY = points[0].y;
    for (const p of points) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    const sx = (t: number) =>
      padL +
      ((t - minX) / Math.max(1, maxX - minX)) * (W - padL - padR);
    const sy = (v: number) => {
      const h = H - padT - padB;
      const t = (v - minY) / Math.max(1, maxY - minY);
      return H - padB - t * h;
    };

    const xTicks = 3;
    const xVals = Array.from(
      { length: xTicks + 1 },
      (_, i) => minX + (i * (maxX - minX)) / xTicks
    );

    const yTicks = 3;
    const yVals = Array.from(
      { length: yTicks + 1 },
      (_, i) => minY + (i * (maxY - minY)) / yTicks
    );

    const path: JSX.Element[] = [];
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      path.push(
        <line
          key={`ln-${i}`}
          x1={sx(p1.x)}
          y1={sy(p1.y)}
          x2={sx(p2.x)}
          y2={sy(p2.y)}
          stroke={CHART_HR.axisText}
          strokeWidth={compact ? 1 : 1.4}
          strokeLinecap="round"
        />
      );
    }

    const Axis = () => (
      <>
        {yVals.map((v, i) => (
          <g key={`gy-${i}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={sy(v)}
              y2={sy(v)}
              stroke={CHART_HR.grid}
              strokeDasharray="4 4"
            />
            <text
              x={padL - 4}
              y={sy(v)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={9}
              fill={CHART_HR.tickText}
            >
              {formatY ? formatY(v) : Math.round(v)}
            </text>
          </g>
        ))}
        {xVals.map((t, i) => (
          <g key={`gx-${i}`}>
            <line
              x1={sx(t)}
              x2={sx(t)}
              y1={padT}
              y2={H - padB}
              stroke={CHART_HR.grid}
              strokeDasharray="4 4"
            />
            <text
              x={sx(t)}
              y={H - padB + 12}
              textAnchor="middle"
              fontSize={9}
              fill={CHART_HR.tickText}
            >
              {fmtSecondsHMS(Math.round(t))}
            </text>
          </g>
        ))}

        {yLabel && (
          <text
            x={padL + 4}
            y={(padT + (H - padB)) / 2}
            transform={`rotate(-90 ${padL + 4} ${
              (padT + (H - padB)) / 2
            })`}
            textAnchor="middle"
            fontSize={9}
            fill={CHART_HR.axisText}
          >
            {yLabel}
          </text>
        )}
      </>
    );

    return () => (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
      >
        <Axis />
        <defs>
          <clipPath id="miniClip">
            <rect
              x={padL}
              y={padT}
              width={W - padL - padR}
              height={H - padT - padB}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#miniClip)">{path}</g>
      </svg>
    );
  }, [xs, ys, compact, title, yLabel, formatY]);

  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
      <div className="text-[11px] font-semibold mb-1 opacity-80">
        {title}
      </div>
      <Svg />
    </div>
  );
}

/**
 * Hlavný wrapper: HR + ostatné streamy (prevýšenie, pace, power, cadence).
 */
export function ActivityStreamCharts({
  streams,
  compact = false,
}: ActivityStreamChartsProps) {
  const { time_s, hr, altitude_m, distance_m, cadence_rpm, power_w } = streams;

  const hasTime = Array.isArray(time_s) && time_s.length > 0;
  if (!hasTime) {
    return (
      <div className="opacity-70 text-sm">
        Stream dáta nie sú k dispozícii pre túto aktivitu.
      </div>
    );
  }

  const hasHr = Array.isArray(hr) && hr.length > 0;
  const hasAlt =
    Array.isArray(altitude_m) && altitude_m.some((v) => v != null);
  const hasDist =
    Array.isArray(distance_m) && distance_m.some((v) => v != null);
  const hasCad =
    Array.isArray(cadence_rpm) && cadence_rpm.some((v) => v != null);
  const hasPow = Array.isArray(power_w) && power_w.some((v) => v != null);

  // dynamický výpočet pace z distance/time – približne instantaneous pace
  const pace_s_per_km: (number | null)[] = useMemo(() => {
    if (!hasDist) return [];
    const out: (number | null)[] = [];
    for (let i = 1; i < time_s.length; i++) {
      const dt = time_s[i] - time_s[i - 1];
      const d1 = distance_m?.[i - 1] ?? null;
      const d2 = distance_m?.[i] ?? null;
      if (dt <= 0 || d1 == null || d2 == null) {
        out.push(null);
        continue;
      }
      const dd = d2 - d1;
      if (dd <= 0.5) {
        out.push(null);
        continue;
      }
      const pace = dt / (dd / 1000); // s/km
      if (!Number.isFinite(pace) || pace <= 0) {
        out.push(null);
      } else {
        out.push(pace);
      }
    }
    // zarovnanie dĺžky s time_s
    if (out.length < time_s.length) out.unshift(null);
    return out;
  }, [time_s, distance_m, hasDist]);

  const formatPace = (v: number) => fmtSecondsHMS(Math.round(v));

  return (
    <div className="space-y-3">
      {/* HR hlavný graf */}
      {hasHr && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="font-bold text-sm">HR priebeh</h4>
          </div>
          <HrChart
            xs={time_s}
            ys={hr}
            height={compact ? 148 : 220}
            compact={compact}
          />
        </div>
      )}

      {/* Ostatné mini grafy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hasAlt && (
          <MiniStreamChart
            title="Prevýšenie"
            xs={time_s}
            ys={altitude_m ?? []}
            compact={compact}
            yLabel="m"
          />
        )}

        {hasDist && (
          <MiniStreamChart
            title="Tempo (instantné)"
            xs={time_s}
            ys={pace_s_per_km}
            compact={compact}
            yLabel="s/km"
            formatY={formatPace}
          />
        )}

        {hasPow && (
          <MiniStreamChart
            title="Power"
            xs={time_s}
            ys={power_w ?? []}
            compact={compact}
            yLabel="W"
          />
        )}

        {hasCad && (
          <MiniStreamChart
            title="Cadence"
            xs={time_s}
            ys={cadence_rpm ?? []}
            compact={compact}
            yLabel="rpm"
          />
        )}
      </div>
    </div>
  );
}