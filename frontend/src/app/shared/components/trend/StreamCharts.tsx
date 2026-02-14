// src/app/shared/components/trend/StreamCharts.tsx
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

// --- Vlastný Tooltip pre profesionálny look ---
const CustomTooltip = ({ active, payload, label, formatY }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e2329]/95 backdrop-blur-sm border border-white/10 p-3 rounded-md shadow-2xl text-xs z-50">
        <p className="font-bold text-white/90 mb-1.5 pb-1.5 border-b border-white/10">
          {fmtSecondsHMS(label)}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="opacity-70" style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-mono font-semibold text-white">
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
  const [isOpen, setIsOpen] = useState(true); // defaultne otvorené

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
    return <div className="opacity-70 text-sm px-4">{t("charts.stream.unavailable" as any)}</div>;
  }

  const formatPace = (v: number) => fmtSecondsHMS(Math.round(v));
  const syncId = "streamSyncId"; 
  const chartHeight = compact ? 120 : 180;

  // --- Vykreslovače jednotlivých grafov ---

  const renderHrChart = (includeBrush = false) => (
    <div className="mb-6">
      <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">{t("charts.metrics.hrFull" as any)}</h4>
      <div style={{ height: includeBrush ? chartHeight + 40 : chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 0, left: -20, bottom: includeBrush ? 0 : 5 }}>
            <defs>
              <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z4} stopOpacity={0.6} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={!includeBrush} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} />
            <YAxis domain={["dataMin - 10", "dataMax + 10"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => `${Math.round(v)} bpm`} />} cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area type="monotone" dataKey="hr" name={t("common.units.hr")} stroke={CHART_HR.colors.z4} fill="url(#colorHr)" isAnimationActive={false} />
            {includeBrush && <Brush dataKey="time" height={30} stroke={CHART_HR.axisText} fill="rgba(255,255,255,0.05)" tickFormatter={fmtSecondsHMS} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderElevationChart = (includeBrush = false) => (
    <div className="mb-6">
      <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">{t("charts.metrics.elevation" as any)}</h4>
      <div style={{ height: includeBrush ? chartHeight + 40 : chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 0, left: -20, bottom: includeBrush ? 0 : 5 }}>
            <defs>
              <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z2} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_HR.colors.z2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={!includeBrush} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} />
            <YAxis domain={["dataMin", "dataMax + 20"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => `${Math.round(v)} m`} />} cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area type="monotone" dataKey="altitude" name={t("common.units.m")} stroke={CHART_HR.colors.z2} fill="url(#colorAlt)" isAnimationActive={false} />
            {includeBrush && <Brush dataKey="time" height={30} stroke={CHART_HR.axisText} fill="rgba(255,255,255,0.05)" tickFormatter={fmtSecondsHMS} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPaceChart = (includeBrush = false) => (
    <div className="mb-6">
      <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">{t("charts.metrics.pace" as any)}</h4>
      <div style={{ height: includeBrush ? chartHeight + 40 : chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 5, right: 0, left: -20, bottom: includeBrush ? 0 : 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={!includeBrush} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} />
            {/* Pace je obrátený: nižší čas = lepšie/vyššie na grafe */}
            <YAxis reversed domain={["dataMin", "dataMax"]} tickFormatter={formatPace} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={formatPace} />} cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line type="monotone" dataKey="pace" name={t("common.units.pace")} stroke={CHART_HR.colors.z1} dot={false} strokeWidth={2} isAnimationActive={false} />
            {includeBrush && <Brush dataKey="time" height={30} stroke={CHART_HR.axisText} fill="rgba(255,255,255,0.05)" tickFormatter={fmtSecondsHMS} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPowerChart = (includeBrush = false) => (
    <div className="mb-6">
      <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">{t("charts.metrics.power" as any)}</h4>
      <div style={{ height: includeBrush ? chartHeight + 40 : chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} syncId={syncId} margin={{ top: 5, right: 0, left: -20, bottom: includeBrush ? 0 : 5 }}>
            <defs>
              <linearGradient id="colorPow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_HR.colors.z3} stopOpacity={0.6} />
                <stop offset="95%" stopColor={CHART_HR.colors.z3} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={!includeBrush} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} />
            <YAxis domain={["dataMin", "dataMax + 20"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={4} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => `${Math.round(v)} W`} />} cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area type="monotone" dataKey="power" name={t("common.units.power")} stroke={CHART_HR.colors.z3} fill="url(#colorPow)" isAnimationActive={false} />
            {includeBrush && <Brush dataKey="time" height={30} stroke={CHART_HR.axisText} fill="rgba(255,255,255,0.05)" tickFormatter={fmtSecondsHMS} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderCadenceChart = (includeBrush = false) => (
    <div className="mb-6">
      <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">{t("charts.metrics.cadence" as any)}</h4>
      <div style={{ height: includeBrush ? chartHeight + 40 : chartHeight, width: "100%" }}>
        <ResponsiveContainer>
          <LineChart data={chartData} syncId={syncId} margin={{ top: 5, right: 0, left: -20, bottom: includeBrush ? 0 : 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_HR.grid} vertical={false} />
            <XAxis dataKey="time" hide={!includeBrush} tickFormatter={fmtSecondsHMS} tick={{ fontSize: 10, fill: CHART_HR.tickText }} />
            <YAxis domain={["dataMin - 10", "dataMax + 10"]} tick={{ fontSize: 10, fill: CHART_HR.tickText }} tickCount={3} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip formatY={(v: number) => Math.round(v)} />} cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line type="step" dataKey="cadence" name={isRunSport ? t("common.units.kadenceRun") : t("common.units.kadenceBike")} stroke={CHART_HR.colors.z5} dot={false} strokeWidth={1.5} isAnimationActive={false} />
            {includeBrush && <Brush dataKey="time" height={30} stroke={CHART_HR.axisText} fill="rgba(255,255,255,0.05)" tickFormatter={fmtSecondsHMS} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Zistíme, ktorý graf je posledný, aby dostal `<Brush>` (Slider)
  const activeCharts = [
    { key: "hr", active: hasHr, render: renderHrChart },
    { key: "pace", active: hasPace, render: renderPaceChart },
    { key: "power", active: hasPow, render: renderPowerChart },
    { key: "elevation", active: hasAlt, render: renderElevationChart },
    { key: "cadence", active: hasCad, render: renderCadenceChart },
  ].filter(c => c.active);

  return (
    <div className="mt-4 border border-white/5 rounded-2xl bg-black/20 overflow-hidden">
      <div className={FLUSH_DETAIL_PB}>
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex flex-col">
            <span className="text-base font-semibold">{t("sessions.charts.stream.title" as any)}</span>
            <span className="text-xs opacity-60">Pohybom myši prepojíte grafy. Výrezom v spodnom grafe priblížite úsek.</span>
          </div>
          <DisclosureToggle
            open={isOpen}
            onToggle={() => setIsOpen((v) => !v)}
            labelWhenOpen={t("charts.stream.hide" as any)}
            labelWhenClosed={t("charts.stream.show" as any)}
          />
        </div>

        {isOpen && (
          <div className="p-4 w-full">
            {activeCharts.map((chart, idx) => {
              const isLast = idx === activeCharts.length - 1;
              return <div key={chart.key}>{chart.render(isLast)}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
