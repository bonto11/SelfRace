"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";

import { fmtSecondsHMS } from "@/app/shared/utils/time";
import {
  CHART_HR,
  FLUSH_DETAIL_PB,
  SCROLL_X,
} from "@/app/shared/ui/classes";
import type { StreamsData } from "@/app/features/activities/types/activities";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";

export type StreamMetric = "hr" | "elevation" | "power" | "pace" | "cadence";

type ActivityStreamChartsProps = {
  streams: StreamsData;
  compact?: boolean;
  metric?: StreamMetric;
  /** hint na šport – použijeme na rozhodnutie, či kadenciu zdvojnásobiť (run → steps/min) */
  sportHint?: string | null;
};

type BaseChartProps = {
  xs: number[];
  ys: (number | null | undefined)[];
  height?: number;
  compact?: boolean;
  yLabel?: string;
  formatY?: (v: number) => string;
  mode?: "hr" | "plain";
  strokeColor?: string;
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
 */
function BaseStreamChart({
  xs,
  ys,
  height = 120,
  compact = false,
  yLabel,
  formatY,
  mode = "plain",
  strokeColor,
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
      // HR špecifiká – nech to sedí so zónami
      minY = Math.min(120, minY);
      maxY = Math.max(CHART_HR.maxBpm, maxY);
    } else {
      if (minY === maxY) {
        minY -= 1;
        maxY += 1;
      }
    }

    const sx = (t: number) =>
      padL + ((t - minX) / Math.max(1, maxX - minX)) * (W - padL - padR);

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
          : strokeColor || CHART_HR.axisText;

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
            transform={`rotate(-90 ${padL + 4} ${(padT + (H - padB)) / 2})`}
            textAnchor="middle"
            fontSize={10}
            fill={CHART_HR.axisText}
          >
            {yLabel}
          </text>
        )}
      </>
    );

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
                    <text x={8} y={2} fontSize={10} fill={CHART_HR.tickText}>
                      {t}
                    </text>
                  </g>
                ))}
              </g>
            );
          }
        : () => null;

    return () => (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img">
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
  }, [xs, ys, height, compact, yLabel, formatY, mode, strokeColor]);

  return <Svg />;
}

/**
 * Wrapper pre stream grafy.
 * - ak `metric` NIE je zadaný → všetky grafy + header + toggle
 * - ak `metric` JE zadaný → len daný graf, bez headera (na použitie v sekciách).
 */
