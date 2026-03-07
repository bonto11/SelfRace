// src/features/performance/components/TrendZonesPaces.tsx
"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import SelectField from "@/app/shared/ui/components/SelectField";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
  PANEL_ACTIONS_INLINE,
  CHART_HR,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

const formatPace = (sec: number) => {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-xl border shadow-xl backdrop-blur-md" style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}>
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        {[...payload].reverse().map((entry: any, index: number) => {
          if (!entry.value) return null;
          return (
            <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="opacity-90">{entry.name}:</span>
              <span className="font-bold">{formatPace(entry.value)} /km</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function TrendZonesPaces() {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const [weeks, setWeeks] = React.useState<number>(4);

  const { paceTrends } = data;
  const lookbackDays = weeks * 7;
  const DAY = 24 * 3600 * 1000;

  const validRows = paceTrends.filter(r => r.measured_at);
  const daysSet = new Set<string>();
  validRows.forEach(r => daysSet.add(r.measured_at.slice(0, 10)));
  let allDays = Array.from(daysSet).sort();

  if (allDays.length === 1) {
    const last = new Date(allDays[0]);
    const first = new Date(last.getTime() - (lookbackDays - 1) * DAY);
    allDays = Array.from({ length: lookbackDays }, (_, i) => new Date(first.getTime() + i * DAY).toISOString().slice(0, 10));
  } else if (allDays.length > lookbackDays) {
    allDays = allDays.slice(-lookbackDays);
  }

  const rowMap = new Map<string, any>();
  validRows.forEach(r => rowMap.set(r.measured_at.slice(0, 10), r));

  const chartData = allDays.map((dISO) => {
    const r = rowMap.get(dISO);
    return {
      label: new Date(dISO).toLocaleDateString("sk-SK"),
      z1: r?.z1_pace_s ?? null,
      z2: r?.z2_pace_s ?? null,
      z3: r?.z3_pace_s ?? null,
      z4: r?.z4_pace_s ?? null,
      z5: r?.z5_pace_s ?? null,
    };
  });

  const c = CHART_HR.colors;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_CARD_TITLE}>{t("zonesPaces.title")}</h2>
          <div className={["ml-auto", PANEL_ACTIONS_INLINE].join(" ")}>
            <SelectField
              value={String(weeks)}
              onChange={(e) => setWeeks(Number(e.target.value))}
              options={WEEK_OPTIONS(t)}
              containerClassName="w-[132px]"
              variant="editable"
            />
          </div>
        </div>
      </div>

      <div className="w-full relative px-2 sm:px-4 pb-4" style={{ height: 360 }}>
        {loading && chartData.length === 0 && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
            <XAxis dataKey="label" tick={{ fill: appColors.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} dy={10} minTickGap={20} />
            {/* reversed = true, aby rýchlejšie tempo (menej sekúnd) bolo HORE */}
            <YAxis reversed tickFormatter={formatPace} tick={{ fill: appColors.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 15', 'dataMax + 15']} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: appColors.textMuted, strokeDasharray: "5 5" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
            
            <Line type="monotone" dataKey="z5" name="Z5 Pace" stroke={c.z5} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls />
            <Line type="monotone" dataKey="z4" name="Z4 Pace" stroke={c.z4} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="z3" name="Z3 Pace" stroke={c.z3} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="z2" name="Z2 Pace" stroke={c.z2} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="z1" name="Z1 Pace" stroke={c.z1} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}