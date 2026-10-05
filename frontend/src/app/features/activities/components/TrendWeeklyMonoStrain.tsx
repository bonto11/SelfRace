"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyMonoStrain } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/MonoStrain";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  WeeklyCard, WeeksControl, MetricControl, Readout,
  dimShape, clickedIndex, xTick, fmtMinutes, fmtMinutesAxis,
} from "@/app/features/activities/components/WeeklyChartParts";

const DEFAULT_SPORT = "all" as const;
// zemité tóny overené validátorom (dataviz) – rovnaké ako trendy
const C = { mono: appColors.chartRecoveryMain, strain: appColors.chartRecoveryAlt };

/*
 * PREČO dva grafy pod sebou namiesto dvoch osí v jednom: monotónnosť je
 * pomer (~1–3) a námaha je v km/h/trimp – dve osi nútili čítať čiaru
 * k nesprávnej osi. Rovnaké týždne pod sebou sa dajú porovnať okom.
 */

export default function TrendWeeklyMonoStrain({
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
        const rows = await apiGetWeeklyMonoStrain(userId, { weeks: lookback, sport: DEFAULT_SPORT });
        if (alive) setWeeks(rows);
      } catch (e: any) {
        console.error("Weekly mono/strain load failed:", e?.message);
        if (alive) setWeeks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, lookback]);

  const chartData = useMemo(
    () =>
      weeks.map((w) => ({
        label: w.label || w.week,
        mono: w.monotony?.[metric] ?? null,
        strain: w.strain?.[metric] ?? null,
        rawWeek: w,
      })),
    [weeks, metric],
  );

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

  const strainUnit = metric === "km" ? t("common.units.km") : metric === "time" ? "h" : t("common.units.trimp");
  const fmtMono = (v: number | null) => (v == null ? "—" : v.toFixed(2));
  const fmtStrain = (v: number | null) =>
    v == null ? "—" : metric === "time" ? fmtMinutes(v) : metric === "km" ? v.toFixed(1) : String(Math.round(v));

  // bez výberu: posledný týždeň s dátami
  let lastIdx = -1;
  for (let i = chartData.length - 1; i >= 0; i--)
    if (chartData[i].mono != null || chartData[i].strain != null) { lastIdx = i; break; }
  const shownIdx = selectedIndex ?? (lastIdx >= 0 ? lastIdx : null);
  const shown = shownIdx != null ? chartData[shownIdx] : null;

  const readout = shown ? (
    <Readout
      heading={selectedIndex != null ? shown.label : `${t("weeklyCharts.lastWeek")} · ${shown.label}`}
      onClear={selectedIndex != null ? () => pick(null) : undefined}
    >
      <div className="grid grid-cols-2 gap-3 mt-1">
        {[
          { label: t("monoStrain.trend.mono"), value: fmtMono(shown.mono), color: C.mono, unit: "" },
          { label: t("monoStrain.trend.strain"), value: fmtStrain(shown.strain), color: C.strain, unit: strainUnit },
        ].map((x) => (
          <div key={x.label}>
            <div className="inline-flex items-center gap-1 text-xs" style={{ color: appColors.textSecondary }}>
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: x.color }} />
              {x.label}
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: appColors.textPrimary }}>
              {x.value}
              {x.unit && x.value !== "—" ? (
                <span className="text-sm font-semibold ml-1" style={{ color: appColors.textSecondary }}>{x.unit}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Readout>
  ) : (
    <Readout heading={t("weeklyCharts.periodSummary")}>
      <div className="text-sm" style={{ color: appColors.textMuted }}>—</div>
    </Readout>
  );

  const interval = lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2;
  const mini = (key: "mono" | "strain", color: string, title: string, fmtAxis: (v: number) => string, showX: boolean) => (
    <div>
      <div className="text-[11px] font-semibold mb-1" style={{ color: appColors.textSecondary }}>
        {title}
      </div>
      <div style={{ height: showX ? 150 : 128 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <BarChart
            data={chartData}
            onClick={(s: any) => pick(clickedIndex(s))}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            style={{ outline: "none", cursor: "pointer" }}
          >
            <CartesianGrid vertical={false} stroke={appColors.chartGrid} strokeOpacity={0.35} strokeDasharray="2 4" />
            <XAxis dataKey="label" interval={interval} axisLine={false} tickLine={false} hide={!showX} tick={xTick(selectedIndex != null ? chartData[selectedIndex]?.label ?? null : null)} />
            <YAxis
              width={44}
              tickCount={4}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtAxis(Number(v))}
            />
            <Bar dataKey={key} fill={color} maxBarSize={44} radius={[3, 3, 0, 0]}
              shape={dimShape(selectedIndex)} activeBar={false} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <WeeklyCard
      title={t("monoStrain.trend.title")}
      tooltip={t("activityWidgets.chart.mono")}
      loading={loading}
      controls={
        <div className="space-y-2">
          {showLookback ? <WeeksControl value={lookback} onChange={setLookback} /> : null}
          <MetricControl value={metric} onChange={setMetric} />
        </div>
      }
      readout={readout}
    >
      <div className="space-y-3">
        {mini("mono", C.mono, t("monoStrain.trend.mono"), (v) => v.toFixed(1), false)}
        {mini("strain", C.strain, `${t("monoStrain.trend.strain")} [${strainUnit}]`,
          (v) => (metric === "time" ? fmtMinutesAxis(v) : String(Math.round(v))), true)}
      </div>
    </WeeklyCard>
  );
}
