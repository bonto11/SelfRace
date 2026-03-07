// src/features/performance/components/TrendZonesHR.tsx
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-3 rounded-xl border shadow-xl backdrop-blur-md"
        style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}
      >
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        {[...payload].reverse().map((entry: any, index: number) => {
          if (!entry.value) return null;
          return (
            <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="opacity-90">{entry.name}:</span>
              <span className="font-bold">{Math.round(entry.value)} bpm</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function TrendZonesHR() {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const [weeks, setWeeks] = React.useState<number>(4);

  const { zoneTrends } = data;
  const lookbackDays = weeks * 7;
  const DAY = 24 * 3600 * 1000;

  const validRows = zoneTrends.filter(r => r.created_at);
  const daysSet = new Set<string>();
  validRows.forEach(r => daysSet.add(r.created_at!.slice(0, 10)));
  let allDays = Array.from(daysSet).sort();

  if (allDays.length === 1) {
    const last = new Date(allDays[0]);
    const first = new Date(last.getTime() - (lookbackDays - 1) * DAY);
    allDays = Array.from({ length: lookbackDays }, (_, i) => new Date(first.getTime() + i * DAY).toISOString().slice(0, 10));
  } else if (allDays.length > lookbackDays) {
    allDays = allDays.slice(-lookbackDays);
  }

  const rowMap = new Map<string, any>();
  validRows.forEach(r => rowMap.set(r.created_at!.slice(0, 10), r));

  const chartData = allDays.map((dISO) => {
    const r = rowMap.get(dISO);
    return {
      label: new Date(dISO).toLocaleDateString("sk-SK"),
      z1: r?.z1_max ?? null,
      z2: r?.z2_max ?? null,
      z3: r?.z3_max ?? null,
      z4: r?.z4_max ?? null,
      z5: r?.z5_min ?? null, // Spodná hranica Z5
    };
  });

  if (!chartData.length && !loading) {
    return (
      <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, "text-sm text-center opacity-50"].join(" ")}>{t("common.noData")}</div>
      </div>
    );
  }

  const c = CHART_HR.colors;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_CARD_TITLE}>{t("zonesHR.title")}</h2>
          <div className={["ml-auto", PANEL_ACTIONS_INLINE].join(" ")}>
            <SelectField
              value={String(weeks)}
              onChange={(e) => setWeeks(Number(e.target.value))}
              options={WEEK_OPTIONS(t)}
              containerClassName="w-[132px]"
              variant="editable"
              placeholder="—"
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
            <YAxis tick={{ fill: appColors.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: appColors.textMuted, strokeDasharray: "5 5" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
            
            <Line type="monotone" dataKey="z5" name="Z5 LTHR" stroke={c.z5} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls />
            <Line type="monotone" dataKey="z4" name="Z4 Max" stroke={c.z4} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="z3" name="Z3 Max" stroke={c.z3} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="z2" name="Z2 Max" stroke={c.z2} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="z1" name="Z1 Max" stroke={c.z1} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}