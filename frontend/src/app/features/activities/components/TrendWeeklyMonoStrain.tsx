"use client";

import { useEffect, useMemo, useState } from "react";
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

import { useUserId } from "@/app/shared/hooks/useUserId";
import { LOOKBACK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_CARD_HEAD,
  PANEL_TITLE,
} from "@/app/shared/ui/tokens";
import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyMonoStrain } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/MonoStrain";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useT } from "@/app/shared/i18n/useT";

const C = { monotony: appColors.chartLine1, strain: appColors.chartLine2 };
const DEFAULT_SPORT = "all" as const;

// Náš prémiový tooltip prispôsobený tvojej natur téme
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="p-3 rounded-xl border shadow-xl backdrop-blur-md"
        style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}
      >
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="opacity-90">{entry.name}:</span>
            <span className="font-bold">{Number(entry.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrendWeeklyMonoStrain({
  onPickWeek,
  onSportChange,
  showLookback = true,
}: {
  onPickWeek?: (w: WeekPick) => void;
  onSportChange?: (sport: string) => void;
  showLookback?: boolean;
}) {
  const { userId } = useUserId();
  const [metric, setMetric] = useState<Metric>("km");
  const [lookback, setLookback] = useState<number>(2);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useT();

  useEffect(() => {
    onSportChange?.(DEFAULT_SPORT);
  }, [onSportChange]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await apiGetWeeklyMonoStrain(userId, {
          weeks: lookback,
          sport: DEFAULT_SPORT,
        });
        if (!alive) return;
        setWeeks(rows);
      } catch (e: any) {
        console.error("Weekly mono/strain load failed:", e?.message);
        if (alive) setWeeks([]); 
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId, lookback]);

  // Dáta preformátované pre Recharts
  const chartData = useMemo(() => {
    return weeks.map((w) => ({
      label: w.label || w.week,
      mono: w.monotony?.[metric] ?? null,
      strain: w.strain?.[metric] ?? null,
      rawWeek: w // schováme si celý objekt pre onClick
    }));
  }, [weeks, metric]);

  const handleChartClick = (state: any) => {
    if (!onPickWeek || !state || !state.activePayload) return;
    const w = state.activePayload[0].payload.rawWeek;
    if (w) {
      onPickWeek({
        week: w.week || w.label || w.start || "",
        start: w.start,
        end: w.end,
        sport: DEFAULT_SPORT,
      });
    }
  };

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      
      {/* Vylepšená hlavička, ktorá sa na mobiloch zalomí a neschová prepínač */}
      <div className={[PANEL_PAD, PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
        <div className="flex items-center gap-2">
          <h2 className={PANEL_TITLE}>{t("monoStrain.trend.title")}</h2>
          <TooltipIcon text={t("monoStrain.trend.tooltip")} />
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
            <Button size="xs" variant={metric === "km" ? "active" : "ghost"} onClick={() => setMetric("km")}>{t("common.metrics.distance")}</Button>
            <Button size="xs" variant={metric === "time" ? "active" : "ghost"} onClick={() => setMetric("time")}>{t("common.metrics.time")}</Button>
            <Button size="xs" variant={metric === "trimp" ? "active" : "ghost"} onClick={() => setMetric("trimp")}>{t("common.metrics.trimp")}</Button>
          </div>

          {showLookback && (
            <SelectField
              value={String(lookback)}
              onValueChange={(v) => setLookback(Number(v))}
              options={LOOKBACK_OPTIONS(t)}
              containerClassName="w-[120px]"
              variant="editable"
            />
          )}
        </div>
      </div>

      {/* Recharts kontajner */}
      <div className="w-full relative px-2 sm:px-4 pb-4" style={{ height: 320 }}>
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}
        
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {/* Jemná horizontálna mriežka */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
            
            {/* X Os (Dátumy) */}
            <XAxis 
              dataKey="label" 
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
              dy={10}
            />
            
            {/* Y Os 1 (Monotónnosť - Vľavo) */}
            <YAxis 
              yAxisId="left" 
              tick={{ fill: C.monotony, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
            />
            
            {/* Y Os 2 (Úsilie - Vpravo) */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              tick={{ fill: C.strain, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
            />
            
            {/* Tooltip */}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }} />
            
            {/* Legenda */}
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            
            {/* Samotné čiary */}
            <Line 
              yAxisId="left" 
              type="monotone" // Monotone vytvorí moderné oblé krivky
              dataKey="mono" 
              name={t("monoStrain.trend.mono") as string} 
              stroke={C.monotony} 
              strokeWidth={3}
              dot={{ r: 3, fill: C.monotony, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="strain" 
              name={t("monoStrain.trend.strain") as string} 
              stroke={C.strain} 
              strokeWidth={3}
              strokeDasharray="5 5" // Čiarkovaná čiara
              dot={{ r: 3, fill: C.strain, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}