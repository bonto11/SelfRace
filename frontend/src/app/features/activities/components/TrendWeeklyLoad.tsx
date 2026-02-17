"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";

import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyLoad } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/WeeklyLoad";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_CARD_HEAD,
  PANEL_TITLE,
  PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const DEFAULT_SPORT = "all" as const;

// Helper funkcia na formátovanie (minúty na hodiny a minúty)
const formatTimeValue = (val: number) => {
  if (!val || val === 0) return "0:00";
  const h = Math.floor(val / 60);
  const m = Math.floor(val % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
};

// Náš prémiový Tooltip
const StackedTooltip = ({ active, payload, label, metric, t }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
    
    // Ak je to čas, sformátujeme to na H:MM, inak len 1 desatinné miesto
    const formatFn = (val: number) => metric === "time" ? formatTimeValue(val) : val.toFixed(1);

    return (
      <div 
        className="p-3 rounded-xl border shadow-xl backdrop-blur-md min-w-[140px]"
        style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}
      >
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        
        <div className="space-y-1 mb-2">
          {payload.map((entry: any, index: number) => {
            if (!entry.value) return null;
            return (
              <div key={index} className="flex items-center justify-between gap-4 text-sm" style={{ color: entry.color }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }}></span>
                  <span className="opacity-90">{entry.name}</span>
                </div>
                <span className="font-bold">{formatFn(entry.value)}</span>
              </div>
            );
          })}
        </div>
        
        <div className="pt-2 border-t flex justify-between items-center text-sm text-white/90 font-bold" style={{ borderColor: appColors.divider }}>
          <span>{t("common.together") || "Total"}:</span>
          <span>{formatFn(total)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function TrendWeeklyLoad({
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
        const rows = await apiGetWeeklyLoad(userId, {
          weeks: lookback,
          sport: DEFAULT_SPORT,
        });
        if (!alive) return;
        setWeeks(rows);
      } catch (e: any) {
        console.error("Weekly load fetch failed:", t(e?.message as any));
        if (alive) setWeeks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId, lookback, t]);

  const chartData = useMemo(() => {
    return weeks.map((w) => {
      const base = { label: w.label || w.week, rawWeek: w };
      
      if (metric === "km") {
        return { ...base, run: w.km_run, ride: w.km_ride, mixed: w.km_mixed, skate: w.km_skate };
      } else if (metric === "time") {
        return { ...base, run: w.time_run_min, ride: w.time_ride_min, strength: w.time_strength_min, mixed: w.time_mixed_min, skate: w.time_skate_min, other: w.time_other_min };
      } else {
        return { ...base, run: w.trimp_run, ride: w.trimp_ride, strength: w.trimp_strength, mixed: w.trimp_mixed, skate: w.trimp_skate, other: w.trimp_other };
      }
    });
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

  // Názov osi Y
  const yAxisLabel = metric === "km" ? `[${t("common.units.km")}]` : metric === "time" ? "[h]" : `[${t("common.units.trimp")}]`;

  // Formátovač tikov na osi Y (vyžaduje návratový typ string)
  const yAxisTickFormatter = (val: any): string => {
    const num = Number(val);
    if (metric === "time") {
      if (num === 0) return "0";
      if (num >= 60) {
         const h = Math.floor(num / 60);
         const m = Math.floor(num % 60);
         return m === 0 ? `${h}h` : `${h}:${m.toString().padStart(2, "0")}`;
      }
      return `${num}m`;
    }
    return String(val); 
  };

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      
      <div className={[PANEL_PAD, PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
        <h2 className={PANEL_TITLE}>{t("weeklyLoad.title")}</h2>

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
              options={WEEK_OPTIONS(t)}
              containerClassName="w-[120px]"
              variant="editable"
            />
          )}
        </div>
      </div>

      <div className="w-full relative px-2 sm:px-4 pb-4" style={{ height: 360 }}>
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}
        
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          {/* ✅ Zväčšený left margin na 0, aby sa zmestila jednotka na ľavej osi */}
          <BarChart data={chartData} onClick={handleChartClick} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
            
            <XAxis 
              dataKey="label" 
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
              dy={10}
            />
            
            <YAxis 
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={yAxisTickFormatter}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: appColors.textMuted, fontSize: 10, dy: 30 }}
            />
            
            <Tooltip content={<StackedTooltip metric={metric} t={t} />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            
            <Bar dataKey="run" name={t("common.sports.run") as string} stackId="a" fill={appColors.chartRun} radius={[0, 0, 0, 0]} maxBarSize={40} />
            <Bar dataKey="ride" name={t("common.sports.bike") as string} stackId="a" fill={appColors.chartBike} radius={[0, 0, 0, 0]} maxBarSize={40} />
            {(metric === "time" || metric === "trimp") && <Bar dataKey="strength" name={t("common.sports.strength") as string} stackId="a" fill={appColors.chartStrength} radius={[0, 0, 0, 0]} maxBarSize={40} />}
            <Bar dataKey="mixed" name={t("common.sports.mixed") as string} stackId="a" fill={appColors.chartMixed} radius={[0, 0, 0, 0]} maxBarSize={40} />
            <Bar dataKey="skate" name={t("common.sports.skate") as string} stackId="a" fill={appColors.chartSkate} radius={[0, 0, 0, 0]} maxBarSize={40} />
            {(metric === "time" || metric === "trimp") && <Bar dataKey="other" name={t("common.sports.other") as string} stackId="a" fill={appColors.chartOther} radius={[4, 4, 0, 0]} maxBarSize={40} />} 
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}