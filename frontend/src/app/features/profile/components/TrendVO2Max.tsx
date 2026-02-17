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
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";

import type {
  StaticProfile,
  MetricHistoryRow,
  Group,
} from "@/app/features/profile/types/profile";
import { apiGetStaticProfile } from "@/app/features/profile/api/static";
import { apiGetMetricHistory } from "@/app/features/profile/api/metrics";
import {
  colorForVo2RangeLabel,
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

// Náš prémiový tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
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
              <span className="font-bold">{Number(entry.value).toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function TrendVO2Max() {
  const { userId } = useUserId() as { userId: number | null };
  const t = useT(); 

  const [loading, setLoading] = React.useState(false);
  const [weeks, setWeeks] = React.useState<number>(4);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [estHist, setEstHist] = React.useState<MetricHistoryRow[]>([]);
  const [measHist, setMeasHist] = React.useState<MetricHistoryRow[]>([]);

  const DAY = 24 * 3600 * 1000;

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [s, est, meas] = await Promise.all([
          apiGetStaticProfile(userId).catch(() => null),
          apiGetMetricHistory(userId, "VO2Max_estimated").catch(() => null),
          apiGetMetricHistory(userId, "VO2Max_measured").catch(() => null),
        ]);
        if (!alive) return;
        if (s) setStat(s);
        setEstHist(est ?? []);
        setMeasHist(meas ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId]);

  const lookbackDays = weeks * 7;

  const estDays = new Set<string>();
  for (const r of estHist) if (r?.measured_at) estDays.add(r.measured_at.slice(0, 10));

  const measDays = new Set<string>();
  for (const r of measHist) if (r?.measured_at) measDays.add(r.measured_at.slice(0, 10));

  let allDays = Array.from(new Set<string>([...estDays, ...measDays])).sort();

  if (allDays.length === 1) {
    const last = new Date(allDays[0]);
    const first = new Date(last.getTime() - (lookbackDays - 1) * DAY);
    allDays = Array.from({ length: lookbackDays }, (_, i) => {
      const d = new Date(first.getTime() + i * DAY);
      return d.toISOString().slice(0, 10);
    });
  } else if (allDays.length > lookbackDays) {
    allDays = allDays.slice(-lookbackDays);
  }

  if (!allDays.length) {
    return (
      <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, "text-sm"].join(" ")}>
          {t("VO2Max.noData")}
        </div>
      </div>
    );
  }

  const estMap = new Map<string, number>();
  for (const r of estHist)
    if (typeof r?.value_num === "number" && r?.measured_at)
      estMap.set(r.measured_at.slice(0, 10), r.value_num);

  const measMap = new Map<string, number>();
  for (const r of measHist)
    if (typeof r?.value_num === "number" && r?.measured_at)
      measMap.set(r.measured_at.slice(0, 10), r.value_num);

  // Formátovanie dát pre Recharts
  const chartData = allDays.map((dISO) => ({
    label: new Date(dISO).toLocaleDateString("sk-SK"),
    dISO: dISO,
    est: estMap.has(dISO) ? estMap.get(dISO) : null,
    meas: measMap.has(dISO) ? measMap.get(dISO) : null,
  }));

  const sex = stat?.sex === "F" ? "F" : "M";
  const birthDate = stat?.birth_date || "";
  const age = birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400 * 1000)) : 0;

  const group = (vo2Ref as Group[]).find(
    (g) => g.sex === sex && age >= g.age_min && age <= g.age_max,
  );

  const ranges = group?.ranges?.map((r) => ({
    ...r,
    color: colorForVo2RangeLabel(r.label),
  })) ?? [];

  // Vypočítame dynamické yMin a yMax aby graf nerezal zbytočne prázdno (Napr. VO2Max pod 20 je zriedkavé)
  const allValues = [...Array.from(estMap.values()), ...Array.from(measMap.values())];
  const minValue = allValues.length ? Math.min(...allValues) : 30;
  const maxValue = allValues.length ? Math.max(...allValues) : 60;
  
  // yMin nastavíme o niečo nižšie než je najmenšia hodnota (ale min. na 10), aby linka nebola úplne nalepená dole
  const yMin = Math.max(10, Math.floor((minValue - 5) / 5) * 5); 
  const yMax = Math.max(60, Math.ceil((maxValue + 5) / 5) * 5);

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        
        {/* Hlavička responzívna */}
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_CARD_TITLE}>{t("VO2Max.detailTitle")}</h2>
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
            {/* Vykreslenie pásov (Bands) na pozadie */}
            {ranges.map((r, i) => {
              // Zabezpečíme, že to budú vždy čísla
              const prevMax = i === 0 ? yMin : (ranges[i-1].max ?? yMin);
              const currentMax = r.max ?? yMax;

              const y1 = Math.max(yMin, prevMax);
              const y2 = Math.min(yMax, currentMax);
              
              // Ak je pásmo mimo grafu (pod yMin), nekreslíme ho
              if (y2 < yMin) return null;
              
              return (
                <ReferenceArea 
                  key={r.label} 
                  y1={y1} 
                  y2={y2} 
                  fill={hexWithAlpha(r.color, 0.12)} 
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
              domain={[yMin, yMax]}
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }} />
            
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            
            <Line 
              type="monotone" 
              dataKey="est" 
              name={t("VO2Max.chart.estLabel") as string} 
              stroke={appColors.chartLine1} 
              strokeWidth={3}
              dot={{ r: 3, fill: appColors.chartLine1, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="meas" 
              name={t("VO2Max.chart.measLabel") as string} 
              stroke={appColors.chartLine2} 
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: appColors.chartLine2, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}