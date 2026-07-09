"use client";

import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceArea,
} from "recharts";

import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";
import { colorForBodyFatBand, hexWithAlpha } from "@/app/features/performance/utils/performance";
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
          <span className="font-bold">{Number(entry.value).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

// Jemný popisok bandu — vpravo hore v páse, malé a poloпriehľadné
const BandLabel = ({ viewBox, text, color }: any) => {
  if (!viewBox) return null;
  const { x, y, width, height } = viewBox;
  if (height < 14) return null; // pás je príliš úzky na text
  return (
    <text
      x={x + width - 6}
      y={y + height / 2}
      textAnchor="end"
      dominantBaseline="middle"
      fontSize={10}
      fontWeight={600}
      fill={color}
      opacity={0.75}
    >
      {text}
    </text>
  );
};

export default function TrendBodyFat() {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const [weeks, setWeeks] = React.useState<number>(4);

  const chartData = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);
    
    // 1. Získame všetky dáta a zotriedime ich chronologicky
    const raw = [...(data.bodyFatTrend || [])]
      .filter(r => r.measured_at)
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());

    // 2. Najprv vyberieme len tie, čo patria do nášho časového okna
    let filtered = raw
      .filter(r => new Date(r.measured_at) >= cutoff)
      .map(r => ({
        label: new Date(r.measured_at).toLocaleDateString("sk-SK"),
        value: r.value_num,
      }));

    // 3. SMART FALLBACK: Ak okno zíva prázdnotou, ale niekedy v minulosti sme mali záznam
    if (filtered.length === 0 && raw.length > 0) {
      const lastVal = raw[raw.length - 1].value_num; // Zoberieme poslednú známu hodnotu
      filtered = [
        { label: new Date(cutoff).toLocaleDateString("sk-SK"), value: lastVal },
        { label: new Date().toLocaleDateString("sk-SK"), value: lastVal }
      ];
    } 
    // 4. Ak máme len 1 bod (či už z okna, alebo celkovo), Recharts nespraví čiaru, ale len bodku.
    // Takže hodnotu potiahneme až do dneška, aby sa vytvorila rovná trendová línia.
    else if (filtered.length === 1) {
      const todayStr = new Date().toLocaleDateString("sk-SK");
      if (filtered[0].label !== todayStr) {
        filtered.push({ label: todayStr, value: filtered[0].value });
      } else {
        // Ak ten jeden záznam je náhodou z dneška, natiahneme čiaru od cutoffu
        filtered.unshift({ label: new Date(cutoff).toLocaleDateString("sk-SK"), value: filtered[0].value });
      }
    }

    return filtered;
  }, [data.bodyFatTrend, weeks]);

  const sex = data.bodyFatLatest?.sex || "M";
  const bands = getBodyFatBands(sex);
  const suggestedTop = Math.max(35, Math.ceil(Math.max(0, ...chartData.map(d => d.value)) + 2));

  return (
    <div className={`${CARD} relative overflow-hidden`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_CARD_TITLE}>{t("bodyFat.detailTitle")}</h2>
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
          <div className="h-full grid place-items-center opacity-40 text-sm">{t("bodyFat.noData")}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              {bands.map((b, i) => {
                const color = colorForBodyFatBand(b.label || "");
                return (
                  <ReferenceArea
                    key={b.label}
                    y1={Math.max(0, i === 0 ? 0 : (bands[i - 1].max ?? 0))}
                    y2={Math.min(suggestedTop, b.max ?? suggestedTop)}
                    fill={hexWithAlpha(color, 0.1)}
                    fillOpacity={1}
                    strokeOpacity={0}
                    label={<BandLabel text={b.label} color={color} />}
                  />
                );
              })}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
              <XAxis dataKey="label" tick={{ fill: appColors.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} dy={10} minTickGap={20} />
              <YAxis domain={[0, suggestedTop]} tick={{ fill: appColors.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
              <Line type="monotone" dataKey="value" name={t("bodyFat.title")} stroke={appColors.chartLine1} strokeWidth={3} dot={{ r: 3, fill: appColors.chartLine1, strokeWidth: 0 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
