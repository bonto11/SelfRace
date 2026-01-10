"use client";

import type { JSX } from "react";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { CHART_HR } from "@/app/shared/ui/classes";

/**
 * Generický line chart pre ľubovoľný stream (pace, cadence, power, altitude, hr, ...).
 */
function StreamLineChartBase({
  xs,
  ys,
  height = 120,
  compact = false,
  labelY,
  labelX = "čas",
  emptyText = "Stream nie je k dispozícii.",
  formatYTick,
  formatXTick,
  color = "#3b82f6",
}: {
  xs: number[];
  ys: (number | null)[];
  height?: number;
  compact?: boolean;
  labelY: string;
  labelX?: string;
  emptyText?: string;
  formatYTick?: (v: number) => string;
  formatXTick?: (v: number) => string;
  color?: string;
}) {
  const n = Math.min(xs.length, ys.length);
  if (!n) {
    const cls = CHART_HR.emptyTextClass;
    return <div className={cls}>{emptyText}</div>;
  }

  const padL = compact ? 28 : 40;
  const padR = compact ? 8 : 16;
  const padT = compact ? 10 : 20;
  const padB = compact ? 20 : 26;

  const W = 980;
  const H = Math.max(100, height);

  // očistené body
  const xv: number[] = [];
  const yv: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = ys[i];
    if (v != null && Number.isFinite(v)) {
      xv.push(xs[i]);
      yv.push(v);
    }
  }
  if (!yv.length) {
    const cls = CHART_HR.emptyTextClass;
    return <div className={cls}>{emptyText}</div>;
  }

  const minY = Math.min(...yv);
  const maxY = Math.max(...yv);
  const minX = xv[0];
  const maxX = xv[xv.length - 1];

  const sx = (t: number) =>
    padL + ((t - minX) / Math.max(1, maxX - minX)) * (W - padL - padR);
  const sy = (v: number) => {
    const h = H - padT - padB;
    const t = (v - minY) / Math.max(1, maxY - minY);
    return H - padB - t * h;
  };

  // mriežka
  const yTicks = 4;
  const yVals = Array.from(
    { length: yTicks + 1 },
    (_, i) => minY + (i * (maxY - minY)) / yTicks
  );
  const xTicks = 5;
  const xVals = Array.from(
    { length: xTicks + 1 },
    (_, i) => minX + (i * (maxX - minX)) / xTicks
  );

  // polyline
  const segs: JSX.Element[] = [];
  for (let i = 1; i < yv.length; i++) {
    const x1 = sx(xv[i - 1]);
    const y1 = sy(yv[i - 1]);
    const x2 = sx(xv[i]);
    const y2 = sy(yv[i]);

    segs.push(
      <line
        key={`s-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={
          compact ? CHART_HR.lineWidth.compact : CHART_HR.lineWidth.normal
        }
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
            x={padL - 6}
            y={sy(v)}
            textAnchor="end"
            dominantBaseline="central"
            fontSize={10}
            fill={CHART_HR.tickText}
          >
            {formatYTick ? formatYTick(v) : Math.round(v)}
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
            y={H - padB + 14}
            textAnchor="middle"
            fontSize={10}
            fill={CHART_HR.tickText}
          >
            {formatXTick ? formatXTick(t) : fmtSecondsHMS(Math.round(t))}
          </text>
        </g>
      ))}
      <text
        x={padL + 4}
        y={(padT + (H - padB)) / 2}
        transform={`rotate(-90 ${padL + 4} ${(padT + (H - padB)) / 2})`}
        textAnchor="middle"
        fontSize={10}
        fill={CHART_HR.axisText}
      >
        {labelY}
      </text>
      <text
        x={(padL + (W - padR)) / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={10}
        fill={CHART_HR.axisText}
      >
        {labelX}
      </text>
    </>
  );

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${labelY} priebeh`}
    >
      <Axis />
      <defs>
        <clipPath id="streamClip">
          <rect
            x={padL}
            y={padT}
            width={W - padL - padR}
            height={H - padT - padB}
          />
        </clipPath>
      </defs>
      <g clipPath="url(#streamClip)">{segs}</g>
    </svg>
  );
}

/* ----------------------------- Pace chart ----------------------------- */

function fmtPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PaceChart({
  xs,
  ys,
  height = 120,
  compact = false,
}: {
  xs: number[];
  ys: (number | null)[]; // pace v sekundách na km
  height?: number;
  compact?: boolean;
}) {
  return (
    <StreamLineChartBase
      xs={xs}
      ys={ys}
      height={height}
      compact={compact}
      labelY="pace (min/km)"
      labelX="čas"
      emptyText="Pace stream nie je k dispozícii."
      formatYTick={(v) => fmtPace(v)}
      color="#f97316"
    />
  );
}

/* --------------------------- Cadence chart ---------------------------- */

export function CadenceChart({
  xs,
  ys,
  height = 120,
  compact = false,
}: {
  xs: number[];
  ys: (number | null)[]; // cadence v rpm
  height?: number;
  compact?: boolean;
}) {
  return (
    <StreamLineChartBase
      xs={xs}
      ys={ys}
      height={height}
      compact={compact}
      labelY="cadence (rpm)"
      labelX="čas"
      emptyText="Kadencia stream nie je k dispozícii."
      color="#22c55e"
    />
  );
}

/* ---------------------------- Power chart ----------------------------- */

export function PowerChart({
  xs,
  ys,
  height = 120,
  compact = false,
}: {
  xs: number[];
  ys: (number | null)[]; // výkon vo W
  height?: number;
  compact?: boolean;
}) {
  return (
    <StreamLineChartBase
      xs={xs}
      ys={ys}
      height={height}
      compact={compact}
      labelY="power (W)"
      labelX="čas"
      emptyText="Power stream nie je k dispozícii."
      color="#a855f7"
    />
  );
}

/* ------------------------- Elevation / prevýšenie ------------------------- */

export function ElevationChart({
  xs,
  ys,
  height = 120,
  compact = false,
}: {
  xs: number[];
  ys: (number | null)[]; // nadmorská výška v metroch (altitude_m)
  height?: number;
  compact?: boolean;
}) {
  return (
    <StreamLineChartBase
      xs={xs}
      ys={ys}
      height={height}
      compact={compact}
      labelY="elevácia (m)"
      labelX="čas"
      emptyText="Elevation stream nie je k dispozícii."
      color="#6b7280" // sivá
    />
  );
}

/* ----------------------------- HR simple chart ----------------------------- */

export function HrStreamChart({
  xs,
  ys,
  height = 120,
  compact = false,
}: {
  xs: number[];
  ys: (number | null)[]; // HR v bpm
  height?: number;
  compact?: boolean;
}) {
  return (
    <StreamLineChartBase
      xs={xs}
      ys={ys}
      height={height}
      compact={compact}
      labelY="bpm"
      labelX="čas"
      emptyText="HR stream nie je k dispozícii."
      color={CHART_HR.colors.z3 ?? "#ef4444"}
    />
  );
}