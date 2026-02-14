// src/app/shared/components/trend/StreamCharts.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";
import { CHART_HR } from "@/app/shared/ui/tokens";
import type { StreamsData } from "@/app/features/activities/types/activities";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Line,
} from "recharts";

export type StreamMetric = "hr" | "elevation" | "power" | "pace" | "cadence";

type ActivityStreamChartsProps = {
  streams: StreamsData;
  compact?: boolean;
  sportHint?: string | null;
};

// --- Kompaktný formát času (napr. 7:34) ---
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

// --- Vyhladenie (Moving Average) ---
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

// --- Doplnenie prázdnych dier ---
function forwardFill(data: (number | null | undefined)[], defaultVal: number | null = null): (number | null)[] {
  let last: number | null = defaultVal;
  for (let i = 0; i < data.length; i++) {
    if (data[i] != null && Number.isFinite(data[i])) { last = data[i] as number; break; }
  }
  return data.map(v => {
    if (v != null && Number.isFinite(v)) {
      last = v;
      return v;
    }
    return last;
  });
}

// --- Transformácia dát pre Recharts ---
function formatDataForRecharts(streams: StreamsData, isRunSport: boolean) {
  let { time_s, hr, altitude_m, distance_m, cadence_rpm, power_w } = streams;
  if (!time_s || time_s.length === 0) return [];

  // 1. Odsekneme prvé 3 sekundy (spin-up senzorov)
  const t0 = time_s[0];
  let startIdx = 0;
  while (startIdx < time_s.length && time_s[startIdx] - t0 <= 3) {
    startIdx++;
  }

  const tSlice = time_s.slice(startIdx);
  const hrSlice = hr ? hr.slice(startIdx) : [];
  const altSlice = altitude_m ? altitude_m.slice(startIdx) : [];
  const distSlice = distance_m ? distance_m.slice(startIdx) : [];
  const cadSlice = cadence_rpm ? cadence_rpm.slice(startIdx) : [];
  const powSlice = power_w ? power_w.slice(startIdx) : [];

  // 2. Tempo vyhladzujeme cez 15-sekundové okno
  const paceData = tSlice.map((t, i) => {
    if (!distSlice || distSlice.length === 0) return null;
    const WINDOW = 15; 
    const wStart = Math.max(0, i - WINDOW);
    const dt = t - tSlice[wStart];
    const dd = (distSlice[i] || 0) - (distSlice[wStart] || 0);

    if (dt <= 0 || dd <= 3) return null; 
    const p = dt / (dd / 1000); 
    if (p < 120 || p > 1200) return null; 
    return p;
  });

  // 3. Forward Fill + Smooth
  const filledHr = forwardFill(hrSlice);
  const filledAlt = smoothArray(forwardFill(altSlice), 10);
  const filledPow = smoothArray(forwardFill(powSlice, 0), 5);
  const filledCad = forwardFill(cadSlice, 0);
  const filledPace = smoothArray(forwardFill(paceData), 5);

  return tSlice.map((t, i) => ({
    time: t,
    hr: filledHr[i] ?? null,
    altitude: filledAlt[i] ?? null,
    pace: filledPace[i] ?? null,
    power: filledPow[i] ?? null,
    cadence: filledCad[i] != null ? (isRunSport ? filledCad[i]! * 2 : filledCad[i]) : null,
  }));
}

