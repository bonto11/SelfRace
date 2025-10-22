// src/features/activity/components/HrChart.tsx
"use client";
import { useMemo } from "react";
import { fmtSecondsHMS } from "@/shared/utils/format";

// Fixné farby a zóny (ako predtým)
const COL = { z1:"#60A5FA", z2:"#34D399", z3:"#FBBF24", z4:"#F97316", z5:"#EF4444", grid:"rgba(255,255,255,.15)" };
const CUTS: [number, number, number, number] = [154, 173, 183, 193];
const HR_MAX = 207;

function zoneColor(hr: number) {
  if (hr <= CUTS[0]) return COL.z1;
  if (hr <= CUTS[1]) return COL.z2;
  if (hr <= CUTS[2]) return COL.z3;
  if (hr <= CUTS[3]) return COL.z4;
  return COL.z5;
}

export default function HrChart({
  xs, ys, height = 240, compact = false, legend = "inline", topPad
}: {
  xs: number[]; ys: (number|null)[];
  height?: number;
  compact?: boolean;
  legend?: "inline" | "center";
  topPad?: number;
}) {
  const Svg = useMemo(() => {
    const pts: {t:number; hr:number}[] = [];
    for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
      const v = ys[i]; if (v == null) continue;
      pts.push({ t: xs[i], hr: v });
    }
    if (!pts.length) return () => <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;

    const W = 1100;              // virtuálna šírka (reaguje cez viewBox)
    const H = height ?? 240;
    const padL = 48, padR = 16, padT = topPad ?? (compact ? 10 : 16), padB = 34;

    const minY = Math.min(120, ...pts.map(p=>p.hr));
    const maxY = Math.max(HR_MAX, ...pts.map(p=>p.hr));
    const minX = pts[0].t, maxX = pts[pts.length-1].t;

    const sx = (t:number) => padL + ((t-minX)/Math.max(1, maxX-minX)) * (W-padL-padR);
    const sy = (v:number) => {
      const h = H - padT - padB;
      return H - padB - ((v-minY)/Math.max(1, maxY-minY)) * h;
    };

    const yTicks = 4, xTicks = 5;
    const yVals = new Array(yTicks+1).fill(0).map((_,i)=> minY + i*(maxY-minY)/yTicks);
    const xVals = new Array(xTicks+1).fill(0).map((_,i)=> minX + i*(maxX-minX)/xTicks);

    const levels = [minY, CUTS[0], CUTS[1], CUTS[2], CUTS[3], maxY];
    const bandCols = [COL.z1, COL.z2, COL.z3, COL.z4, COL.z5];

    const bands = levels.slice(0,5).map((lv, i) => {
      const yTop = sy(levels[i+1]);
      const yBot = sy(levels[i]);
      return (
        <rect key={`band-${i}`} x={padL} y={yTop} width={W-padL-padR} height={Math.max(0, yBot-yTop)} fill={bandCols[i]} opacity={0.08}/>
      );
    });

    const segs = pts.slice(1).map((p, i) => {
      const p0 = pts[i];
      const col = zoneColor((p0.hr + p.hr)/2);
      return <line key={`seg-${i}`} x1={sx(p0.t)} y1={sy(p0.hr)} x2={sx(p.t)} y2={sy(p.hr)} stroke={col} strokeWidth={compact?1.8:2.2} strokeLinecap="round"/>;
    });

    const LegendInline = () => (
      <div className="flex items-center gap-5 text-xs opacity-90 mb-1">
        {[
          ["Z1", COL.z1], ["Z2", COL.z2], ["Z3", COL.z3], ["Z4", COL.z4], ["Z5", COL.z5],
        ].map(([label, color]) => (
          <span key={label as string} className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color as string }} />
            {label}
          </span>
        ))}
      </div>
    );

    const LegendCenter = () => (
      <g transform={`translate(${W/2 - 120}, ${padT - 6})`}>
        {[
          ["Z1", COL.z1], ["Z2", COL.z2], ["Z3", COL.z3], ["Z4", COL.z4], ["Z5", COL.z5],
        ].map(([label, col], i) => (
          <g key={label} transform={`translate(${i*48}, 0)`}>
            <circle cx={0} cy={0} r={5} fill={col as string} />
            <text x={10} y={1} fontSize={11} fill="#cbd5e1">{label}</text>
          </g>
        ))}
      </g>
    );

    return () => (
      <div className="w-full">
        {legend === "inline" && <LegendInline />}
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="HR priebeh">
          {legend === "center" && <LegendCenter />}

          {bands}

          {/* grid + osi */}
          {yVals.map((v,i)=>(
            <g key={`gy-${i}`}>
              <line x1={padL} x2={W-padR} y1={sy(v)} y2={sy(v)} stroke={COL.grid} strokeDasharray="4 4"/>
              <text x={padL-8} y={sy(v)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#cbd5e1">
                {Math.round(v)}
              </text>
            </g>
          ))}
          {xVals.map((t,i)=>(
            <g key={`gx-${i}`}>
              <line x1={sx(t)} x2={sx(t)} y1={padT} y2={H-padB} stroke={COL.grid} strokeDasharray="4 4"/>
              <text x={sx(t)} y={H-padB+14} textAnchor="middle" fontSize={11} fill="#cbd5e1">
                {fmtSecondsHMS(Math.round(t))}
              </text>
            </g>
          ))}

          {/* popisy osí s bezpečným odsadením */}
          <text x={padL-30} y={(padT+(H-padB))/2} textAnchor="middle" fontSize={11} fill="#94a3b8"
                transform={`rotate(-90 ${padL-30} ${(padT+(H-padB))/2})`}>bpm</text>
          <text x={(padL+(W-padR))/2} y={H-4} textAnchor="middle" fontSize={11} fill="#94a3b8">čas</text>

          {/* krivka */}
          <defs>
            <clipPath id="hrClip">
              <rect x={padL} y={padT} width={W-padL-padR} height={H-padT-padB}/>
            </clipPath>
          </defs>
          <g clipPath="url(#hrClip)">{segs}</g>
        </svg>
      </div>
    );
  }, [xs, ys, height, compact, legend]);

  return <Svg />;
}