// src/features/activity/components/HrChart.tsx
"use client";

import React, { useMemo } from "react";
import { fmtSecondsHMS } from "@/shared/utils/format";

/** FIXNÉ farby + zóny (kým to nečítame z profilu) */
const COL = {
  z1: "#60A5FA", // blue
  z2: "#34D399", // green
  z3: "#FBBF24", // yellow
  z4: "#F97316", // orange
  z5: "#EF4444", // red
  grid: "rgba(255,255,255,.14)",
  ticks: "#cbd5e1",
  labels: "#94a3b8",
};
const HR_MAX = 207;
const CUTS: [number, number, number, number] = [154, 173, 183, 193];

function zoneColor(hr: number) {
  if (hr <= CUTS[0]) return COL.z1;
  if (hr <= CUTS[1]) return COL.z2;
  if (hr <= CUTS[2]) return COL.z3;
  if (hr <= CUTS[3]) return COL.z4;
  return COL.z5;
}

export default function HrChart({
  xs,
  ys,
  height = 140,
  stroke = 1.8,          // tenšia linka
  showLegend = false,    // legendu robíme zväčša mimo (HTML)
  className = "",
}: {
  xs: number[];
  ys: (number | null)[];
  height?: number;
  stroke?: number;
  showLegend?: boolean;
  className?: string;
}) {
  const Svg = useMemo(() => {
    const n = Math.min(xs.length, ys.length);
    if (!n) return () => <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;

    const W = 960;             // kreslíme do viewBoxu, prispôsobí sa šírke kontajnera
    const H = Math.max(120, height);
    const padL = 56, padR = 16, padT = 18, padB = 34;

    const _xs: number[] = [];
    const _ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const h = ys[i];
      if (h == null) continue;
      _xs.push(xs[i]);
      _ys.push(h);
    }
    if (!_ys.length) return () => <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;

    const minY = Math.min(..._ys, 108);
    const maxY = Math.max(..._ys, HR_MAX);
    const minX = _xs[0];
    const maxX = _xs[_xs.length - 1];

    const sx = (t: number) => {
      const w = W - padL - padR;
      return padL + ((t - minX) / Math.max(1, maxX - minX)) * w;
    };
    const sy = (v: number) => {
      const h = H - padT - padB;
      const t = (v - minY) / Math.max(1, maxY - minY);
      return H - padB - t * h;
    };

    // grid ticks
    const yTicks = 4;
    const yVals = new Array(yTicks + 1).fill(0).map((_, i) => minY + (i * (maxY - minY)) / yTicks);
    const xTicks = 5;
    const xVals = new Array(xTicks + 1).fill(0).map((_, i) => minX + (i * (maxX - minX)) / xTicks);

    // zónové pásy (jemnejšia intenzita)
    const levels = [minY, CUTS[0], CUTS[1], CUTS[2], CUTS[3], maxY];
    const colors = [COL.z1, COL.z2, COL.z3, COL.z4, COL.z5];
    const bands: JSX.Element[] = [];
    for (let i = 0; i < 5; i++) {
      const yTop = sy(levels[i + 1]);
      const yBot = sy(levels[i]);
      bands.push(
        <rect key={`band-${i}`}
              x={padL} width={W - padL - padR}
              y={yTop} height={Math.max(0, yBot - yTop)}
              fill={colors[i]} opacity={0.06}/>
      );
    }

    // polyline → segmentami s farbou podľa zóny
    const segs: JSX.Element[] = [];
    for (let i = 1; i < _ys.length; i++) {
      const x1 = sx(_xs[i - 1]), y1 = sy(_ys[i - 1]);
      const x2 = sx(_xs[i]),     y2 = sy(_ys[i]);
      const col = zoneColor((_ys[i - 1] + _ys[i]) / 2);
      segs.push(<line key={`seg-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={stroke} strokeLinecap="round" />);
    }

    const Axis = () => (
      <>
        {yVals.map((v, i) => (
          <g key={`gy-${i}`}>
            <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke={COL.grid} strokeDasharray="4 4" />
            <text x={padL - 10} y={sy(v)} textAnchor="end" dominantBaseline="central" fontSize={11} fill={COL.ticks}>
              {Math.round(v)}
            </text>
          </g>
        ))}
        {xVals.map((t, i) => (
          <g key={`gx-${i}`}>
            <line x1={sx(t)} x2={sx(t)} y1={padT} y2={H - padB} stroke={COL.grid} strokeDasharray="4 4" />
            <text x={sx(t)} y={H - padB + 16} textAnchor="middle" fontSize={11} fill={COL.ticks}>
              {fmtSecondsHMS(Math.round(t))}
            </text>
          </g>
        ))}
        {/* popisky osí – posunuté, aby nenarážali do čísel */}
        <text
          x={padL - 34}
          y={(padT + (H - padB)) / 2}
          textAnchor="middle"
          fontSize={11}
          fill={COL.labels}
          transform={`rotate(-90 ${padL - 34} ${(padT + (H - padB)) / 2})`}
        >bpm</text>
        <text
          x={(padL + (W - padR)) / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={11}
          fill={COL.labels}
        >čas</text>
      </>
    );

    const Legend = () => (
      <g transform={`translate(${W - padR - 180}, ${padT})`}>
        {[
          ["Z1", COL.z1],
          ["Z2", COL.z2],
          ["Z3", COL.z3],
          ["Z4", COL.z4],
          ["Z5", COL.z5],
        ].map(([label, col], i) => (
          <g key={label} transform={`translate(0, ${i * 16})`}>
            <circle cx={5} cy={-3} r={4} fill={col as string} />
            <text x={16} y={0} fontSize={10} fill={COL.ticks} dominantBaseline="middle">{label}</text>
          </g>
        ))}
      </g>
    );

    return () => (
      <svg className={className} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="HR priebeh">
        {bands}
        <Axis />
        <defs>
          <clipPath id="hrClip">
            <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
          </clipPath>
        </defs>
        <g clipPath="url(#hrClip)">{segs}</g>
        {showLegend && <Legend />}
      </svg>
    );
  }, [xs, ys, height, stroke, showLegend, className]);

  return <Svg />;
}