// --- Vlastný Tooltip ---
const CustomTooltip = ({ active, payload, label, formatY, showTooltip }: any) => {
  if (!showTooltip) return null; 
  if (active && payload && payload.length) {
    return (
      // pointer-events-none je KRITICKÉ, aby tooltip neukradol focus myši a nerozbil synchronizáciu
      <div className="pointer-events-none bg-[#121418]/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl text-xs z-50 min-w-[120px]">
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

  // FULL dáta
  const fullChartData = useMemo(() => formatDataForRecharts(streams, isRunSport), [streams, isRunSport]);
  
  const hasTime = fullChartData.length > 0;
  const hasHr = fullChartData.some((d) => d.hr != null);
  const hasAlt = fullChartData.some((d) => d.altitude != null);
  const hasPace = fullChartData.some((d) => d.pace != null);
  const hasPow = fullChartData.some((d) => d.power != null);
  const hasCad = fullChartData.some((d) => d.cadence != null);

  const [brushIdx, setBrushIdx] = useState({ start: 0, end: hasTime ? fullChartData.length - 1 : 0 });
  const [showTooltip, setShowTooltip] = useState(true);

  useEffect(() => {
    setBrushIdx({ start: 0, end: fullChartData.length > 0 ? fullChartData.length - 1 : 0 });
  }, [fullChartData.length]);

  const handleBrushChange = (e: any) => {
    if (e && e.startIndex !== undefined && e.endIndex !== undefined) {
      setBrushIdx({ start: e.startIndex, end: e.endIndex });
    }
  };

  // OREZANÉ dáta len pre zobrazený výrez
  const visibleData = useMemo(() => {
    return fullChartData.slice(brushIdx.start, brushIdx.end + 1);
  }, [fullChartData, brushIdx]);

  const getDynamicDomain = (key: string, padBot: number, padTop: number, ignoreZero = true) => {
    if (!visibleData || visibleData.length === 0) return ["auto", "auto"];
    let vals = visibleData.map(d => d[key as keyof typeof d]).filter(v => v != null) as number[];
    if (ignoreZero) vals = vals.filter(v => v > 0);
    if (!vals.length) return ["auto", "auto"];
    
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [Math.max(0, Math.floor(min) - padBot), Math.ceil(max) + padTop];
  };

  if (!hasTime) {
    return <div className="opacity-70 text-sm">{t("sessions.charts.stream.unavailable" as any)}</div>;
  }

  const formatPace = (v: number) => formatCompactTime(Math.round(v));
  const syncId = "globalStreamSync"; 
  const chartHeight = compact ? 120 : 160;
  const mainMargins = { top: 5, right: 10, left: 0, bottom: 5 };
  const tooltipCursor = showTooltip ? { stroke: "rgba(255,255,255,0.2)", strokeWidth: 1, strokeDasharray: "4 4" } : false;

  const renderMiniMapZoom = (key: string) => (
    <div key={key} className="my-2">
      <div className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-40 pl-6">
        Zoom / Výrez
      </div>
      <div style={{ height: 40, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={fullChartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <Line type="monotone" dataKey={hasHr ? "hr" : "altitude"} stroke="rgba(255,255,255,0.15)" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Brush 
              dataKey="time" 
              height={30} 
              stroke={CHART_HR.axisText} 
              fill="rgba(0,0,0,0.4)" 
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
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.hrFull" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          {/* Pridané syncMethod="value" pre 100% zhodu kurzoru */}
          <ComposedChart data={visibleData} syncId={syncId} syncMethod="value" margin={mainMargins}>
            <defs>
              <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z4} stopOpacity={0.5} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            {/* Pridané type="number" a scale="time" */}
            <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("hr", 5, 5, true)} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickCount={4} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip showTooltip={showTooltip} formatY={(v: number) => `${Math.round(v)} ${t("common.units.hr")}`} />} cursor={tooltipCursor} isAnimationActive={false} />
            <Area type="monotone" dataKey="hr" connectNulls={true} name={t("common.units.hr")} stroke={CHART_HR.colors.z4} fill="url(#colorHr)" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderElevationChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.elevation" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <ComposedChart data={visibleData} syncId={syncId} syncMethod="value" margin={mainMargins}>
            <defs>
              <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z2} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("altitude", 5, 10, true)} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickCount={4} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip showTooltip={showTooltip} formatY={(v: number) => `${Math.round(v)} ${t("common.units.m")}`} />} cursor={tooltipCursor} isAnimationActive={false} />
            <Area type="monotone" dataKey="altitude" connectNulls={true} name={t("common.units.m")} stroke={CHART_HR.colors.z2} fill="url(#colorAlt)" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPaceChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.pace" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <ComposedChart data={visibleData} syncId={syncId} syncMethod="value" margin={mainMargins}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} dy={5} />
            <YAxis reversed domain={getDynamicDomain("pace", 10, 10, true)} tickFormatter={formatPace} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickCount={4} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip showTooltip={showTooltip} formatY={formatPace} />} cursor={tooltipCursor} isAnimationActive={false} />
            <Line type="monotone" dataKey="pace" connectNulls={true} name={t("common.units.pace")} stroke={CHART_HR.colors.z1} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPowerChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.power" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <ComposedChart data={visibleData} syncId={syncId} syncMethod="value" margin={mainMargins}>
            <defs>
              <linearGradient id="colorPow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z3} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_HR.colors.z3} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("power", 10, 10, false)} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickCount={4} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip showTooltip={showTooltip} formatY={(v: number) => `${Math.round(v)} W`} />} cursor={tooltipCursor} isAnimationActive={false} />
            <Area type="monotone" dataKey="power" connectNulls={true} name={t("common.units.power")} stroke={CHART_HR.colors.z3} fill="url(#colorPow)" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderCadenceChart = () => (
    <div className="mb-6">
      <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-50 mb-2 pl-6">{t("sessions.charts.metrics.cadence" as any)}</h4>
      <div style={{ height: chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <ComposedChart data={visibleData} syncId={syncId} syncMethod="value" margin={mainMargins}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} hide={false} tickFormatter={formatCompactTime} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} dy={5} />
            <YAxis domain={getDynamicDomain("cadence", 5, 5, true)} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickCount={3} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip showTooltip={showTooltip} formatY={(v: number) => Math.round(v)} />} cursor={tooltipCursor} isAnimationActive={false} />
            <Line type="step" dataKey="cadence" connectNulls={true} name={isRunSport ? t("common.units.kadenceRun") : t("common.units.kadenceBike")} stroke={CHART_HR.colors.z5} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </ComposedChart>
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
      <div className="flex justify-end mb-4 pr-4">
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
      <div className="mt-6">{activeCharts.map(chart => <div key={chart.key}>{chart.render()}</div>)}</div>
      {activeCharts.length > 1 && renderMiniMapZoom("bottom-brush")}
    </div>
  );
}