export function ActivityStreamCharts({
  streams,
  compact = false,
  metric,
  sportHint,
}: ActivityStreamChartsProps) {
  const { time_s, hr, altitude_m, distance_m, cadence_rpm, power_w } =
    streams;

  const hasTime = Array.isArray(time_s) && time_s.length > 0;
  const hasHr = Array.isArray(hr) && hr.length > 0;
  const hasAlt =
    Array.isArray(altitude_m) && altitude_m.some((v) => v != null);
  const hasDist =
    Array.isArray(distance_m) && distance_m.some((v) => v != null);
  const hasCad =
    Array.isArray(cadence_rpm) && cadence_rpm.some((v) => v != null);
  const hasPow =
    Array.isArray(power_w) && power_w.some((v) => v != null);

  const isRunSport = useMemo(() => {
    if (!sportHint) return false;
    const s = sportHint.toLowerCase();
    return s.includes("run") || s.includes("trail");
  }, [sportHint]);

  // pace (s/km)
  const pace_s_per_km: (number | null)[] = useMemo(() => {
    if (!hasDist || !hasTime) return [];

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
  }, [hasDist, hasTime, time_s, distance_m]);

  // kadencia – ak run → steps/min = rpm*2
  const cadenceSeries: (number | null)[] = useMemo(() => {
    if (!hasCad) return [];
    if (!isRunSport) return cadence_rpm as (number | null)[];
    return (cadence_rpm as (number | null)[]).map((v) =>
      v == null ? null : v * 2
    );
  }, [hasCad, cadence_rpm, isRunSport]);

  if (!hasTime) {
    return (
      <div className="opacity-70 text-sm">
        Stream dáta nie sú k dispozícii pre túto aktivitu.
      </div>
    );
  }

  const formatPace = (v: number) => fmtSecondsHMS(Math.round(v));
  const height = compact ? 148 : 220;

  /** ====== režim: konkrétny metric (sekcie v ActivitySessionDetail) ====== */
  if (metric) {
    const common = { xs: time_s, height, compact };

    if (metric === "hr") {
      if (!hasHr) {
        return (
          <div className="opacity-70 text-sm">
            HR stream nie je k dispozícii.
          </div>
        );
      }
      return (
        <BaseStreamChart
          {...common}
          ys={hr}
          yLabel="bpm"
          mode="hr"
        />
      );
    }

    if (metric === "elevation") {
      if (!hasAlt) {
        return (
          <div className="opacity-70 text-sm">
            Elevation stream nie je k dispozícii.
          </div>
        );
      }
      return (
        <BaseStreamChart
          {...common}
          ys={altitude_m ?? []}
          yLabel="m"
          mode="plain"
          strokeColor={CHART_HR.colors.z2}
        />
      );
    }

    if (metric === "pace") {
      if (!hasDist) {
        return (
          <div className="opacity-70 text-sm">
            Pace stream nie je k dispozícii.
          </div>
        );
      }
      return (
        <BaseStreamChart
          {...common}
          ys={pace_s_per_km}
          yLabel="s/km"
          formatY={formatPace}
          mode="plain"
          strokeColor={CHART_HR.colors.z3}
        />
      );
    }

    if (metric === "power") {
      if (!hasPow) {
        return (
          <div className="opacity-70 text-sm">
            Power stream nie je k dispozícii.
          </div>
        );
      }
      return (
        <BaseStreamChart
          {...common}
          ys={power_w ?? []}
          yLabel="W"
          mode="plain"
          strokeColor={CHART_HR.colors.z4}
        />
      );
    }

    if (metric === "cadence") {
      if (!hasCad) {
        return (
          <div className="opacity-70 text-sm">
            Cadence stream nie je k dispozícii.
          </div>
        );
      }
      return (
        <BaseStreamChart
          {...common}
          ys={cadenceSeries}
          yLabel={isRunSport ? "steps/min" : "rpm"}
          mode="plain"
          strokeColor={CHART_HR.colors.z5}
        />
      );
    }

    return null;
  }

  /** ====== režim: všetky grafy + header (coach / calendar detail) ====== */

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-3">
      <div className={FLUSH_DETAIL_PB}>
        {/* Header s názvom + toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Podrobné grafy</span>
            <span className="text-[11px] opacity-70">
              HR, prevýšenie, tempo, výkon a kadencia
            </span>
          </div>
          <DisclosureToggle
            open={isOpen}
            onToggle={() => setIsOpen((v) => !v)}
            labelWhenOpen="Skryť podrobné grafy"
            labelWhenClosed="Zobraziť podrobné grafy"
          />
        </div>

        {isOpen && (
          <div className="mt-3">
            <div className={SCROLL_X}>
              <div className="space-y-4 py-1 min-w-[720px]">
                {hasHr && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-bold text-sm">HR priebeh</h4>
                    </div>
                    <BaseStreamChart
                      xs={time_s}
                      ys={hr}
                      height={height}
                      compact={compact}
                      yLabel="bpm"
                      mode="hr"
                    />
                  </div>
                )}

                {hasAlt && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-bold text-sm">Prevýšenie</h4>
                    </div>
                    <BaseStreamChart
                      xs={time_s}
                      ys={altitude_m ?? []}
                      height={height}
                      compact={compact}
                      yLabel="m"
                      mode="plain"
                      strokeColor={CHART_HR.colors.z2}
                    />
                  </div>
                )}

                {hasDist && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-bold text-sm">Tempo (instantné)</h4>
                    </div>
                    <BaseStreamChart
                      xs={time_s}
                      ys={pace_s_per_km}
                      height={height}
                      compact={compact}
                      yLabel="s/km"
                      formatY={formatPace}
                      mode="plain"
                      strokeColor={CHART_HR.colors.z3}
                    />
                  </div>
                )}

                {hasPow && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-bold text-sm">Power</h4>
                    </div>
                    <BaseStreamChart
                      xs={time_s}
                      ys={power_w ?? []}
                      height={height}
                      compact={compact}
                      yLabel="W"
                      mode="plain"
                      strokeColor={CHART_HR.colors.z4}
                    />
                  </div>
                )}

                {hasCad && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-bold text-sm">Cadence</h4>
                    </div>
                    <BaseStreamChart
                      xs={time_s}
                      ys={cadenceSeries}
                      height={height}
                      compact={compact}
                      yLabel={isRunSport ? "steps/min" : "rpm"}
                      mode="plain"
                      strokeColor={CHART_HR.colors.z5}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}