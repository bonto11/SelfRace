"use client";

import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceArea,
} from "recharts";

import { usePerformanceData } from "@/app/features/performance/providers/PerformanceDataProvider";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";

import type { Group } from "@/app/features/performance/types/performance";
import { colorForVo2RangeLabel, hexWithAlpha } from "@/app/features/performance/utils/performance";

import {
  CARD, SURFACE_CARD_STYLE, PANEL_PAD, PANEL_INNER_STACK,
  PANEL_CARD_HEAD, PANEL_CARD_TITLE, PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-xl border shadow-xl backdrop-blur-md" style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}>
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="opacity-90">{entry.name}:</span>
            <span className="font-bold">{Number(entry.value).toFixed(1)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrendVO2Max() {
  const t = useT();
  const { data, loading } = usePerformanceData(); // ✅ Používame Provider
  const [weeks, setWeeks] = React.useState<number>(4);

  // Filtrovanie dát z Providera podľa zvolených týždňov
  const chartData = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);
    
    const estHist = data.vo2EstimatedTrend || [];
    const measHist = data.vo2MeasuredTrend || [];

    const estMap = new Map();
    estHist.forEach(r => {
      const d = r.measured_at.slice(0, 10);
      if (new Date(d) >= cutoff) estMap.set(d, r.value_num);
    });

    const measMap = new Map();
    measHist.forEach(r => {
      const d = r.measured_at.slice(0, 10);
      if (new Date(d) >= cutoff) measMap.set(d, r.value_num);
    });

    const allDays = Array.from(new Set([...Array.from(estMap.keys()), ...Array.from(measMap.keys())])).sort();
    
    return allDays.map(dISO => ({
      label: new Date(dISO).toLocaleDateString("sk-SK"),
      est: estMap.get(dISO) ?? null,
      meas: measMap.get(dISO) ?? null,
    }));
  }, [data, weeks]);

  // Statické údaje (pre farebné zóny) berieme z "latest" objektov v Provideri, kde sme si poslali sex/birth_date
  const sex = data.vo2MeasuredLatest?.sex || "M";
  const birthDate = data.vo2MeasuredLatest?.birth_date || "";
  const age = birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400 * 1000)) : 30;

  const group = (vo2Ref as Group[]).find(g => g.sex === sex && age >= g.age_min && age <= g.age_max);
  const ranges = group?.ranges?.map(r => ({ ...r, color: colorForVo2RangeLabel(r.label) })) ?? [];

  const allValues = chartData.flatMap(d => [d.est, d.meas].filter(v => v !== null)) as number[];
  const minValue = allValues.length ? Math.min(...allValues) : 35;
  const maxValue = allValues.length ? Math.max(...allValues) : 55;
  const yMin = Math.max(10, Math.floor((minValue - 3) / 5) * 5);
  const yMax = Math.max(60, Math.ceil((maxValue + 3) / 5) * 5);

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_CARD_TITLE}>{t("VO2Max.detailTitle")}</h2>
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
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}

        {chartData.length === 0 && !loading ? (
          <div className="h-full grid place-items-center opacity-40 text-sm">{t("VO2Max.noData")}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              {ranges.map((r, i) => (
                <ReferenceArea
                  key={r.label}
                  y1={Math.max(yMin, i === 0 ? yMin : (ranges[i - 1].max ?? yMin))}
                  y2={Math.min(yMax, r.max ?? yMax)}
                  fill={hexWithAlpha(r.color, 0.12)}
                  fillOpacity={1}
                  strokeOpacity={0}
                />
              ))}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
              <XAxis dataKey="label" tick={{ fill: appColors.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} dy={10} minTickGap={20} />
              <YAxis domain={[yMin, yMax]} tick={{ fill: appColors.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
              <Line type="monotone" dataKey="est" name={t("VO2Max.chart.estLabel") as string} stroke={appColors.chartLine1} strokeWidth={3} dot={{ r: 3, fill: appColors.chartLine1, strokeWidth: 0 }} connectNulls />
              <Line type="monotone" dataKey="meas" name={t("VO2Max.chart.measLabel") as string} stroke={appColors.chartLine2} strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: appColors.chartLine2, strokeWidth: 0 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
