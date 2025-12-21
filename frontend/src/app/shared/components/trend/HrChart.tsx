"use client";

import { useMemo } from "react";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { CHART_HR } from "@/app/shared/ui/classes";
import type { JSX } from "react";

function zoneColor(hr: number) {
  const [c1, c2, c3, c4] = CHART_HR.zoneCuts;
  const { z1, z2, z3, z4, z5 } = CHART_HR.colors;
  if (hr <= c1) return z1;
  if (hr <= c2) return z2;
  if (hr <= c3) return z3;
  if (hr <= c4) return z4;
  return z5;
}

export default function HrChart({
  xs,
  ys,
  height = 120,
  compact = false,
}: {
  xs: number[];
  ys: (number | null)[];
  height?: number;
  compact?: boolean;
}) {
  const Svg = useMemo(() => {
    const n = Math.min(xs.length, ys.length);
    if (!n) {
      const cls = CHART_HR.emptyTextClass;
      return () => <div className={cls}>HR stream nie je k dispozícii.</div>;
    }

    // tesnejšie vnútorné okraje (kompaktný režim má menšie pad-y)
    const padL = compact ? 28 : 40;
    const padR = compact ? 8 : 16;
    const padT = compact ? 10 : 20;
    const padB = compact ? 20 : 26;

    const W = 980; // viewBox šírka (reálne sa roztiahne na 100%)
    const H = Math.max(100, height);

    // očistené body
    const xv: number[] = [];
    const yv: number[] = [];
    for (let i = 0; i < n; i++) {
      const h = ys[i];
      if (h != null) {
        xv.push(xs[i]);
        yv.push(h);
      }
    }
    if (!yv.length) {
      const cls = CHART_HR.emptyTextClass;
      return () => <div className={cls}>HR stream nie je k dispozícii.</div>;
    }

    const minY = Math.min(120, ...yv);
    const maxY = Math.max(CHART_HR.maxBpm, ...yv);
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

    // zónové pásy
    const bands: JSX.Element[] = [];
    const levels = [minY, ...CHART_HR.zoneCuts, maxY];
    const { z1, z2, z3, z4, z5 } = CHART_HR.colors;
    const colors = [z1, z2, z3, z4, z5];
    for (let i = 0; i < 5; i++) {
      const yTop = sy(levels[i + 1]);
      const yBot = sy(levels[i]);
      bands.push(
        <rect
          key={`band-${i}`}
          x={padL}
          width={W - padL - padR}
          y={yTop}
          height={Math.max(0, yBot - yTop)}
          fill={colors[i]}
          opacity={CHART_HR.bandOpacity}
        />
      );
    }

    // polyline – segmentované
    const segs: JSX.Element[] = [];
    for (let i = 1; i < yv.length; i++) {
      const x1 = sx(xv[i - 1]),
        y1 = sy(yv[i - 1]);
      const x2 = sx(xv[i]),
        y2 = sy(yv[i]);
      const col = zoneColor((yv[i - 1] + yv[i]) / 2);
      segs.push(
        <line
          key={`s-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={col}
          strokeWidth={
            compact ? CHART_HR.lineWidth.compact : CHART_HR.lineWidth.normal
          }
          strokeLinecap="round"
        />
      );
    }

    // legenda – centrovaná hore
    const LEG_W = 5 * 36; // približná šírka legendy
    const LEG_X = (W - LEG_W) / 2;
    const LEG_Y = padT - 4; // trošku bližšie hore
    const Legend = () => (
      <g transform={`translate(${LEG_X},${LEG_Y})`}>
        {[
          ["Z1", z1],
          ["Z2", z2],
          ["Z3", z3],
          ["Z4", z4],
          ["Z5", z5],
        ].map(([t, c], i) => (
          <g key={t} transform={`translate(${i * 36},0)`}>
            <circle cx={0} cy={0} r={4} fill={c as string} />
            <text x={8} y={2} fontSize={10} fill={CHART_HR.tickText}>
              {t}
            </text>
          </g>
        ))}
      </g>
    );

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
              {Math.round(v)}
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
              {fmtSecondsHMS(Math.round(t))}
            </text>
          </g>
        ))}
        {/* osi – popisky dovnútra */}
        <text
          x={padL + 4}
          y={(padT + (H - padB)) / 2}
          transform={`rotate(-90 ${padL + 4} ${(padT + (H - padB)) / 2})`}
          textAnchor="middle"
          fontSize={10}
          fill={CHART_HR.axisText}
        >
          bpm
        </text>
        <text
          x={(padL + (W - padR)) / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize={10}
          fill={CHART_HR.axisText}
        >
          čas
        </text>
      </>
    );

    return () => (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="HR priebeh"
      >
        {bands}
        <Axis />
        <defs>
          <clipPath id="hrClip">
            <rect
              x={padL}
              y={padT}
              width={W - padL - padR}
              height={H - padT - padB}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#hrClip)">{segs}</g>
        <Legend />
      </svg>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xs, ys, height, compact]);

  return <Svg />;
}
