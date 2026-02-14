// src/app/shared/components/session/ActivityStreamCharts.tsx
"use client";

import { useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { CHART_HR, FLUSH_DETAIL_PB } from "@/app/shared/ui/tokens";
import type { StreamsData } from "@/app/features/activities/types/activities";
import DisclosureToggle from "@/app/shared/ui/components/DisclosureToggle";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Brush,
  LineChart,
  Line
} from "recharts";

export type StreamMetric = "hr" | "elevation" | "power" | "pace" | "cadence";

type ActivityStreamChartsProps = {
  streams: StreamsData;
  compact?: boolean;
  metric?: StreamMetric;
  sportHint?: string | null;
};

// --- Helpers ---

/** Transforms arrays of raw data into an array of objects for Recharts */
function formatDataForRecharts(streams: StreamsData, isRunSport: boolean) {
  const { time_s, hr, altitude_m, distance_m, cadence_rpm, power_w } = streams;
  if (!time_s || time_s.length === 0) return [];

  // Calculate Pace
  const pace = time_s.map((t, i) => {
    if (i === 0 || !distance_m || distance_m[i] == null || distance_m[i - 1] == null) return null;
    const dt = t - time_s[i - 1];
    const dd = distance_m[i]! - distance_m[i - 1]!;
    if (dt <= 0 || dd <= 0.5) return null;
    const p = dt / (dd / 1000);
    return Number.isFinite(p) && p > 0 ? p : null;
  });

  return time_s.map((t, i) => ({
    time: t,
    hr: hr?.[i] ?? null,
    altitude: altitude_m?.[i] ?? null,
    pace: pace[i],
    power: power_w?.[i] ?? null,
    cadence: cadence_rpm?.[i] != null ? (isRunSport ? cadence_rpm[i]! * 2 : cadence_rpm[i]) : null,
  }));
}

