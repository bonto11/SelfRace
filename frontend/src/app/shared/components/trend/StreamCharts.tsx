// src/app/shared/components/trend/StreamCharts.tsx
"use client";

import { useMemo } from "react";
import { useT } from "@/app/shared/i18n/useT";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { CHART_HR } from "@/app/shared/ui/tokens";
import type { StreamsData } from "@/app/features/activities/types/activities";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  LineChart,
  Line,
} from "recharts";

export type StreamMetric = "hr" | "elevation" | "power" | "pace" | "cadence";

type ActivityStreamChartsProps = {
  streams: StreamsData;
  compact?: boolean;
  sportHint?: string | null;
};

// --- Transformácia dát pre Recharts ---
function formatDataForRecharts(streams: StreamsData, isRunSport: boolean) {
  const { time_s, hr, altitude_m, distance_m, cadence_rpm, power_w } = streams;
  if (!time_s || time_s.length === 0) return [];

  const paceData = time_s.map((t, i) => {
    if (i === 0 || !distance_m || distance_m[i] == null || distance_m[i - 1] == null) return null;
    const dt = t - time_s[i - 1];
    const dd = distance_m[i]! - distance_m[i - 1]!;
    if (dt <= 0 || dd <= 0.5) return null;
    const p = dt / (dd / 1000); // s/km
    return Number.isFinite(p) && p > 0 ? p : null;
  });

  return time_s.map((t, i) => ({
    time: t,
    hr: hr?.[i] ?? null,
    altitude: altitude_m?.[i] ?? null,
    pace: paceData[i],
    power: power_w?.[i] ?? null,
    cadence: cadence_rpm?.[i] != null ? (isRunSport ? cadence_rpm[i]! * 2 : cadence_rpm[i]) : null,
  }));
}

// --- Vlastný Tooltip ---
const CustomTooltip = ({ active, payload, label, formatY }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl text-xs z-50 min-w-[120px]">
        <p className="font-bold opacity-90 mb-2 pb-1.5 border-b border-white/10">
          {fmtSecondsHMS(label)}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
            <span className="opacity-70" style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-mono font-semibold">
              {formatY ? formatY(entry.value) : Math.round(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function ActivityStreamCharts({
  streams,
  compact = false,
  sportHint,
}: ActivityStreamChartsProps) {
  const t = useT();

  const isRunSport = useMemo(() => {
    if (!sportHint) return false;
    const s = sportHint.toLowerCase();
    return s.includes("run") || s.includes("trail");
  }, [sportHint]);

  const chartData = useMemo(() => formatDataForRecharts(streams, isRunSport), [streams, isRunSport]);
  
  const hasTime = chartData.length > 0;
  const hasHr = chartData.some((d) => d.hr != null);
  const hasAlt = chartData.some((d) => d.altitude != null);
  const hasPace = chartData.some((d) => d.pace != null);
  const hasPow = chartData.some((d) => d.power != null);
  const hasCad = chartData.some((d) => d.cadence != null);

  if (!hasTime) {
    return <div className="opacity-70 text-sm">{t("charts.stream.unavailable" as any)}</div>;
  }

  const formatPace = (v: number) => fmtSecondsHMS(Math.round(v));
  const syncId = "globalStreamSync"; 
  const chartHeight = compact ? 120 : 160;

  // --- Obojstranná Mini-mapa (Slider) ---
  const renderMiniMapZoom = (key: string) => (
    <div key={key} className="my-2">
      <div className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-50 pl-4">
        Zoom (Výrez)
      </div>
      <div style={{ height: 40, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
            <Line type="monotone" dataKey={hasHr ? "hr" : "altitude"} stroke={CHART_HR.grid} dot={false} strokeWidth={1} isAnimationActive={false} />
            <Brush 
              dataKey="time" 
              height={30} 
              stroke={CHART_HR.axisText} 
              fill="transparent" 
              tickFormatter={fmtSecondsHMS} 
              travellerWidth={12} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // --- Jednotlivé grafy ---
  const renderHrChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-4">{t("charts.metrics.hrFull" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z4} stopOpacity={0.5} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={["dataMin - 10", "dataMax + 10"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => `${Math.round(v)} bpm`} />} cursor={{ stroke: CHART_HR.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area type="monotone" dataKey="hr" name={t("common.units.hr")} stroke={CHART_HR.colors.z4} fill="url(#colorHr)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderElevationChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-4">{t("charts.metrics.elevation" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z2} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={["dataMin", "dataMax + 20"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => `${Math.round(v)} m`} />} cursor={{ stroke: CHART_HR.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area type="monotone" dataKey="altitude" name={t("common.units.m")} stroke={CHART_HR.colors.z2} fill="url(#colorAlt)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPaceChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-4">{t("charts.metrics.pace" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis reversed domain={["dataMin", "dataMax"]} tickFormatter={formatPace} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={formatPace} />} cursor={{ stroke: CHART_HR.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line type="monotone" dataKey="pace" name={t("common.units.pace")} stroke={CHART_HR.colors.z1} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPowerChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-4">{t("charts.metrics.power" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorPow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z3} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_HR.colors.z3} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={["dataMin", "dataMax + 20"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => `${Math.round(v)} W`} />} cursor={{ stroke: CHART_HR.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area type="monotone" dataKey="power" name={t("common.units.power")} stroke={CHART_HR.colors.z3} fill="url(#colorPow)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderCadenceChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-4">{t("charts.metrics.cadence" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={["dataMin - 10", "dataMax + 10"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={3} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => Math.round(v)} />} cursor={{ stroke: CHART_HR.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line type="step" dataKey="cadence" name={isRunSport ? t("common.units.kadenceRun") : t("common.units.kadenceBike")} stroke={CHART_HR.colors.z5} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const activeCharts = [
    { key: "hr", active: hasHr, render: renderHrChart },
    { key: "pace", active: hasPace, render: renderPaceChart },
    { key: "power", active: hasPow, render: renderPowerChart },
    { key: "elevation", active: hasAlt, render: renderElevationChart },
    { key: "cadence", active: hasCad, render: renderCadenceChart },
  ].filter(c => c.active);

  return (
    <div className="w-full">
      {activeCharts.length > 1 && renderMiniMapZoom("top-brush")}
      
      <div className="mt-6">
        {activeCharts.map(chart => <div key={chart.key}>{chart.render()}</div>)}
      </div>

      {activeCharts.length > 1 && renderMiniMapZoom("bottom-brush")}
    </div>
  );
}
