// src/app/shared/components/trend/StreamCharts.tsx
"use client";

import { useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";
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
import DisclosureToggle from "@/app/shared/ui/components/DisclosureToggle";

export type StreamMetric = "hr" | "elevation" | "power" | "pace" | "cadence";

type ActivityStreamChartsProps = {
  streams: StreamsData;
  compact?: boolean;
  sportHint?: string | null;
};

// --- Kompaktný formát času (napr. 7:34 namiesto 7m 34s) ---
function formatCompactTime(totalSeconds: number | null | undefined) {
  if (totalSeconds == null) return "0:00";
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    const mm = String(m).padStart(2, "0");
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${ss}`;
}

// --- Funkcia na vyhladenie senzorových dát (Moving Average) ---
function smoothArray(data: (number | null)[], windowSize: number): (number | null)[] {
  if (windowSize <= 1) return data;
  const result: (number | null)[] = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    if (data[i] == null) {
      result.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(data.length - 1, i + half); j++) {
      if (data[j] != null) {
        sum += data[j] as number;
        count++;
      }
    }
    result.push(count > 0 ? sum / count : null);
  }
  return result;
}

// --- Transformácia a Vyhladenie dát pre Recharts ---
function formatDataForRecharts(streams: StreamsData, isRunSport: boolean) {
  const { time_s, hr, altitude_m, distance_m, cadence_rpm, power_w } = streams;
  if (!time_s || time_s.length === 0) return [];

  // Výpočet tempa na 15s okne (prirodzené vyhladenie GPS šumu)
  const paceData = time_s.map((t, i) => {
    if (!distance_m) return null;
    const WINDOW = 15; // 15-sekundové okno
    const startIndex = Math.max(0, i - WINDOW);
    const dt = t - time_s[startIndex];
    const dd = (distance_m[i] || 0) - (distance_m[startIndex] || 0);

    // Potrebujeme aspoň 5m posun, inak to generuje nezmyselné nuly
    if (dt <= 0 || dd <= 5) return null;
    const p = dt / (dd / 1000); // s/km
    if (p < 120 || p > 1200) return null; // orezanie limitov (2:00/km až 20:00/km)
    return p;
  });

  // Aplikovanie Moving Average pre výšku a výkon
  const smoothedAlt = altitude_m ? smoothArray(altitude_m, 10) : [];
  const smoothedPow = power_w ? smoothArray(power_w, 10) : [];

  return time_s.map((t, i) => ({
    time: t,
    hr: hr?.[i] ?? null,
    altitude: smoothedAlt[i] ?? null,
    pace: paceData[i] ?? null,
    power: smoothedPow[i] ?? null,
    cadence: cadence_rpm?.[i] != null ? (isRunSport ? cadence_rpm[i]! * 2 : cadence_rpm[i]) : null,
  }));
}

// --- Vlastný Tooltip ---
const CustomTooltip = ({ active, payload, label, formatY }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#121418]/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl text-xs z-50 min-w-[120px]">
        <p className="font-bold opacity-90 mb-2 pb-1.5 border-b border-white/10">
          {formatCompactTime(label)}
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

export function ActivityStreamCharts({ streams, compact = false, sportHint }: ActivityStreamChartsProps) {
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

  // Zdieľaný stav pre prepojenie sliderov (Brush) a skrytie pravítka
  const [brushIdx, setBrushIdx] = useState({ start: 0, end: hasTime ? chartData.length - 1 : 0 });
  const [showTooltip, setShowTooltip] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  const handleBrushChange = (e: any) => {
    if (e && e.startIndex !== undefined && e.endIndex !== undefined) {
      setBrushIdx({ start: e.startIndex, end: e.endIndex });
    }
  };

  const getDynamicDomain = (key: string, padBot: number, padTop: number) => {
    if (!chartData || chartData.length === 0) return ["auto", "auto"];
    const visibleData = chartData.slice(brushIdx.start, brushIdx.end + 1);
    const vals = visibleData.map(d => d[key as keyof typeof d]).filter(v => v != null) as number[];
    if (!vals.length) return ["auto", "auto"];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [Math.max(0, Math.floor(min) - padBot), Math.ceil(max) + padTop];
  };

  if (!hasTime) {
    return <div className="opacity-70 text-sm">{t("sessions.charts.stream.unavailable")}</div>;
  }

  const formatPace = (v: number) => formatCompactTime(Math.round(v));
  const syncId = "globalStreamSync"; 
  const chartHeight = compact ? 120 : 160;
  const mainMargins = { top: 5, right: 10, left: -20, bottom: 5 };

  const tooltipCursor = showTooltip ? { stroke: CHART_HR.grid, strokeWidth: 1, strokeDasharray: "4 4" } : false;

  const renderMiniMapZoom = (key: string) => (
    <div key={key} className="my-2">
      <div className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-40 pl-6">
        Zoom / Výrez
      </div>
      <div style={{ height: 40, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <Line type="monotone" dataKey={hasHr ? "hr" : "altitude"} stroke="rgba(255,255,255,0.15)" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Brush 
              dataKey="time" 
              height={30} 
              stroke={CHART_HR.axisText} 
              fill="transparent" 
              tickFormatter={formatCompactTime} 
              startIndex={brushIdx.start}
              endIndex={brushIdx.end}
              onChange={handleBrushChange}
              travellerWidth={12} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderHrChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.hrFull")}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={mainMargins}>
            <defs>
              <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z4} stopOpacity={0.5} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("hr", 5, 5)} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={showTooltip ? <CustomTooltip formatY={(v: number) => `${Math.round(v)} ${t("common.units.hr")}`} /> : <></>} cursor={tooltipCursor} isAnimationActive={false} />
            <Area type="monotone" dataKey="hr" name={t("common.units.hr")} stroke={CHART_HR.colors.z4} fill="url(#colorHr)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderElevationChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.elevation")}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={mainMargins}>
            <defs>
              <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z2} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("altitude", 5, 10)} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={showTooltip ? <CustomTooltip formatY={(v: number) => `${Math.round(v)} ${t("common.units.m")}`} /> : <></>} cursor={tooltipCursor} isAnimationActive={false} />
            <Area type="monotone" dataKey="altitude" name={t("common.units.m")} stroke={CHART_HR.colors.z2} fill="url(#colorAlt)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPaceChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.pace")}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={mainMargins}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis reversed domain={getDynamicDomain("pace", 15, 15)} tickFormatter={formatPace} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={showTooltip ? <CustomTooltip formatY={formatPace} /> : <></>} cursor={tooltipCursor} isAnimationActive={false} />
            <Line type="monotone" dataKey="pace" name={t("common.units.pace")} stroke={CHART_HR.colors.z1} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPowerChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.power")}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={mainMargins}>
            <defs>
              <linearGradient id="colorPow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z3} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_HR.colors.z3} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("power", 10, 10)} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={showTooltip ? <CustomTooltip formatY={(v: number) => `${Math.round(v)} W`} /> : <></>} cursor={tooltipCursor} isAnimationActive={false} />
            <Area type="monotone" dataKey="power" name={t("common.units.power")} stroke={CHART_HR.colors.z3} fill="url(#colorPow)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderCadenceChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.cadence")}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={mainMargins}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: CHART_HR.tickText }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("cadence", 5, 5)} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={3} axisLine={false} tickLine={false} />
            <Tooltip content={showTooltip ? <CustomTooltip formatY={(v: number) => Math.round(v)} /> : <></>} cursor={tooltipCursor} isAnimationActive={false} />
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
      {/* Hlavička s Toggle na skrytie pravítka */}
      <div className="flex justify-end mb-4 px-4">
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-md transition-all border ${
            showTooltip 
              ? "bg-white/10 text-white border-white/20" 
              : "bg-transparent text-white/40 border-white/10 hover:bg-white/5"
          }`}
        >
          {showTooltip ? "Skryť pravítko" : "Zobraziť pravítko"}
        </button>
      </div>

      {activeCharts.length > 1 && renderMiniMapZoom("top-brush")}
      
      <div className="mt-6">
        {activeCharts.map(chart => <div key={chart.key}>{chart.render()}</div>)}
      </div>

      {activeCharts.length > 1 && renderMiniMapZoom("bottom-brush")}
    </div>
  );
}