// Custom Tooltip component for a cleaner look
const CustomTooltip = ({ active, payload, label, t, formatY }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e2329] border border-white/10 p-3 rounded-md shadow-xl text-xs">
        <p className="font-semibold text-white/90 mb-1">{fmtSecondsHMS(label)}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="opacity-80">{entry.name}:</span>
            <span className="font-medium">{formatY ? formatY(entry.value) : Math.round(entry.value)}</span>
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
  metric,
  sportHint,
}: ActivityStreamChartsProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);

  const isRunSport = useMemo(() => {
    if (!sportHint) return false;
    const s = sportHint.toLowerCase();
    return s.includes("run") || s.includes("trail");
  }, [sportHint]);

  const chartData = useMemo(() => formatDataForRecharts(streams, isRunSport), [streams, isRunSport]);
  
  const hasTime = chartData.length > 0;
  const hasHr = chartData.some(d => d.hr != null);
  const hasAlt = chartData.some(d => d.altitude != null);
  const hasPace = chartData.some(d => d.pace != null);
  const hasPow = chartData.some(d => d.power != null);
  const hasCad = chartData.some(d => d.cadence != null);

  if (!hasTime) {
    return <div className="opacity-70 text-sm">{t("sessions.charts.stream.unavailable")}</div>;
  }

  const formatPace = (v: number) => fmtSecondsHMS(Math.round(v));
  const syncId = "stream-charts-sync"; // Links tooltips and zooming across charts
  const chartHeight = compact ? 120 : 180;

  // --- Sub-components for specific metrics ---

  const renderHrChart = () => (
    <div className="mb-4">
      <h4 className="font-bold text-sm mb-1 px-4">{t("sessions.charts.metrics.hrFull")}</h4>
      <div style={{ height: chartHeight, width: '100%' }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
             <defs>
              <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z4} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis 
                domain={['dataMin - 10', 'dataMax + 10']} 
                tick={{fontSize: 10, fill: CHART_HR.tickText}} 
                tickCount={4}
                axisLine={false}
                tickLine={false}
                width={35}
            />
            <Tooltip content={<CustomTooltip t={t} />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
             {/* Example of adding zones - adjust Y values based on user's actual zones */}
             <ReferenceArea y1={CHART_HR.zoneCuts[3]} y2={CHART_HR.maxBpm} fill={CHART_HR.colors.z5} fillOpacity={0.05} />
             <ReferenceArea y1={CHART_HR.zoneCuts[2]} y2={CHART_HR.zoneCuts[3]} fill={CHART_HR.colors.z4} fillOpacity={0.05} />
             
            <Area type="monotone" dataKey="hr" name={t("common.units.hr")} stroke={CHART_HR.colors.z3} fillOpacity={1} fill="url(#colorHr)" isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderElevationChart = () => (
    <div className="mb-4">
      <h4 className="font-bold text-sm mb-1 px-4">{t("sessions.charts.metrics.elevation")}</h4>
      <div style={{ height: chartHeight, width: '100%' }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
             <defs>
              <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z2} stopOpacity={0.5}/>
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={['dataMin', 'dataMax + 10']} tick={{fontSize: 10, fill: CHART_HR.tickText}} tickCount={4} axisLine={false} tickLine={false} width={35}/>
            <Tooltip content={<CustomTooltip t={t} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
            <Area type="monotone" dataKey="altitude" name={t("common.units.m")} stroke={CHART_HR.colors.z2} fillOpacity={1} fill="url(#colorAlt)" isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPaceChart = () => (
    <div className="mb-4">
      <h4 className="font-bold text-sm mb-1 px-4">{t("sessions.charts.metrics.pace")}</h4>
      <div style={{ height: chartHeight, width: '100%' }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide />
            {/* Reversed domain for pace: faster pace (lower seconds) is higher on the chart */}
            <YAxis reversed domain={['dataMin', 'dataMax']} tickFormatter={formatPace} tick={{fontSize: 10, fill: CHART_HR.tickText}} tickCount={4} axisLine={false} tickLine={false} width={45}/>
            <Tooltip content={<CustomTooltip t={t} formatY={formatPace}/>} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
            <Line type="monotone" dataKey="pace" name={t("common.units.pace")} stroke={CHART_HR.colors.z1} dot={false} strokeWidth={2} isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

   const renderCadenceChart = (includeBrush = false) => (
    <div className="mb-4">
      <h4 className="font-bold text-sm mb-1 px-4">{t("sessions.charts.metrics.cadence")}</h4>
      <div style={{ height: includeBrush ? chartHeight + 40 : chartHeight, width: '100%' }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 5, right: 20, left: 0, bottom: includeBrush ? 0 : 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={!includeBrush} tickFormatter={(v) => fmtSecondsHMS(v)} tick={{fontSize: 10, fill: CHART_HR.tickText}} />
            <YAxis domain={['dataMin - 10', 'dataMax + 10']} tick={{fontSize: 10, fill: CHART_HR.tickText}} tickCount={3} axisLine={false} tickLine={false} width={35}/>
            <Tooltip content={<CustomTooltip t={t} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
            <Line type="step" dataKey="cadence" name={isRunSport ? t("common.units.kadenceRun") : t("common.units.kadenceBike")} stroke={CHART_HR.colors.z5} dot={false} strokeWidth={1} isAnimationActive={false}/>
             {/* The Brush handles zooming/panning across all synchronized charts */}
            {includeBrush && (
                <Brush dataKey="time" height={30} stroke={CHART_HR.axisText} fill="rgba(255,255,255,0.05)" tickFormatter={fmtSecondsHMS} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPowerChart = (includeBrush = false) => (
      <div className="mb-4">
        <h4 className="font-bold text-sm mb-1 px-4">{t("sessions.charts.metrics.power")}</h4>
        <div style={{ height: includeBrush ? chartHeight + 40 : chartHeight, width: '100%' }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 20, left: 0, bottom: includeBrush ? 0 : 5 }}>
                <defs>
                <linearGradient id="colorPow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_HR.colors.z4} stopOpacity={0.6}/>
                  <stop offset="95%" stopColor={CHART_HR.colors.z4} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
              <XAxis dataKey="time" hide={!includeBrush} tickFormatter={(v) => fmtSecondsHMS(v)} tick={{fontSize: 10, fill: CHART_HR.tickText}} />
              <YAxis domain={['dataMin', 'dataMax + 20']} tick={{fontSize: 10, fill: CHART_HR.tickText}} tickCount={4} axisLine={false} tickLine={false} width={35}/>
              <Tooltip content={<CustomTooltip t={t} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
              <Area type="monotone" dataKey="power" name={t("common.units.power")} stroke={CHART_HR.colors.z4} fillOpacity={1} fill="url(#colorPow)" isAnimationActive={false}/>
               {includeBrush && (
                  <Brush dataKey="time" height={30} stroke={CHART_HR.axisText} fill="rgba(255,255,255,0.05)" tickFormatter={fmtSecondsHMS} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );


  /** ====== Metric-specific mode ====== */
  if (metric) {
    if (metric === "hr") return hasHr ? renderHrChart() : <div className="opacity-70 text-sm px-4">{t("sessions.charts.stream.noHr")}</div>;
    if (metric === "elevation") return hasAlt ? renderElevationChart() : <div className="opacity-70 text-sm px-4">{t("sessions.charts.stream.noAlt")}</div>;
    if (metric === "pace") return hasPace ? renderPaceChart() : <div className="opacity-70 text-sm px-4">{t("sessions.charts.stream.noPace")}</div>;
    if (metric === "power") return hasPow ? renderPowerChart(true) : <div className="opacity-70 text-sm px-4">{t("sessions.charts.stream.noPower")}</div>;
    if (metric === "cadence") return hasCad ? renderCadenceChart(true) : <div className="opacity-70 text-sm px-4">{t("sessions.charts.stream.noCadence")}</div>;
    return null;
  }

  /** ====== All charts mode (Stacked & Synchronized) ====== */
  return (
    <div className="mt-3">
      <div className={FLUSH_DETAIL_PB}>
        <div className="flex items-center justify-between gap-3 mb-4 px-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{t("sessions.charts.stream.title")}</span>
            <span className="text-[11px] opacity-70">{t("sessions.charts.stream.subtitle")}</span>
          </div>
          <DisclosureToggle
            open={isOpen}
            onToggle={() => setIsOpen((v) => !v)}
            labelWhenOpen={t("sessions.charts.stream.hide")}
            labelWhenClosed={t("sessions.charts.stream.show")}
          />
        </div>

        {isOpen && (
          <div className="w-full">
            {/* Render all available charts vertically. 
              The 'syncId' connects their cursors and zooming.
              We only add the Brush (the zoom slider) to the very last chart rendered.
            */}
            {hasHr && renderHrChart()}
            {hasAlt && renderElevationChart()}
            {hasPace && renderPaceChart()}
            
            {/* Determine which chart gets the Brush tool */}
            {hasPow && !hasCad && renderPowerChart(true)}
            {hasPow && hasCad && renderPowerChart(false)}
            {hasCad && renderCadenceChart(true)}
          </div>
        )}
      </div>
    </div>
  );
}