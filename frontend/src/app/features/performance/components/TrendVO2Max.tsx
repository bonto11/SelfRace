"use client";

import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceArea,
} from "recharts";

import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";
import type { Group } from "@/app/features/performance/types/performance";
import { colorForVo2RangeLabel, hexWithAlpha } from "@/app/features/performance/utils/performance";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  CARD, SURFACE_CARD_STYLE, PANEL_PAD, PANEL_INNER_STACK,
  PANEL_CARD_HEAD, PANEL_CARD_TITLE, PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 rounded-xl border shadow-xl backdrop-blur-md" style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}>
      <p className="mb-2 text-xs font-semibold text-white/50">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
          <span className="opacity-90">{entry.name}:</span>
          <span className="font-bold">{Number(entry.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function TrendVO2Max() {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const [weeks, setWeeks] = React.useState<number>(4);

  const chartData = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);
    
    const estMap = new Map();
    (data.vo2EstimatedTrend || []).forEach(r => {
      const d = r.measured_at.slice(0, 10);
      if (new Date(d) >= cutoff) estMap.set(d, r.value_num);
    });

    const measMap = new Map();
    (data.vo2MeasuredTrend || []).forEach(r => {
      const d = r.measured_at.slice(0, 10);
      if (new Date(d) >= cutoff) measMap.set(d, r.value_num);
    });

    const allDays = Array.from(new Set([...Array.from(estMap.keys()), ...Array.from(measMap.keys())])).sort();
    
    return allDays.map(dISO => ({
      label: new Date(dISO).toLocaleDateString("sk-SK"),
      est: estMap.get(dISO) ?? null,
      meas: measMap.get(dISO) ?? null,
    }));
  }, [data.vo2EstimatedTrend, data.vo2MeasuredTrend, weeks]);

  const latest = data.vo2MeasuredLatest || data.vo2EstimatedLatest;
  const sex = latest?.sex || "M";
  const age = latest?.birth_date ? Math.floor((Date.now() - new Date(latest.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : 30;

  const group = (vo2Ref as Group[]).find(g => g.sex === sex && age >= g.age_min && age <= g.age_max);
  const ranges = group?.ranges?.map(r => ({ ...r, color: colorForVo2RangeLabel(r.label) })) ?? [];

  const allVals = chartData.flatMap(d => [d.est, d.meas].filter(v => v !== null)) as number[];
  const yMin = Math.max(10, Math.floor((Math.min(...allVals, 35) - 3) / 5) * 5);
  const yMax = Math.max(60, Math.ceil((Math.max(...allVals, 55) + 3) / 5) * 5);

  return (
    <div className={`${CARD} relative overflow-hidden`} style={SURFACE_CARD_STYLE}>
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
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 backdrop-blur-sm">
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
                  fill={hexWithAlpha(r.color, 0.1)}
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
