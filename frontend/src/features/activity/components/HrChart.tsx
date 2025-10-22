// src/features/activity/components/HrChart.tsx
"use client";

import React, { useMemo } from "react";
import { fmtSecondsHMS } from "@/shared/utils/format";

type Props = {
  xs: number[];
  ys: (number | null)[];
  height?: number;           // výška v px – ak nepošleš, vyrátam z compact/full
  compact?: boolean;         // mini verzia
  bands?: boolean;           // farebné pásma zón
  legend?: boolean;          // legenda Z1..Z5
  strokeWidth?: number;      // default 2 (mini 1.5)
};

// fix zóny + farby (dočasne natvrdo)
const CUTS = [154, 173, 183, 193]; // Z1..Z4 max
const COL = { z1:"#60A5FA", z2:"#34D399", z3:"#FBBF24", z4:"#F97316", z5:"#EF4444", grid:"rgba(255,255,255,.15)" };

function zoneColor(hr: number) {
  if (hr <= CUTS[0]) return COL.z1;
  if (hr <= CUTS[1]) return COL.z2;
  if (hr <= CUTS[2]) return COL.z3;
  if (hr <= CUTS[3]) return COL.z4;
  return COL.z5;
}

export default function HrChart({
  xs, ys,
  height,
  compact = false,
  bands = true,
  legend = false,
  strokeWidth,
}: Props) {
  const n = Math.min(xs.length, ys.length);
  const H = height ?? (compact ? 120 : 360);
  const W = 1200;                       // virtuálne plátno, škáluje sa na 100% šírky
  const padL = 48, padR = 16, padT = 18, padB = 28;

  const points = useMemo(() => {
    const t: number[] = [];
    const v: number[] = [];
    for (let i = 0; i < n; i++) {
      const y = ys[i];
      if (y == null) continue;
      t.push(xs[i]); v.push(y);
    }
    return { t, v };
  }, [xs, ys, n]);

  if (!points.v.length) {
    return <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;
  }

  const minY = Math.min(120, ...points.v);
  const maxY = Math.max(207, ...points.v);
  const minX = points.t[0];
  const maxX = points.t[points.t.length - 1];

  const sx = (x: number) => padL + ((x - minX) / Math.max(1, maxX - minX)) * (W - padL - padR);
  const sy = (y: number) => {
    const h = H - padT - padB;
    return H - padB - ((y - minY) / Math.max(1, maxY - minY)) * h;
  };

  // mriežka
  const yTicks = 4;
  const yVals = new Array(yTicks + 1).fill(0).map((_, i) => minY + (i * (maxY - minY)) / yTicks);
  const xTicks = 5;
  const xVals = new Array(xTicks + 1).fill(0).map((_, i) => minX + (i * (maxX - minX)) / xTicks);

  // pásma
  const bandsEls: JSX.Element[] = [];
  if (bands) {
    const levels = [minY, ...CUTS, maxY];
    const cols   = [COL.z1, COL.z2, COL.z3, COL.z4, COL.z5];
    for (let i = 0; i < 5; i++) {
      const yTop = sy(levels[i + 1]);
      const yBot = sy(levels[i]);
      bandsEls.push(
        <rect key={`b-${i}`} x={padL} width={W - padL - padR}
              y={yTop} height={Math.max(0, yBot - yTop)}
              fill={cols[i]} opacity="0.08" />
      );
    }
  }

  // čiara – segmenty s farbou zóny
  const segs: JSX.Element[] = [];
  const sw = strokeWidth ?? (compact ? 1.5 : 2.5);
  for (let i = 1; i < points.v.length; i++) {
    const x1 = sx(points.t[i - 1]);
    const y1 = sy(points.v[i - 1]);
    const x2 = sx(points.t[i]);
    const y2 = sy(points.v[i]);
    const c  = zoneColor((points.v[i - 1] + points.v[i]) / 2);
    segs.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={sw} strokeLinecap="round" />);
  }

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="HR priebeh">
      {bandsEls}
      {/* grid + osi */}
      {yVals.map((v, i) => (
        <g key={`gy-${i}`}>
          <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke={COL.grid} strokeDasharray="4 4" />
          <text x={padL - 10} y={sy(v)} fontSize={compact ? 10 : 12} fill="#cbd5e1"
                textAnchor="end" dominantBaseline="central">{Math.round(v)}</text>
        </g>
      ))}
      {xVals.map((t, i) => (
        <g key={`gx-${i}`}>
          <line x1={sx(t)} x2={sx(t)} y1={padT} y2={H - padB} stroke={COL.grid} strokeDasharray="4 4" />
          <text x={sx(t)} y={H - 6} fontSize={compact ? 10 : 12} fill="#cbd5e1"
                textAnchor="middle">{fmtSecondsHMS(Math.round(t))}</text>
        </g>
      ))}
      {/* popisky osí – posunuté, nech sa nebijú s číslami */}
      <text x={padL - 28} y={(padT + (H - padB)) / 2} fill="#94a3b8"
            fontSize={compact ? 10 : 12}
            textAnchor="middle" transform={`rotate(-90 ${padL - 28} ${(padT + (H - padB)) / 2})`}>bpm</text>
      <text x={(padL + (W - padR)) / 2} y={H - 2} fill="#94a3b8" fontSize={compact ? 10 : 12}
            textAnchor="middle">čas</text>

      {/* klip a samotná čiara */}
      <defs><clipPath id="clip"><rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} /></clipPath></defs>
      <g clipPath="url(#clip)">{segs}</g>

      {/* legenda (bodky, jeden riadok) */}
      {legend && (
        <g transform={`translate(${padL}, ${padT - 8})`}>
          {[
            ["Z1", COL.z1], ["Z2", COL.z2], ["Z3", COL.z3], ["Z4", COL.z4], ["Z5", COL.z5],
          ].map(([label, col], i) => (
            <g key={label} transform={`translate(${i * 60}, 0)`}>
              <circle cx={0} cy={0} r={5} fill={col as string} />
              <text x={10} y={1} fill="#cbd5e1" fontSize={12}>{label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}