// src/app/features/performance/components/TrendBodyWeight.tsx
"use client";

import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";

import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";
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
          <span className="font-bold">{Number(entry.value).toFixed(1)} kg</span>
        </div>
      ))}
    </div>
  );
};

export default function TrendBodyWeight() {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const [weeks, setWeeks] = React.useState<number>(8); // Predvolene 8 týždňov pre váhu

  const chartData = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);
    
    const raw = [...(data.bodyWeightTrend || [])]
      .filter(r => r.measured_at)
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());

    let filtered = raw
      .filter(r => new Date(r.measured_at) >= cutoff)
      .map(r => ({
        label: new Date(r.measured_at).toLocaleDateString("sk-SK"),
        value: r.value_num,
      }));

    // Fallback ak v danom okne nič nie je
    if (filtered.length === 0 && raw.length > 0) {
      const lastVal = raw[raw.length - 1].value_num;
      filtered = [
        { label: new Date(cutoff).toLocaleDateString("sk-SK"), value: lastVal },
        { label: new Date().toLocaleDateString("sk-SK"), value: lastVal }
      ];
    } 
    // Natiahnutie čiary ak máme len jeden bod
    else if (filtered.length === 1) {
      const todayStr = new Date().toLocaleDateString("sk-SK");
      if (filtered[0].label !== todayStr) {
        filtered.push({ label: todayStr, value: filtered[0].value });
      } else {
        filtered.unshift({ label: new Date(cutoff).toLocaleDateString("sk-SK"), value: filtered[0].value });
      }
    }

    return filtered;
  }, [data.bodyWeightTrend, weeks]);

  // Výpočet dynamického rozsahu (padding pre os Y)
  const minWeight = Math.min(...chartData.map(d => d.value));
  const maxWeight = Math.max(...chartData.map(d => d.value));
  const domainMin = Math.floor(minWeight - 2);
  const domainMax = Math.ceil(maxWeight + 2);

  return (
    <div className={`${CARD} relative overflow-hidden`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_CARD_TITLE}>{t("performance.metrics.weightLabel")}</h2>
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
          <div className="h-full grid place-items-center opacity-40 text-sm">
            {t("common.noData")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
              <XAxis 
                dataKey="label" 
                tick={{ fill: appColors.textMuted, fontSize: 10 }} 
                axisLine={false} 
                tickLine={false} 
                dy={10} 
                minTickGap={30} 
              />
              <YAxis 
                domain={[domainMin, domainMax]} 
                tick={{ fill: appColors.textMuted, fontSize: 10 }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(v) => `${v}kg`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "15px" }} />
              <Line 
                type="monotone" 
                dataKey="value" 
                name={t("performance.metrics.weightLabel")} 
                stroke={appColors.chartLine1} 
                strokeWidth={3} 
                dot={{ r: 4, fill: appColors.chartLine1, strokeWidth: 0 }} 
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls 
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
