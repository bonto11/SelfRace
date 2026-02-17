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
  ReferenceArea,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";

import type {
  StaticProfile,
  MetricHistoryRow,
} from "@/app/features/profile/types/profile";
import { apiGetStaticProfile } from "@/app/features/profile/api/static";
import { apiGetMetricHistory } from "@/app/features/profile/api/metrics";
import {
  colorForBodyFatBand,
  hexWithAlpha,
} from "@/app/features/profile/utils/profile";

import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
  PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

// Náš prémiový tooltip prispôsobený tvojej natur téme
const CustomTooltip = ({ active, payload, label, t }: any) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="p-3 rounded-xl border shadow-xl backdrop-blur-md"
        style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}
      >
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        {payload.map((entry: any, index: number) => {
          if (!entry.value) return null;
          return (
            <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="opacity-90">{entry.name}:</span>
              <span className="font-bold">{Number(entry.value).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function TrendBodyFat() {
  const { userId } = useUserId() as { userId: number | null };
  const t = useT(); 

  const [loading, setLoading] = React.useState(false);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [hist, setHist] = React.useState<MetricHistoryRow[]>([]);
  const [weeks, setWeeks] = React.useState<number>(4);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [s, m] = await Promise.all([
          apiGetStaticProfile(userId).catch(() => null),
          apiGetMetricHistory(userId, "body_fat_pct").catch(() => null),
        ]);
        if (!alive) return;
        if (s) setStat(s);
        setHist(m ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId]);

  const lookbackDays = weeks * 7;
  const cutoffISO = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);

  const samples = (hist || [])
    .map((r) => ({
      dISO: (r.measured_at || "").slice(0, 10),
      v: typeof r.value_num === "number" ? r.value_num : NaN,
    }))
    .filter((x) => !!x.dISO && Number.isFinite(x.v))
    .sort((a, b) => (a.dISO < b.dISO ? -1 : a.dISO > b.dISO ? 1 : 0))
    .filter((x) => x.dISO >= cutoffISO || true);

  if (samples.length === 0) {
    return (
      <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, "text-sm"].join(" ")}>
          {t("bodyFat.noData")}
        </div>
      </div>
    );
  }

  let points = [...samples];
  if (samples.length === 1) {
    const todayISO = new Date().toISOString().slice(0, 10);
    if (todayISO !== samples[0].dISO) {
      points = [samples[0], { dISO: todayISO, v: samples[0].v }];
    }
  }

  const chartData = points.map((p) => ({
    label: new Date(p.dISO).toLocaleDateString("sk-SK"),
    dISO: p.dISO,
    value: p.v,
  }));

  const values = points.map((p) => p.v);
  const seriesMax = Math.max(0, ...((values.filter(Number.isFinite) as number[]) || [0]));
  const suggestedTop = Math.max(35, Math.ceil(seriesMax + 1));
  const bands = stat ? getBodyFatBands(stat.sex ?? null) : [];

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        
        {/* Hlavička responzívna */}
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_CARD_TITLE}>{t("bodyFat.detailTitle")}</h2>
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
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}
        
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {/* Vykreslenie pásov (Bands) na pozadie */}
            {bands.map((b, i) => {
              // Zabezpečíme, že to budú vždy čísla
              const prevMax = i === 0 ? 0 : (bands[i-1].max ?? 0);
              const currentMax = b.max ?? suggestedTop;

              const y1 = Math.max(0, prevMax);
              const y2 = Math.min(suggestedTop, currentMax);
              
              return (
                <ReferenceArea 
                  key={b.label} 
                  y1={y1} 
                  y2={y2} 
                  fill={hexWithAlpha(colorForBodyFatBand(b.label || ""), 0.1)} 
                  fillOpacity={1} 
                  strokeOpacity={0} 
                />
              );
            })}

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
            
            <XAxis 
              dataKey="label" 
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
              dy={10}
              minTickGap={20}
            />
            
            <YAxis 
              domain={[0, suggestedTop]} // Zafixujeme os aby sa nemenila
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false}
              tickFormatter={(val) => `${val}%`}
            />
            
            <Tooltip content={<CustomTooltip t={t} />} cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }} />
            
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            
            <Line 
              type="monotone" 
              dataKey="value" 
              name={t("bodyFat.title")} 
              stroke={appColors.chartLine1} 
              strokeWidth={3}
              dot={{ r: 3, fill: appColors.chartLine1, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}