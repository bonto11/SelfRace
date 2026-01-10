"use client";

import { useMemo } from "react";
import type { JSX } from "react";

import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { CHART_HR } from "@/app/shared/ui/classes";
import type { StreamsData } from "@/app/features/activities/types/activities";

type ActivityStreamChartsProps = {
  streams: StreamsData;
  compact?: boolean;
};

type BaseChartProps = {
  xs: number[];
  ys: (number | null | undefined)[];
  height?: number;
  compact?: boolean;
  yLabel?: string;
  formatY?: (v: number) => string;
  mode?: "hr" | "plain";
};

type MiniChartProps = {
  title: string;
  xs: number[];
  ys: (number | null | undefined)[];
  compact?: boolean;
  yLabel?: string;
  formatY?: (v: number) => string;
};

/** HR zónová farba */
function zoneColor(hr: number) {
  const [c1, c2, c3, c4] = CHART_HR.zoneCuts;
  const { z1, z2, z3, z4, z5 } = CHART_HR.colors;
  if (hr <= c1) return z1;
  if (hr <= c2) return z2;
  if (hr <= c3) return z3;
  if (hr <= c4) return z4;
  return z5;
}

/**
 * Jednotný základ pre všetky stream grafy.
 * mode="hr" → zónové pásy + farebné segmenty + legenda
 * mode="plain" → jednoduchý line chart bez pásov
 */
function BaseStreamChart({
  xs,
  ys,
  height = 120,
  compact = false,
  yLabel,
  formatY,
  mode = "plain",
}: BaseChartProps) {
  const Svg = useMemo(() => {
    const n = Math.min(xs.length, ys.length);
    if (!n) {
      return () => (
        <div className={CHART_HR.emptyTextClass}>
          Stream nie je k dispozícii.
        </div>
      );
    }

    // očistené body
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const v = ys[i];
      if (v == null) continue;
      points.push({ x: xs[i], y: Number(v) });
    }

    if (!points.length) {
      return () => (
        <div className={CHART_HR.emptyTextClass}>
          Stream nie je k dispozícii.
        </div>
      );
    }

    // paddingy
    const padL = compact ? 28 : 40;
    const padR = compact ? 8 : 16;
    const padT = compact ? 10 : 20;
    const padB = compact ? 20 : 26;

    const W = 980;
    const H = Math.max(100, height);

    const minX = points[0].x;
    const maxX = points[points.length - 1].x;

    let minY = points[0].y;
    let maxY = points[0].y;
    for (const p of points) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    if (mode === "hr") {
      // HR špecifiká – nech to nie je úplne od 0
      minY = Math.min(120, minY);
      maxY = Math.max(CHART_HR.maxBpm, maxY);
    } else {
      if (minY === maxY) {
        minY -= 1;
        maxY += 1;
      }
    }

    const sx = (t: number) =>
      padL +
      ((t - minX) / Math.max(1, maxX - minX)) * (W - padL - padR);

    const sy = (v: number) => {
      const h = H - padT - padB;
      const t = (v - minY) / Math.max(1, maxY - minY);
      return H - padB - t * h;
    };

    // ticks
    const xTicks = 5;
    const xVals = Array.from(
      { length: xTicks + 1 },
      (_, i) => minX + (i * (maxX - minX)) / xTicks
    );

    const yTicks = 4;
    const yVals = Array.from(
      { length: yTicks + 1 },
      (_, i) => minY + (i * (maxY - minY)) / yTicks
    );

    // zónové pásy len pre HR
    const bands: JSX.Element[] = [];
    if (mode === "hr") {
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
    }

    // polyline – segmenty
    const segs: JSX.Element[] = [];
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];

      const x1 = sx(p1.x);
      const y1 = sy(p1.y);
      const x2 = sx(p2.x);
      const y2 = sy(p2.y);

      const col =
        mode === "hr"
          ? zoneColor((p1.y + p2.y) / 2)
          : CHART_HR.axisText;

      segs.push(
        <line
          key={`seg-${i}`}
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
              y={H - padB + 14}
              textAnchor="middle"
              fontSize={10}
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
            fontSize={10}
            fill={CHART_HR.axisText}
          >
            {yLabel}
          </text>
        )}
      </>
    );

    // legenda pre HR
    const Legend =
      mode === "hr"
        ? () => {
            const LEG_W = 5 * 36;
            const LEG_X = (W - LEG_W) / 2;
            const LEG_Y = padT - 4;
            const { z1, z2, z3, z4, z5 } = CHART_HR.colors;
            return (
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
                    <text
                      x={8}
                      y={2}
                      fontSize={10}
                      fill={CHART_HR.tickText}
                    >
                      {t}
                    </text>
                  </g>
                ))}
              </g>
            );
          }
        : () => null;

    return () => (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
      >
        {bands}
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
        <Legend />
      </svg>
    );
  }, [xs, ys, height, compact, yLabel, formatY, mode]);

  return <Svg />;
}

/** Mini chart – obalí BaseStreamChart do malej karty s titulkom. */
function MiniStreamChart({
  title,
  xs,
  ys,
  compact = false,
  yLabel,
  formatY,
}: MiniChartProps) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
      <div className="text-[11px] font-semibold mb-1 opacity-80">
        {title}
      </div>
      <BaseStreamChart
        xs={xs}
        ys={ys}
        height={compact ? 100 : 120}
        compact={compact}
        yLabel={yLabel}
        formatY={formatY}
        mode="plain"
      />
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
  const { time_s, hr, altitude_m, distance_m, cadence_rpm, power_w } =
    streams;

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
  const hasPow =
    Array.isArray(power_w) && power_w.some((v) => v != null);

  // instant pace zo vzdialenosti a času
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
          <BaseStreamChart
            xs={time_s}
            ys={hr}
            height={compact ? 148 : 220}
            compact={compact}
            yLabel="bpm"
            mode="hr"
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