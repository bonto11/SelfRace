"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyLoad } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/WeeklyLoad";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  WeeklyCard, WeeksControl, MetricControl, Readout, Legend,
  dimShape, clickedIndex, xTick, fmtMinutes, fmtMinutesAxis,
} from "@/app/features/activities/components/WeeklyChartParts";

const DEFAULT_SPORT = "all" as const;
const SPORTS = ["run", "ride", "strength", "mixed", "skate", "other"] as const;
type SportKey = (typeof SPORTS)[number];

const SPORT_COLORS: Record<SportKey, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  other: appColors.chartOther,
};

/** hodnoty týždňa podľa metriky (silový a iné nemajú km) */
function weekValues(w: WeekRow, metric: Metric): Record<SportKey, number> {
  if (metric === "km")
    return { run: w.km_run, ride: w.km_ride, strength: 0, mixed: w.km_mixed, skate: w.km_skate, other: 0 };
  if (metric === "time")
    return {
      run: w.time_run_min, ride: w.time_ride_min, strength: w.time_strength_min,
      mixed: w.time_mixed_min, skate: w.time_skate_min, other: w.time_other_min,
    };
  return {
    run: w.trimp_run, ride: w.trimp_ride, strength: w.trimp_strength,
    mixed: w.trimp_mixed, skate: w.trimp_skate, other: w.trimp_other,
  };
}

export default function TrendWeeklyLoad({
  onPickWeek, onSportChange, showLookback = true,
}: {
  onPickWeek?: (w: WeekPick | null) => void;
  onSportChange?: (sport: string) => void;
  showLookback?: boolean;
}) {
  const { userId } = useUserId();
  const t = useT();
  const [metric, setMetric] = useState<Metric>("km");
  const [lookback, setLookback] = useState<number>(2);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => { onSportChange?.(DEFAULT_SPORT); }, [onSportChange]);
  useEffect(() => { setSelectedIndex(null); onPickWeek?.(null); }, [lookback, metric]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await apiGetWeeklyLoad(userId, { weeks: lookback, sport: DEFAULT_SPORT });
        if (alive) setWeeks(rows);
      } catch { if (alive) setWeeks([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [userId, lookback]);

  const { chartData, present } = useMemo(() => {
    const present = new Set<SportKey>();
    const chartData = weeks.map((w) => {
      const v = weekValues(w, metric);
      for (const k of SPORTS) if ((v[k] || 0) > 0) present.add(k);
      const total = SPORTS.reduce((s, k) => s + (v[k] || 0), 0);
      return { label: w.label || w.week, rawWeek: w, total, ...v };
    });
    return { chartData, present };
  }, [weeks, metric]);

  const sportName = (k: SportKey) =>
    ({
      run: t("common.sports.run"), ride: t("common.sports.bike"), strength: t("common.sports.strength"),
      mixed: t("common.sports.mixed"), skate: t("common.sports.skate"), other: t("common.sports.other"),
    })[k];

  const unit = metric === "km" ? t("common.units.km") : metric === "time" ? "" : t("common.units.trimp");
  const fmt = (v: number) =>
    metric === "time" ? `${fmtMinutes(v)} h` : `${metric === "km" ? v.toFixed(1) : Math.round(v)} ${unit}`;

  const pick = useCallback((index: number | null) => {
    if (index == null || !chartData[index] || index === selectedIndex) {
      setSelectedIndex(null);
      onPickWeek?.(null);
      return;
    }
    setSelectedIndex(index);
    const w = chartData[index].rawWeek;
    if (w?.start && w?.end) onPickWeek?.({ week: w.week || w.start || "", start: w.start, end: w.end, sport: "all" });
  }, [chartData, selectedIndex, onPickWeek]);

  const sportsShown = SPORTS.filter((k) => present.has(k));
  const sel = selectedIndex != null ? chartData[selectedIndex] : null;
  const periodTotal = chartData.reduce((s, d) => s + d.total, 0);
  const avg = chartData.length ? periodTotal / chartData.length : 0;

  const readout = sel ? (
    <Readout heading={sel.label} onClear={() => pick(null)}>
      <div className="text-2xl font-bold tabular-nums" style={{ color: appColors.textPrimary }}>
        {fmt(sel.total)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums" style={{ color: appColors.textSecondary }}>
        {sportsShown
          .filter((k) => (sel as any)[k] > 0)
          .map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: SPORT_COLORS[k] }} />
              {sportName(k)}: {fmt((sel as any)[k])}
            </span>
          ))}
      </div>
    </Readout>
  ) : (
    <Readout heading={t("weeklyCharts.periodSummary")}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold tabular-nums" style={{ color: appColors.textPrimary }}>
          {fmt(periodTotal)}
        </span>
        <span className="text-xs" style={{ color: appColors.textSecondary }}>
          {t("weeklyCharts.avgPerWeek")}: {fmt(avg)}
        </span>
      </div>
    </Readout>
  );

  return (
    <WeeklyCard
      title={t("weeklyLoad.title")}
      tooltip={t("activityWidgets.chart.load")}
      loading={loading}
      controls={
        <div className="space-y-2">
          {showLookback ? <WeeksControl value={lookback} onChange={setLookback} /> : null}
          <MetricControl value={metric} onChange={setMetric} />
        </div>
      }
      readout={readout}
      footer={<Legend items={sportsShown.map((k) => ({ label: sportName(k), color: SPORT_COLORS[k] }))} />}
    >
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <BarChart
            data={chartData}
            onClick={(s: any) => pick(clickedIndex(s))}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            style={{ outline: "none", cursor: "pointer" }}
          >
            <CartesianGrid vertical={false} stroke={appColors.chartGrid} strokeOpacity={0.35} strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              interval={lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2}
              axisLine={false}
              tickLine={false}
              tick={xTick(selectedIndex != null ? chartData[selectedIndex]?.label ?? null : null)}
            />
            <YAxis
              width={44}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (metric === "time" ? fmtMinutesAxis(Number(v)) : String(v))}
            />
            {sportsShown.map((k) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="a"
                fill={SPORT_COLORS[k]}
                maxBarSize={44}
                shape={dimShape(selectedIndex)}
                activeBar={false}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WeeklyCard>
  );
}
